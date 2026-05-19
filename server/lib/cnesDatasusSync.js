/**
 * Baixa profissionais do CNES/DATASUS e grava no MongoDB (sem Excel manual).
 * Mesma API usada em export-medicos-massa.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import mongoose from 'mongoose';
import MedicoCnes from '../models/MedicoCnes.js';
import { CONFIG } from '../config/ports.js';

let bulkConn = null;
let BulkMedicoCnes = null;

async function getBulkMedicoCnes() {
  if (BulkMedicoCnes && bulkConn?.readyState === 1) return BulkMedicoCnes;
  const uri = process.env.MONGO_URI || CONFIG.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI não definida');
  bulkConn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 60_000,
    socketTimeoutMS: 600_000,
    connectTimeoutMS: 60_000,
    maxPoolSize: 20,
    retryWrites: true
  });
  await bulkConn.asPromise();
  BulkMedicoCnes = bulkConn.model('MedicoCnes', MedicoCnes.schema);
  return BulkMedicoCnes;
}

export async function closeBulkConnection() {
  if (bulkConn) {
    await bulkConn.close();
    bulkConn = null;
    BulkMedicoCnes = null;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '.tmp-cnes-sync');
const BATCH = Math.min(5000, Math.max(500, parseInt(process.env.CNES_SYNC_BATCH || '1500', 10) || 1500));
const DELETE_CHUNK = 10_000;
const INSERT_RETRIES = 4;

const CNES_SERVICES = 'https://cnes.datasus.gov.br/services';
const CNES_DOWNLOAD_SERVLET = 'http://cnesdownload.datasus.gov.br/download/ProfissionaisServlet?path=';
const CNES_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://cnes.datasus.gov.br/pages/profissionais/extracao.jsp',
  'User-Agent': 'Mozilla/5.0 (compatible; PulseFlow-CNES-Sync/1.0)'
};

const CBO_MEDICO_PREFIXES = ['2251', '2252', '2253'];

export const UFS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const UF_PARA_CODIGO_IBGE = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41',
  PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17'
};

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function splitCsvLine(line, sep) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      parts.push(cur);
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

function detectSeparator(headerLine) {
  if (headerLine.includes(';')) return ';';
  if (headerLine.includes('\t')) return '\t';
  return ',';
}

function isMongoTimeout(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('timed out') || msg.includes('timeout') || err?.name === 'MongoNetworkTimeoutError';
}

async function insertManyComRetry(Medico, docs) {
  let lastErr;
  for (let attempt = 1; attempt <= INSERT_RETRIES; attempt++) {
    try {
      await Medico.insertMany(docs, { ordered: false });
      return;
    } catch (e) {
      lastErr = e;
      if (!isMongoTimeout(e) || attempt === INSERT_RETRIES) throw e;
      const wait = attempt * 3000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/** Remove UF em lotes (evita timeout do Atlas em deleteMany gigante). */
export async function deleteMedicosPorUf(Medico, uf, onProgress) {
  const ufUp = String(uf).toUpperCase();
  let total = 0;
  while (true) {
    const ids = await Medico.find({ uf: ufUp }).select('_id').limit(DELETE_CHUNK).lean();
    if (!ids.length) break;
    const r = await Medico.deleteMany({ _id: { $in: ids.map((d) => d._id) } });
    total += r.deletedCount || 0;
    if (onProgress && total % (DELETE_CHUNK * 3) === 0) {
      await onProgress(`🗑️ ${ufUp}: ${total.toLocaleString('pt-BR')} removidos...`);
    }
  }
  return total;
}

function rowToDoc(headers, values, meta) {
  const row = Object.fromEntries(headers.map((h, i) => [h.toUpperCase(), values[i] ?? '']));
  const cbo = String(row.CO_CBO || row.CBO || '').replace(/\D/g, '');
  if (meta.apenasMedicos && cbo && !CBO_MEDICO_PREFIXES.some((p) => cbo.startsWith(p))) return null;

  const nome = String(row.NO_PROFISSIONAL || row.NOME || row.NOME_PROFISSIONAL || '').trim();
  if (!nome) return null;

  return {
    nome,
    cpf: onlyDigits(row.NU_CPF || row.CPF),
    cns: onlyDigits(row.CO_CNS || row.NU_CNS),
    cbo,
    uf: String(row.CO_UF || row.SG_UF || row.UF || meta.uf || '').toUpperCase().slice(0, 2),
    municipio: String(row.NO_MUNICIPIO || row.MUNICIPIO || '').trim(),
    conselho: String(row.CO_CONSELHO || row.SG_CONSELHO || row.DS_CONSELHO || '').trim(),
    registroConselho: onlyDigits(row.NU_REGISTRO || row.NU_CRM || row.CRM || row.CO_REGISTRO),
    codigoEstabelecimentoCnes: onlyDigits(row.CO_CNES || row.CNES),
    fonte: 'cnes-datasus',
    competencia: meta.competencia || ''
  };
}

