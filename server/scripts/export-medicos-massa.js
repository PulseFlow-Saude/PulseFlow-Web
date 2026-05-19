/**
 * Exporta médicos em massa (Brasil) → Excel, 100% gratuito via CNES/DATASUS.
 *
 * Fonte: base pública "Profissionais" do Ministério da Saúde (não é o CRM ao vivo,
 * mas inclui profissionais de saúde com CBO de médico vinculados ao SUS).
 *
 * Instalação (uma vez):
 *   cd PulseFlow-Web/server
 *   npm install
 *
 * Uso totalmente automático (baixa do site DATASUS):
 *   node scripts/export-medicos-massa.js --output=medicos-brasil.xlsx
 *   node scripts/export-medicos-massa.js --uf=SP --output=medicos-sp.xlsx
 *   node scripts/export-medicos-massa.js --ufs=SP,RJ,MG --output=sudeste.xlsx
 *
 * Se já tiver o ZIP/CSV baixado manualmente:
 *   node scripts/export-medicos-massa.js --arquivo=Profissionais_Brasil_SP_202502.zip --output=medicos.xlsx
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '.tmp-cnes-export');
const CNES_SERVICES = 'https://cnes.datasus.gov.br/services';
const CNES_DOWNLOAD_SERVLET = 'http://cnesdownload.datasus.gov.br/download/ProfissionaisServlet?path=';
const CNES_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://cnes.datasus.gov.br/pages/profissionais/extracao.jsp',
  'User-Agent': 'Mozilla/5.0 (compatible; PulseFlow-CNES-Export/1.0)'
};
const CBO_MEDICO_PREFIXES = ['2251', '2252', '2253'];
const UFS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

/** Código IBGE da UF (valor do select ng-model="Estado" no portal CNES) */
const UF_PARA_CODIGO_IBGE = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41',
  PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17'
};
const EXCEL_MAX_ROWS = 1_000_000;

const COLUNAS_EXCEL = [
  'nome',
  'cpf',
  'cns',
  'cbo',
  'uf',
  'municipio',
  'conselho',
  'registroConselho',
  'codigoEstabelecimentoCnes',
  'fonte',
  'competencia'
];

function parseArgs(argv) {
  const opts = {
    output: 'medicos-cnes.xlsx',
    uf: '',
    ufs: [],
    arquivo: '',
    competencia: '',
    apenasMedicos: true,
    limite: 0,
    manterTmp: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--output=')) opts.output = arg.slice(9).trim();
    else if (arg.startsWith('--uf=')) opts.uf = arg.slice(5).trim().toUpperCase();
    else if (arg.startsWith('--ufs=')) opts.ufs = arg.slice(6).split(',').map((u) => u.trim().toUpperCase()).filter(Boolean);
    else if (arg.startsWith('--arquivo=')) opts.arquivo = arg.slice(10).trim();
    else if (arg.startsWith('--competencia=')) opts.competencia = arg.slice(14).trim();
    else if (arg.startsWith('--limite=')) opts.limite = parseInt(arg.slice(9), 10) || 0;
    else if (arg === '--todos-profissionais') opts.apenasMedicos = false;
    else if (arg === '--manter-tmp') opts.manterTmp = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 20).join('\n'));
      process.exit(0);
    }
  }
  if (!opts.ufs.length && opts.uf) opts.ufs = [opts.uf];
  if (!opts.ufs.length && !opts.arquivo) opts.ufs = [...UFS_BR];
  return opts;
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

function rowToMedico(headers, values, meta) {
  const row = Object.fromEntries(headers.map((h, i) => [h.toUpperCase(), values[i] ?? '']));
  const cbo = String(row.CO_CBO || row.CBO || '').replace(/\D/g, '');
  if (meta.apenasMedicos && cbo && !CBO_MEDICO_PREFIXES.some((p) => cbo.startsWith(p))) return null;

  const nome = row.NO_PROFISSIONAL || row.NOME || row.NOME_PROFISSIONAL;
  if (!nome) return null;

  return {
    nome,
    cpf: row.NU_CPF || row.CPF || '',
    cns: row.CO_CNS || row.NU_CNS || '',
    cbo,
    uf: row.CO_UF || row.SG_UF || row.UF || meta.uf || '',
    municipio: row.NO_MUNICIPIO || row.MUNICIPIO || '',
    conselho: row.CO_CONSELHO || row.SG_CONSELHO || row.DS_CONSELHO || '',
    registroConselho: row.NU_REGISTRO || row.NU_CRM || row.CRM || row.CO_REGISTRO || '',
    codigoEstabelecimentoCnes: row.CO_CNES || row.CNES || '',
    fonte: 'cnes-datasus',
    competencia: meta.competencia || ''
  };
}

async function parseCsvFile(filePath, meta, onRow) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity
  });
  let headers = null;
  let sep = ';';
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      sep = detectSeparator(line);
      headers = splitCsvLine(line, sep).map((h) => h.replace(/^\uFEFF/, '').trim());
      continue;
    }
    const medico = rowToMedico(headers, splitCsvLine(line, sep), meta);
    if (!medico) continue;
    const stop = await onRow(medico);
    count++;
    if (stop === false || (meta.limite > 0 && count >= meta.limite)) break;
  }
  return count;
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

