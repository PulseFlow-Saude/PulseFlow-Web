/**
 * Baixa estabelecimentos (clínicas, hospitais…) do DATASUS → MongoDB.
 *
 *   npm run sync-cnes-estabelecimentos
 *   npm run sync-cnes-estabelecimentos -- --uf=SP
 *   npm run sync-cnes-estabelecimentos -- --ufs=SP,RJ
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import { syncEstabelecimentosFromDatasus, UFS_BR } from '../lib/cnesEstabelecimentosSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function parseArgs(argv) {
  const opts = { ufs: ['SP'] };
  for (const arg of argv) {
    if (arg.startsWith('--uf=')) opts.ufs = [arg.slice(5).trim().toUpperCase()];
    else if (arg.startsWith('--ufs=')) {
      opts.ufs = arg
        .slice(6)
        .split(',')
        .map((u) => u.trim().toUpperCase())
        .filter((u) => UFS_BR.includes(u));
    }
  }
  return opts;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  await connectDB({ bulk: true });
  console.log('Fonte: DATASUS — estabelecimentos (nome + endereço; tel/e-mail se existir no arquivo)\n');
  console.log('UFs:', opts.ufs.join(', '), '\n');

  const r = await syncEstabelecimentosFromDatasus({
    ufs: opts.ufs,
    onProgress: (m) => console.log(m)
  });

  console.log(`\nImportados nesta execução: ${r.total.toLocaleString('pt-BR')}`);
  console.log(`Total na coleção: ${r.grandTotal.toLocaleString('pt-BR')}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
