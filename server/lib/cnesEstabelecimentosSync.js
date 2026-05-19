/**
 * Baixa estabelecimentos de saúde (clínicas, hospitais…) do DATASUS → MongoDB.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import mongoose from 'mongoose';
import CnesEstabelecimento from '../models/CnesEstabelecimento.js';
import { CONFIG } from '../config/ports.js';
import { UF_PARA_CODIGO_IBGE, UFS_BR } from './cnesDatasusSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '.tmp-cnes-estab-sync');
const BATCH = 1500;

const CNES_SERVICES = 'https://cnes.datasus.gov.br/services';
const CNES_DOWNLOAD_SERVLET = 'http://cnesdownload.datasus.gov.br/download/EstabelecimentosServlet?path=';
const CNES_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp',
  'User-Agent': 'Mozilla/5.0 (compatible; PulseFlow-CNES-Estab/1.0)'
};

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row[k] ?? row[String(k).toUpperCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
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

function rowToEstab(headers, values, meta) {
  const row = Object.fromEntries(
    headers.map((h, i) => [String(h).toUpperCase().trim(), values[i] ?? ''])
  );
  const codigoCnes = onlyDigits(pick(row, 'CNES', 'CO_CNES'));
  if (!codigoCnes) return null;

  const telefone = onlyDigits(
    pick(row, 'NU_TELEFONE', 'TELEFONE', 'NU_TELEFONE_PRINCIPAL', 'TELEFONE1', 'TELEFONE 1')
  );
  const email = pick(row, 'NO_EMAIL', 'EMAIL', 'DS_EMAIL', 'E-MAIL', 'E_MAIL').toLowerCase();
  const nome =
    pick(row, 'NOME FANTASIA', 'NO_FANTASIA', 'RAZAO SOCIAL', 'NO_RAZAO_SOCIAL', 'NO_ESTABELECIMENTO', 'NOME') ||
    '';
  if (!nome) return null;

  const logradouro = pick(row, 'LOGRADOURO', 'NO_LOGRADOURO', 'DS_LOGRADOURO');
  const numero = pick(row, 'NUMERO', 'NU_ENDERECO');
  const bairro = pick(row, 'BAIRRO', 'NO_BAIRRO');
  const cep = onlyDigits(pick(row, 'CEP', 'CO_CEP', 'NU_CEP'));
  const municipio = pick(row, 'MUNICIPIO', 'NO_MUNICIPIO');
  const uf = pick(row, 'UF', 'CO_UF', 'SG_UF', meta.uf).toUpperCase().slice(0, 2);

  const partesEnd = [
    [logradouro, numero].filter(Boolean).join(', '),
    bairro,
    municipio,
    uf,
    cep ? `CEP ${cep}` : ''
  ].filter(Boolean);

  return {
    codigoCnes,
    nome: nome || `CNES ${codigoCnes}`,
    telefone,
    email,
    endereco: partesEnd.join(' - '),
    uf,
    municipio,
    fonte: 'cnes-estabelecimento-datasus'
  };
}

export async function baixarZipEstabelecimentosUf(uf, destDir) {
  const ufUp = String(uf).toUpperCase();
  const codigoIbge = UF_PARA_CODIGO_IBGE[ufUp];
  if (!codigoIbge) throw new Error(`UF inválida: ${ufUp}`);

  const metaUrl = `${CNES_SERVICES}/estabelecimentos-url-download?estado=${codigoIbge}&gestao=todos`;
  const metaRes = await fetch(metaUrl, { headers: CNES_HEADERS });
  if (!metaRes.ok) throw new Error(`API CNES HTTP ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta?.url) throw new Error('Sem URL de download');

  const dlRes = await fetch(`${CNES_DOWNLOAD_SERVLET}${meta.url}`, {
    headers: { Referer: 'https://cnes.datasus.gov.br/' }
  });
  if (!dlRes.ok) throw new Error(`Download HTTP ${dlRes.status}`);

  const zipPath = path.join(destDir, `estabelecimentos-${ufUp}.zip`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(zipPath, buffer);

  const { default: AdmZip } = await import('adm-zip');
  const extractDir = path.join(destDir, `extract-est-${ufUp}`);
  fs.mkdirSync(extractDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(extractDir, true);

  const csvs = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.csv$/i.test(name)) csvs.push(full);
    }
  };
  walk(extractDir);
  if (!csvs.length) throw new Error('ZIP sem CSV');
  return { csvs, zipMb: buffer.length / 1024 / 1024 };
}

let bulkConn = null;
let BulkEstab = null;

async function getBulkModel() {
  if (BulkEstab && bulkConn?.readyState === 1) return BulkEstab;
  const uri = process.env.MONGO_URI || CONFIG.MONGO_URI;
  bulkConn = mongoose.createConnection(uri, {
    socketTimeoutMS: 600_000,
    serverSelectionTimeoutMS: 60_000
  });
  await bulkConn.asPromise();
  BulkEstab = bulkConn.model('CnesEstabelecimento', CnesEstabelecimento.schema);
  return BulkEstab;
}

export async function syncEstabelecimentosFromDatasus({
  ufs = ['SP'],
  onProgress = () => {},
  /** ZIP estadual do DATASUS (2024+) não traz tel/e-mail — importar todos por padrão */
  apenasComContato = false
} = {}) {
  const Estab = await getBulkModel();
  fs.mkdirSync(TMP_DIR, { recursive: true });
  let total = 0;

  for (const uf of ufs) {
    await onProgress(`⬇️ Baixando estabelecimentos — ${uf}...`);
    const { csvs, zipMb } = await baixarZipEstabelecimentosUf(uf, TMP_DIR);
    await onProgress(`📦 ${uf}: ${zipMb.toFixed(1)} MB`);

    for (const csv of csvs) {
      const rl = createInterface({ input: createReadStream(csv, { encoding: 'latin1' }), crlfDelay: Infinity });
      let headers = null;
      let sep = ';';
      let batch = [];

      for await (const line of rl) {
        if (!line.trim()) continue;
        if (!headers) {
          sep = line.includes(';') ? ';' : ',';
          headers = splitCsvLine(line, sep).map((h) => h.replace(/^\uFEFF/, '').trim());
          continue;
        }
        const doc = rowToEstab(headers, splitCsvLine(line, sep), { uf });
        if (!doc) continue;
        if (apenasComContato && !doc.telefone && !doc.email) continue;

        batch.push(doc);
        if (batch.length >= BATCH) {
          await Estab.bulkWrite(
            batch.map((d) => ({
              updateOne: {
                filter: { codigoCnes: d.codigoCnes },
                update: { $set: d },
                upsert: true
              }
            })),
            { ordered: false }
          );
          total += batch.length;
          batch = [];
          if (total % 20000 === 0) await onProgress(`📥 ${total.toLocaleString('pt-BR')} unidades...`);
        }
      }
      if (batch.length) {
        await Estab.bulkWrite(
          batch.map((d) => ({
            updateOne: {
              filter: { codigoCnes: d.codigoCnes },
              update: { $set: d },
              upsert: true
            }
          })),
          { ordered: false }
        );
        total += batch.length;
      }
    }
  }

  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (bulkConn) await bulkConn.close();

  const grandTotal = await CnesEstabelecimento.estimatedDocumentCount();
  return { total, grandTotal };
}

export { UFS_BR };
