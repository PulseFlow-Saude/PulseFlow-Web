/**
 * Exporta médicos cadastrados na plataforma (MongoDB / coleção users).
 * Para dados públicos externos, use: fetch-medicos.js
 *
 * Uso (a partir de PulseFlow-Web/server):
 *   node scripts/export-medicos-plataforma.js
 *   node scripts/export-medicos-plataforma.js --status=approved
 *   node scripts/export-medicos-plataforma.js --format=csv --output=medicos.csv
 */
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import { filterUsersWhoAreNotAdmins } from '../utils/userAdminFlags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SELECT_FIELDS =
  'nome email cpf crm crmUf country npi medicalLicenseNumber medicalLicenseState areaAtuacao telefonePessoal telefoneConsultorio cidade estado validationStatus validationDeniedReason validationSubmittedAt hasChosenPlan planChoice paymentStatus createdAt updatedAt';

function parseArgs(argv) {
  const opts = { status: '', q: '', limit: 1000, format: 'json', output: '', stats: false };
  for (const arg of argv) {
    if (arg === '--stats') opts.stats = true;
    else if (arg.startsWith('--status=')) opts.status = arg.slice(9).trim();
    else if (arg.startsWith('--q=')) opts.q = arg.slice(4).trim();
    else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--format=')) opts.format = arg.slice(9).trim().toLowerCase();
    else if (arg.startsWith('--output=')) opts.output = arg.slice(9).trim();
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 10).join('\n'));
      process.exit(0);
    }
  }
  return opts;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter({ status, q }) {
  const and = [filterUsersWhoAreNotAdmins()];
  if (status) and.push({ validationStatus: status });
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ nome: rx }, { email: rx }, { crm: rx }, { cpf: rx }, { npi: rx }, { medicalLicenseNumber: rx }] });
  }
  return { $and: and };
}

function isUserUS(doc) {
  const c = String(doc.country ?? '').trim().toUpperCase();
  if (c === 'US') return true;
  if (c === 'BR') return false;
  const npi = String(doc.npi || '').replace(/\D/g, '');
  return npi.length === 10 && !String(doc.crm || '').trim();
}

function normalizeDoctor(doc) {
  return {
    ...doc,
    validationStatus: doc.validationStatus || 'pending_complement',
    country: doc.country || (isUserUS(doc) ? 'US' : 'BR')
  };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  await connectDB();
  const filter = buildFilter(opts);

  if (opts.stats) {
    const rows = await User.aggregate([
      { $match: filter },
      { $group: { _id: '$validationStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const payload = { total, byStatus: Object.fromEntries(rows.map((r) => [r._id || 'pending_complement', r.count])) };
    const text = JSON.stringify(payload, null, 2);
    if (opts.output) fs.writeFileSync(opts.output, text, 'utf8');
    else console.log(text);
    process.exit(0);
  }

  let query = User.find(filter).select(SELECT_FIELDS).sort({ validationSubmittedAt: -1, createdAt: -1 }).lean();
  if (opts.limit > 0) query = query.limit(opts.limit);

  const medicos = (await query).map((d) => {
    const { _id, ...rest } = normalizeDoctor(d);
    return { id: String(_id), ...rest };
  });

  const output =
    opts.format === 'csv'
      ? toCsv(medicos)
      : JSON.stringify({ total: medicos.length, items: medicos }, null, 2);

  if (opts.output) {
    fs.writeFileSync(opts.output, output, 'utf8');
    console.log(`${medicos.length} médico(s) exportado(s) para ${opts.output}`);
  } else {
    console.log(output);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
