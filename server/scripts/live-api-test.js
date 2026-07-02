/**
 * Testes HTTP ao vivo contra o backend (servidor deve estar rodando).
 * node scripts/live-api-test.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || process.env.PORT_BACKEND || 65432}`;
const results = [];

function ok(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name} — ${detail}`);
}
function bad(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name} — ${detail}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

console.log(`\n=== Live API Tests (${BASE}) ===\n`);

// 1. Health
const health = await req('GET', '/api/health');
if (health.status === 200 && health.json.status === 'ok') ok('Health check', '200 OK');
else bad('Health check', `status ${health.status}`);

// 2. Sem token → 401
const noToken = await req('GET', '/api/anotacoes/categorias');
if (noToken.status === 401) ok('Anotações/categorias sem token', '401');
else bad('Anotações/categorias sem token', `status ${noToken.status} body=${JSON.stringify(noToken.json)}`);

// 3. Token inválido → 401 (não 400)
const badToken = await req('GET', '/api/anotacoes/categorias', { token: 'invalido' });
if (badToken.status === 401) ok('JWT inválido em categorias', '401');
else bad('JWT inválido em categorias', `status ${badToken.status}`);

// 4. Rota diabetes sem token
const diabetes = await req('GET', '/api/diabetes/medico?cpf=00000000000');
if (diabetes.status === 401) ok('Diabetes/medico sem token', '401');
else bad('Diabetes/medico sem token', `status ${diabetes.status}`);

// 5. Access code notify route exists
const notify = await req('POST', '/api/access-code/notificar-acesso-email', { body: { patientId: 'test' } });
if (notify.status === 401) ok('notificar-acesso-email sem token', '401 (rota existe)');
else if (notify.status === 404) bad('notificar-acesso-email', '404 rota não encontrada');
else ok('notificar-acesso-email sem token', `status ${notify.status}`);

// 6. Login inválido
const login = await req('POST', '/api/auth/login', { body: { email: 'naoexiste@test.com', senha: 'wrong' } });
if (login.status === 401 || login.status === 400) ok('Login credenciais inválidas', `status ${login.status}`);
else bad('Login credenciais inválidas', `status ${login.status}`);

// 7. Pacientes buscar sem token
const pac = await req('GET', '/api/pacientes/buscar?cpf=12345678901');
if (pac.status === 401) ok('Pacientes/buscar sem token', '401');
else bad('Pacientes/buscar sem token', `status ${pac.status}`);

// 8. Frontend static (via backend serving client)
const html = await fetch(`${BASE}/client/views/login.html`);
if (html.status === 200) ok('Serve login.html', '200');
else bad('Serve login.html', `status ${html.status}`);

const guardJs = await fetch(`${BASE}/client/public/js/authGuard.js`);
if (guardJs.status === 200) ok('Serve authGuard.js', '200');
else bad('Serve authGuard.js', `status ${guardJs.status}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- ${results.length - failed}/${results.length} testes HTTP passaram ---\n`);
process.exit(failed > 0 ? 1 : 0);
