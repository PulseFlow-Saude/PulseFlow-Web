/**
 * Diagnóstico da API de consultas externa.
 * node scripts/test-consulta-api.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import { BOT_CONSULTA_API, consultaExterna } from '../lib/consultaExterna.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const host = new URL(BOT_CONSULTA_API.baseUrl).hostname;

console.log('=== Teste API Bot Consultas ===\n');
console.log('URL base:', process.env.CONSULTA_API_BASE_URL || BOT_CONSULTA_API.baseUrl);
console.log('Key:', process.env.CONSULTA_API_KEY || BOT_CONSULTA_API.apiKey);

try {
  const ips = await dns.resolve4(host);
  console.log(`DNS ${host}: OK →`, ips.join(', '));
} catch (e) {
  console.log(`DNS ${host}: FALHOU →`, e.code || e.message);
  console.log('\nO domínio não existe ou está fora do ar.');
  console.log('O bot Telegram não vai conseguir consultar com essa URL.');
  console.log('Peça a URL correta ao provedor da API e coloque em CONSULTA_API_BASE_URL\n');
  process.exit(1);
}

const r = await consultaExterna('nome', 'TESTE');
if (r.ok) {
  console.log('\nConsulta teste: OK');
  console.log(String(r.raw || r.formatted || '').slice(0, 400));
} else {
  console.log('\nConsulta teste: FALHOU');
  console.log(r.error);
  if (r.url) console.log('URL:', r.url);
  process.exit(1);
}
