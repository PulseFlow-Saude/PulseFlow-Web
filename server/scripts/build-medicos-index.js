/**
 * Cria índice SQLite para o bot do Telegram a partir do Excel/CSV exportado.
 *
 * Uso:
 *   node scripts/build-medicos-index.js --arquivo=medicos-brasil.xlsx
 *   node scripts/build-medicos-index.js --arquivo=medicos-brasil.csv
 *   node scripts/build-medicos-index.js --arquivo=medicos-brasil.xlsx --plataforma
 *
 * --plataforma  Inclui também médicos cadastrados na PulseFlow (tem CPF, e-mail, telefone).
 * --reset       Apaga índice anterior antes de importar.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  DEFAULT_DB_PATH,
  openMedicosDb,
  insertMedicoBatch,
  mapRowToRecord,
  countMedicos
} from '../lib/medicosIndex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function parseArgs(argv) {
  const opts = { arquivo: '', plataforma: false, reset: false, db: DEFAULT_DB_PATH };
  for (const arg of argv) {
    if (arg.startsWith('--arquivo=')) opts.arquivo = arg.slice(10).trim();
    else if (arg === '--plataforma') opts.plataforma = true;
    else if (arg === '--reset') opts.reset = true;
    else if (arg.startsWith('--db=')) opts.db = arg.slice(5).trim();
  }
  if (!opts.arquivo && !opts.plataforma) {
    console.error('Informe --arquivo=medicos-brasil.xlsx e/ou --plataforma');
    process.exit(1);
  }
  return opts;
}

async function readRowsFromFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Arquivo não encontrado: ${abs}`);

  if (/\.xlsx?$/i.test(abs)) {
    const { read, utils } = await import('xlsx');
    // Arquivos grandes (ex.: medicos-sp.xlsx) precisam de dense:true
    const wb = read(abs, { type: 'file', dense: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return utils.sheet_to_json(sheet, { defval: '' });
  }

  const text = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(sep);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

async function importFromArquivo(db, filePath) {
  console.log('Importando arquivo:', filePath);
  const rows = await readRowsFromFile(filePath);
  const batch = [];
  let n = 0;
  for (const row of rows) {
    const rec = mapRowToRecord(row, 'cnes');
    if (!rec.nome && !rec.cpf && !rec.cns && !rec.crm) continue;
    batch.push(rec);
    if (batch.length >= 5000) {
      insertMedicoBatch(db, batch);
      n += batch.length;
      batch.length = 0;
      if (n % 50000 === 0) console.log(`  ${n.toLocaleString('pt-BR')} registros...`);
    }
  }
  if (batch.length) {
    insertMedicoBatch(db, batch);
    n += batch.length;
  }
  console.log(`  CNES/arquivo: ${n.toLocaleString('pt-BR')} registros`);
  return n;
}

async function importFromPlataforma(db) {
  const connectDB = (await import('../config/db.js')).default;
  const { default: User } = await import('../models/User.js');
  const { filterUsersWhoAreNotAdmins } = await import('../utils/userAdminFlags.js');

  await connectDB();
  const users = await User.find(filterUsersWhoAreNotAdmins())
    .select(
      'nome email cpf crm crmUf areaAtuacao telefonePessoal telefoneConsultorio cidade estado country'
    )
    .lean();

  const batch = users.map((u) =>
    mapRowToRecord(
      {
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        crm: u.crm,
        crmUf: u.crmUf,
        areaAtuacao: u.areaAtuacao,
        telefone: u.telefonePessoal,
        telefone2: u.telefoneConsultorio,
        municipio: u.cidade,
        uf: u.estado || u.country
      },
      'pulseflow'
    )
  );

  insertMedicoBatch(db, batch);
  console.log(`  PulseFlow: ${batch.length.toLocaleString('pt-BR')} registros`);
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  return batch.length;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.reset && fs.existsSync(opts.db)) fs.unlinkSync(opts.db);

  const db = openMedicosDb(opts.db);
  if (opts.arquivo) await importFromArquivo(db, opts.arquivo);
  if (opts.plataforma) await importFromPlataforma(db);

  const total = countMedicos(db);
  db.close();
  console.log(`\nÍndice pronto: ${opts.db}`);
  console.log(`Total no banco: ${total.toLocaleString('pt-BR')} registros`);
  console.log('\nInicie o bot: npm run telegram-medicos-bot');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
