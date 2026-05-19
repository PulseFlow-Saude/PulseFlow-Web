/**
 * Importa telefone/e-mail públicos das UNIDADES CNES (DATASUS).
 * Baixe "Estabelecimentos" no portal CNES e passe o CSV.
 *
 * Colunas aceitas (qualquer combinação):
 *   CO_CNES / codigoCnes / cnes
 *   NU_TELEFONE / telefone
 *   NO_EMAIL / email
 *   NO_FANTASIA / nome
 *   CO_UF / uf   NO_MUNICIPIO / municipio
 *
 *   npm run import-cnes-estabelecimentos -- --arquivo=estabelecimentos.csv --reset
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import CnesEstabelecimento from '../models/CnesEstabelecimento.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function readCsv(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(sep);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
      row[h.toUpperCase()] = vals[i] ?? '';
    });
    return row;
  });
}

async function run() {
  const arquivo = process.argv.find((a) => a.startsWith('--arquivo='))?.slice(10);
  const reset = process.argv.includes('--reset');
  if (!arquivo) {
    console.error('Use: --arquivo=estabelecimentos.csv');
    process.exit(1);
  }

  await connectDB();
  if (reset) await CnesEstabelecimento.deleteMany({});

  const rows = readCsv(arquivo);
  let ok = 0;
  const batch = [];
  const BATCH = 5000;

  for (const row of rows) {
    const codigoCnes = onlyDigits(pick(row, 'CO_CNES', 'co_cnes', 'codigoCnes', 'CNES', 'cnes'));
    if (!codigoCnes) continue;
    const telefone = onlyDigits(pick(row, 'NU_TELEFONE', 'nu_telefone', 'telefone', 'TELEFONE'));
    const email = pick(row, 'NO_EMAIL', 'no_email', 'email', 'EMAIL').toLowerCase();
    if (!telefone && !email) continue;

    batch.push({
      codigoCnes,
      nome: pick(row, 'NO_FANTASIA', 'NO_RAZAO_SOCIAL', 'nome'),
      telefone,
      email,
      uf: pick(row, 'CO_UF', 'SG_UF', 'uf').slice(0, 2),
      municipio: pick(row, 'NO_MUNICIPIO', 'municipio')
    });

    if (batch.length >= BATCH) {
      for (const doc of batch) {
        await CnesEstabelecimento.updateOne({ codigoCnes: doc.codigoCnes }, { $set: doc }, { upsert: true });
        ok++;
      }
      batch.length = 0;
      if (ok % 50000 === 0) console.log(ok.toLocaleString('pt-BR'), '...');
    }
  }

  for (const doc of batch) {
    await CnesEstabelecimento.updateOne({ codigoCnes: doc.codigoCnes }, { $set: doc }, { upsert: true });
    ok++;
  }

  console.log('Unidades com tel/e-mail:', ok);
  console.log('Total coleção:', await CnesEstabelecimento.countDocuments());
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