async function parseCsvToMongo(Medico, csvPath, meta, onBatch) {
  const stat = fs.statSync(csvPath);
  const csvMb = (stat.size / 1024 / 1024).toFixed(1);
  if (onBatch) {
    await onBatch({
      phase: 'start',
      csvMb,
      file: path.basename(csvPath)
    });
  }

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: 'latin1' }),
    crlfDelay: Infinity
  });
  let headers = null;
  let sep = ';';
  let batch = [];
  let inserted = 0;
  let linesRead = 0;
  const PROGRESS_LINES = 150_000;

  const flush = async () => {
    if (!batch.length) return;
    await insertManyComRetry(Medico, batch);
    inserted += batch.length;
    batch = [];
    if (onBatch) await onBatch({ phase: 'inserted', inserted, linesRead });
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      sep = detectSeparator(line);
      headers = splitCsvLine(line, sep).map((h) => h.replace(/^\uFEFF/, '').trim());
      continue;
    }
    linesRead++;
    if (linesRead % PROGRESS_LINES === 0 && onBatch) {
      await onBatch({ phase: 'scan', inserted, linesRead });
    }

    const doc = rowToDoc(headers, splitCsvLine(line, sep), meta);
    if (!doc) continue;
    batch.push(doc);
    if (meta.limite > 0 && inserted + batch.length >= meta.limite) {
      await flush();
      return inserted;
    }
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return inserted;
}

async function unzipFindCsvs(zipPath, destDir) {
  const { default: AdmZip } = await import('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
  const csvs = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.csv$/i.test(name)) csvs.push(full);
    }
  };
  walk(destDir);
  return csvs;
}

