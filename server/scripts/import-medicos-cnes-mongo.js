/**
 * Importa medicos-sp.xlsx (CNES) para MongoDB — coleção medicocnes.
 *
 *   npm run import-medicos-cnes -- --arquivo=medicos-sp.xlsx --reset
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import MedicoCnes from '../models/MedicoCnes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH = 8000;

function parseArgs(argv) {
  const opts = { arquivo: 'medicos-sp.xlsx', reset: false };
  for (const arg of argv) {
    if (arg.startsWith('--arquivo=')) opts.arquivo = arg.slice(10).trim();
    else if (arg === '--reset') opts.reset = true;
  }
  return opts;
}

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function rowToDoc(row) {
  const nome = String(row.nome || '').trim();
  if (!nome) return null;
  return {
    nome,
    cpf: onlyDigits(row.cpf),
    cns: onlyDigits(row.cns),
    cbo: String(row.cbo ?? '').replace(/\D/g, ''),
    uf: String(row.uf || '').toUpperCase().slice(0, 2),
    municipio: String(row.municipio || '').trim(),
    conselho: String(row.conselho || '').trim(),
    registroConselho: onlyDigits(row.registroConselho),
    codigoEstabelecimentoCnes: onlyDigits(row.codigoEstabelecimentoCnes),
    fonte: String(row.fonte || 'cnes-datasus').trim(),
    competencia: String(row.competencia || '').trim()
  };
}

async function readXlsxRows(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Arquivo não encontrado: ${abs}`);
  const { read, utils } = await import('xlsx');
  console.log('Lendo Excel (pode levar ~10s)...');
  const wb = read(abs, { type: 'file', dense: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return utils.sheet_to_json(sheet, { defval: '' });
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  await connectDB();

  if (opts.reset) {
    console.log('Limpando coleção medicocnes...');
    await MedicoCnes.deleteMany({});
  }

  const rows = await readXlsxRows(opts.arquivo);
  console.log(`Linhas no Excel: ${rows.length.toLocaleString('pt-BR')}`);

  let batch = [];
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const doc = rowToDoc(row);
    if (!doc) {
      skipped++;
      continue;
    }
    batch.push(doc);
    if (batch.length >= BATCH) {
      await MedicoCnes.insertMany(batch, { ordered: false });
      inserted += batch.length;
      batch = [];
      if (inserted % 50000 === 0) {
        console.log(`  ${inserted.toLocaleString('pt-BR')} importados...`);
      }
    }
  }

  if (batch.length) {
    await MedicoCnes.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  await MedicoCnes.syncIndexes();
  const total = await MedicoCnes.countDocuments();
  console.log(`\nPronto: ${total.toLocaleString('pt-BR')} registros CNES no MongoDB`);
  console.log(`Ignorados (sem nome): ${skipped.toLocaleString('pt-BR')}`);
  console.log('\nReinicie o servidor (npm run dev) e teste /stats no Telegram.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
