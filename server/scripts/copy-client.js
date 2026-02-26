// Script cross-platform para copiar pasta client (funciona no Windows e Linux/Mac)
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = join(__dirname, '..');
const clientSource = join(serverDir, '..', 'client');
const clientDest = join(serverDir, 'client');

try {
  if (!existsSync(clientSource)) {
    console.log('Pasta client não encontrada, pulando postinstall.');
    process.exit(0);
  }
  if (!existsSync(clientDest)) {
    mkdirSync(clientDest, { recursive: true });
  }
  cpSync(clientSource, clientDest, { recursive: true });
  console.log('Client copiado com sucesso.');
} catch (err) {
  console.warn('Aviso no postinstall (não crítico):', err.message);
  process.exit(0);
}