export async function baixarZipProfissionaisUf(uf, destDir, competencia = '') {
  const ufUp = String(uf).toUpperCase();
  const codigoIbge = UF_PARA_CODIGO_IBGE[ufUp];
  if (!codigoIbge) throw new Error(`UF inválida: ${ufUp}`);

  const metaUrl = `${CNES_SERVICES}/profissionais-url-download?estado=${codigoIbge}&gestao=todos&comp=${competencia || ''}`;
  const metaRes = await fetch(metaUrl, { headers: CNES_HEADERS });
  if (!metaRes.ok) throw new Error(`API CNES HTTP ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta?.url) throw new Error('CNES não retornou URL de download');

  const dlRes = await fetch(`${CNES_DOWNLOAD_SERVLET}${meta.url}`, {
    headers: { Referer: 'https://cnes.datasus.gov.br/' }
  });
  if (!dlRes.ok) throw new Error(`Download ZIP HTTP ${dlRes.status}`);

  const zipPath = path.join(destDir, `profissionais-${ufUp}.zip`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(zipPath, buffer);

  const extractDir = path.join(destDir, `extract-${ufUp}`);
  fs.mkdirSync(extractDir, { recursive: true });
  const csvs = await unzipFindCsvs(zipPath, extractDir);
  if (!csvs.length) throw new Error('ZIP sem CSV');
  return { csvs, zipMb: buffer.length / 1024 / 1024 };
}

export function parseUfsFromEnv() {
  const raw = process.env.CNES_SYNC_UFS || process.env.CNES_DEFAULT_UF || 'SP';
  return raw
    .split(',')
    .map((u) => u.trim().toUpperCase())
    .filter((u) => UFS_BR.includes(u));
}

/**
 * @param {object} opts
 * @param {string[]} opts.ufs
 * @param {string} [opts.competencia]
 * @param {boolean} [opts.resetAll]
 * @param {boolean} [opts.replaceByUf]
 * @param {boolean} [opts.apenasMedicos]
 * @param {number} [opts.limite]
 * @param {boolean} [opts.manterTmp]
 * @param {(msg: string) => void|Promise<void>} [opts.onProgress]
 */
export async function syncCnesFromDatasus(opts = {}) {
  const ufs = (opts.ufs?.length ? opts.ufs : parseUfsFromEnv()).map((u) => u.toUpperCase());
  if (!ufs.length) throw new Error('Nenhuma UF válida. Use CNES_SYNC_UFS=SP no .env');

  const competencia = opts.competencia ?? process.env.CNES_SYNC_COMPETENCIA ?? '';
  const resetAll = opts.resetAll === true;
  const replaceByUf = opts.replaceByUf !== false;
  const apenasMedicos = opts.apenasMedicos !== false;
  const limite = opts.limite || 0;
  const onProgress = opts.onProgress || (() => {});

  const Medico = await getBulkMedicoCnes();
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const result = { total: 0, byUf: {}, errors: [] };

  try {
  if (resetAll) {
    await onProgress('Limpando coleção medicocnes...');
    await Medico.deleteMany({});
  }

  for (const uf of ufs) {
    try {
      await onProgress(`⬇️ Baixando CNES — ${uf} (DATASUS)...`);
      const { csvs, zipMb } = await baixarZipProfissionaisUf(uf, TMP_DIR, competencia);
      await onProgress(`📦 ${uf}: ZIP ${zipMb.toFixed(1)} MB, ${csvs.length} CSV(s)`);

      if (replaceByUf && !resetAll) {
        await onProgress(`🗑️ ${uf}: removendo registros antigos (em lotes)...`);
        const removed = await deleteMedicosPorUf(Medico, uf, onProgress);
        await onProgress(`🗑️ ${uf}: ${removed.toLocaleString('pt-BR')} removidos`);
      }

      let ufTotal = 0;
      const meta = { uf, competencia, apenasMedicos, limite };

      for (const csv of csvs) {
        await onProgress(
          `📥 ${uf}: importando \`${path.basename(csv)}\`\n` +
            `_Lendo CSV + filtro médicos (CBO 225x). Pode levar 15–40 min em SP._`
        );

        const n = await parseCsvToMongo(Medico, csv, meta, async (ev) => {
          if (ev.phase === 'start') {
            await onProgress(
              `📥 ${uf}: CSV ${ev.csvMb} MB — gravando no MongoDB...`
            );
            return;
          }
          if (ev.phase === 'scan') {
            await onProgress(
              `📥 ${uf}: ${ev.linesRead.toLocaleString('pt-BR')} linhas lidas | ` +
                `${ev.inserted.toLocaleString('pt-BR')} médicos gravados`
            );
            return;
          }
          if (ev.phase === 'inserted') {
            await onProgress(
              `📥 ${uf}: ${ev.inserted.toLocaleString('pt-BR')} médicos no MongoDB ` +
                `(${ev.linesRead.toLocaleString('pt-BR')} linhas processadas)`
            );
          }
        });
        ufTotal += n;
        if (limite > 0 && ufTotal >= limite) break;
      }

      result.byUf[uf] = ufTotal;
      result.total += ufTotal;
      await onProgress(`✅ ${uf}: ${ufTotal.toLocaleString('pt-BR')} médicos importados`);
    } catch (e) {
      result.errors.push({ uf, error: e.message || String(e) });
      await onProgress(`❌ ${uf}: ${e.message || e}`);
    }
  }

  if (!opts.manterTmp) {
    try {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  if (process.env.CNES_SYNC_INDEXES === 'true') {
    await onProgress('🔧 Atualizando índices MongoDB...');
    await Medico.syncIndexes();
  }
  await onProgress('📊 Contando registros...');
  result.grandTotal = await Medico.countDocuments();
  return result;
  } finally {
    if (opts.keepBulkConnection !== true) await closeBulkConnection();
  }
}

/** Auto-sync na subida do servidor: padrão só se MongoDB CNES estiver vazio. */
export function shouldAutoSyncOnStart(cnesCount) {
  const mode = (process.env.CNES_AUTO_SYNC || 'if-empty').toLowerCase();
  if (mode === 'false' || mode === '0' || mode === 'off' || mode === 'never') return false;
  if (mode === 'always') return true;
  return cnesCount === 0;
}
