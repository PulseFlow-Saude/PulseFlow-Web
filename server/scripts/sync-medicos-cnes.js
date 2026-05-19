/**
 * Baixa profissionais do DATASUS e grava no MongoDB (sem Excel manual).
 *
 *   npm run sync-medicos-cnes
 *   npm run sync-medicos-cnes -- --uf=SP
 *   npm run sync-medicos-cnes -- --ufs=SP,RJ --reset
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import { syncCnesFromDatasus, UFS_BR } from '../lib/cnesDatasusSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function parseArgs(argv) {
  const opts = { ufs: [], reset: false, competencia: '', limite: 0 };
  for (const arg of argv) {
    if (arg.startsWith('--uf=')) opts.ufs = [arg.slice(5).trim().toUpperCase()];
    else if (arg.startsWith('--ufs=')) {
      opts.ufs = arg
        .slice(6)
        .split(',')
        .map((u) => u.trim().toUpperCase())
        .filter((u) => UFS_BR.includes(u));
    } else if (arg === '--reset') opts.reset = true;
    else if (arg.startsWith('--competencia=')) opts.competencia = arg.slice(14).trim();
    else if (arg.startsWith('--limite=')) opts.limite = parseInt(arg.slice(9), 10) || 0;
  }
  return opts;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  await connectDB({ bulk: true });
  console.log(`Lotes de insert: ${process.env.CNES_SYNC_BATCH || 1500} (CNES_SYNC_BATCH)\n`);

  console.log('Fonte: https://cnes.datasus.gov.br (download automático)\n');

  const result = await syncCnesFromDatasus({
    ufs: opts.ufs.length ? opts.ufs : undefined,
    competencia: opts.competencia,
    resetAll: opts.reset,
    limite: opts.limite,
    onProgress: (msg) => console.log(msg)
  });

  console.log('\n--- Resumo ---');
  for (const [uf, n] of Object.entries(result.byUf)) {
    console.log(`${uf}: ${n.toLocaleString('pt-BR')}`);
  }
  console.log(`Total sync: ${result.total.toLocaleString('pt-BR')}`);
  console.log(`Total MongoDB: ${result.grandTotal.toLocaleString('pt-BR')}`);
  if (result.errors.length) {
    console.log('Erros:', result.errors);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