async function baixarZipProfissionaisUf(uf, destDir, competencia = '') {
  const codigoIbge = UF_PARA_CODIGO_IBGE[uf];
  if (!codigoIbge) throw new Error(`UF inválida: ${uf}`);

  console.log(`Baixando CNES — UF ${uf}...`);
  const metaUrl = `${CNES_SERVICES}/profissionais-url-download?estado=${codigoIbge}&gestao=todos&comp=${competencia || ''}`;
  const metaRes = await fetch(metaUrl, { headers: CNES_HEADERS });
  if (!metaRes.ok) throw new Error(`API retornou HTTP ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta?.url) throw new Error('Resposta sem URL de download');

  const dlRes = await fetch(`${CNES_DOWNLOAD_SERVLET}${meta.url}`, {
    headers: { Referer: 'https://cnes.datasus.gov.br/' }
  });
  if (!dlRes.ok) throw new Error(`Download ZIP retornou HTTP ${dlRes.status}`);

  const zipPath = path.join(destDir, `profissionais-${uf}.zip`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(zipPath, buffer);
  console.log(`  ZIP ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  const extractDir = path.join(destDir, `extract-${uf}`);
  fs.mkdirSync(extractDir, { recursive: true });
  const csvs = await unzipFindCsvs(zipPath, extractDir);
  if (!csvs.length) throw new Error('ZIP sem arquivos CSV');
  console.log(`  ${csvs.length} CSV(s) extraído(s)`);
  return csvs;
}

async function coletarArquivosEntrada(opts) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const arquivos = [];

  if (opts.arquivo) {
    const abs = path.resolve(opts.arquivo);
    if (!fs.existsSync(abs)) throw new Error(`Arquivo não encontrado: ${abs}`);
    if (/\.zip$/i.test(abs)) {
      const dir = path.join(TMP_DIR, 'zip');
      fs.mkdirSync(dir, { recursive: true });
      arquivos.push(...(await unzipFindCsvs(abs, dir)));
    } else {
      arquivos.push(abs);
    }
    return arquivos;
  }

  for (const uf of opts.ufs) {
    try {
      arquivos.push(...(await baixarZipProfissionaisUf(uf, TMP_DIR, opts.competencia)));
    } catch (err) {
      console.warn(`  Falha em ${uf}: ${err.message}`);
    }
  }

  return arquivos.filter((f) => fs.existsSync(f));
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(opts.output);
  const meta = {
    apenasMedicos: opts.apenasMedicos,
    competencia: opts.competencia,
    limite: opts.limite
  };

  console.log('Fonte: CNES/DATASUS (público, gratuito)');
  console.log('UFs:', opts.arquivo ? '(arquivo local)' : opts.ufs.join(', '));
  console.log('Filtro médicos (CBO 225x):', opts.apenasMedicos ? 'sim' : 'não');
  console.log('');

  const arquivos = await coletarArquivosEntrada(opts);
  if (!arquivos.length) {
    throw new Error('Nenhum arquivo obtido. Tente --arquivo= com ZIP do DATASUS.');
  }

  const csvTemp = outPath.replace(/\.xlsx?$/i, '.csv');
  const stream = fs.createWriteStream(csvTemp, 'utf8');
  stream.write(`\uFEFF${COLUNAS_EXCEL.join(';')}\n`);
  let total = 0;

  const writeRow = (medico) => {
    const line = COLUNAS_EXCEL.map((k) => String(medico[k] ?? '').replace(/;/g, ',')).join(';');
    stream.write(`${line}\n`);
    total++;
    if (total % 50000 === 0) console.log(`  ${total.toLocaleString('pt-BR')} médicos...`);
  };

  outer: for (const csv of arquivos) {
    const ufGuess = path.basename(csv).match(/([A-Z]{2})/)?.[1] || '';
    await parseCsvFile(csv, { ...meta, uf: ufGuess }, async (medico) => {
      writeRow(medico);
      if (opts.limite > 0 && total >= opts.limite) return false;
    });
    if (opts.limite > 0 && total >= opts.limite) break outer;
  }

  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on('error', reject);
  });

  if (!total) {
    fs.unlinkSync(csvTemp);
    throw new Error('Nenhum médico encontrado nos arquivos (verifique CBO/filtros).');
  }

  if (total > EXCEL_MAX_ROWS || !/\.xlsx?$/i.test(outPath)) {
    if (total > EXCEL_MAX_ROWS) {
      console.warn(`Volume grande (${total.toLocaleString('pt-BR')} linhas). CSV abre no Excel: ${csvTemp}`);
    } else {
      fs.renameSync(csvTemp, outPath);
      console.log(`\nPronto: ${total.toLocaleString('pt-BR')} médicos → ${outPath}`);
    }
  } else {
    const { utils, read, writeFile } = await import('xlsx');
    const wb = read(csvTemp, { type: 'file', raw: false });
    writeFile(wb, outPath);
    fs.unlinkSync(csvTemp);
    console.log(`\nPronto: ${total.toLocaleString('pt-BR')} médicos → ${outPath}`);
  }

  if (!opts.manterTmp && !opts.arquivo) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
