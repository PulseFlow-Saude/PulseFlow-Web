/**
 * Importa planilha de contatos com base legal (LGPD).
 *
 * CSV (separador ; ou ,):
 *   nome,cpf,email,telefone,crm,crmUf,uf,municipio,baseLegal,fonte
 *
 * baseLegal: ex. consentimento, contrato, interesse_legitimo, cadastro_pulseflow
 *
 *   npm run import-medicos-contatos -- --arquivo=contatos-medicos.csv --reset
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import MedicoContato from '../models/MedicoContato.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const opts = { arquivo: '', reset: false };
  for (const arg of argv) {
    if (arg.startsWith('--arquivo=')) opts.arquivo = arg.slice(10).trim();
    else if (arg === '--reset') opts.reset = true;
  }
  if (!opts.arquivo) {
    console.error('Use: --arquivo=contatos-medicos.csv');
    process.exit(1);
  }
  return opts;
}

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function readCsv(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(sep);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  await connectDB();
  if (opts.reset) await MedicoContato.deleteMany({});

  const rows = readCsv(opts.arquivo);
  let ok = 0;
  let skip = 0;

  for (const row of rows) {
    const baseLegal = row.baselegal || row.base_legal || row['base legal'];
    if (!baseLegal) {
      skip++;
      continue;
    }
    const doc = {
      nome: row.nome || '',
      cpf: onlyDigits(row.cpf),
      email: (row.email || '').toLowerCase(),
      telefone: onlyDigits(row.telefone || row.tel),
      crm: onlyDigits(row.crm),
      crmUf: (row.crmuf || row.crm_uf || '').toUpperCase().slice(0, 2),
      uf: (row.uf || '').toUpperCase().slice(0, 2),
      municipio: row.municipio || row.cidade || '',
      baseLegal,
      fonte: row.fonte || 'importacao'
    };
    if (!doc.nome && !doc.crm && !doc.cpf && !doc.email) {
      skip++;
      continue;
    }
    await MedicoContato.create(doc);
    ok++;
  }

  console.log(`Importados: ${ok} | Ignorados: ${skip}`);
  console.log('Total no banco:', await MedicoContato.countDocuments());
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
