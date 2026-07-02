/**
 * Smoke test: backend, rotas e integrações básicas.
 * node scripts/smoke-test-flow.js
 */
import dns from 'dns/promises';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(name, detail = '') {
  results.push({ name, ok: null, detail });
  console.log(`⚠️  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function testMongoDns() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    fail('MongoDB URI configurada', 'MONGO_URI ausente no .env');
    return false;
  }
  pass('MongoDB URI configurada', 'variável presente');
  try {
    const host = new URL(uri.replace('mongodb+srv://', 'https://')).hostname;
    await dns.resolve(host.includes('.') ? `_mongodb._tcp.${host}` : host, 'SRV').catch(async () => {
      await dns.resolve4(host);
    });
    pass('DNS MongoDB', `host resolvível (${host})`);
    return true;
  } catch (e) {
    fail('DNS MongoDB', e.message || String(e));
    return false;
  }
}

async function testAuthMiddlewareStatus() {
  const { authMiddleware } = await import('../middlewares/authMiddleware.js');
  let statusCode = null;
  const req = { header: () => 'Bearer token-invalido-xyz' };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };
  await authMiddleware(req, res, () => {});
  if (statusCode === 401) {
    pass('authMiddleware JWT inválido', 'retorna 401');
  } else {
    fail('authMiddleware JWT inválido', `esperado 401, recebido ${statusCode}`);
  }
}

function getRoutePaths(router) {
  return (router.stack || [])
    .filter((layer) => layer.route)
    .map((layer) => {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      const path = layer.route.path;
      return `${methods} ${path}`;
    });
}

async function testAnotacaoRouteOrder() {
  const anotacaoRoutes = (await import('../routes/anotacaoRoutes.js')).default;
  const paths = getRoutePaths(anotacaoRoutes);
  const categoriasIdx = paths.findIndex((p) => p.includes('/categorias'));
  const cpfIdx = paths.findIndex((p) => p.includes('/:cpf'));
  if (categoriasIdx === -1) {
    fail('Rota GET /categorias', 'não encontrada');
    return;
  }
  if (cpfIdx === -1) {
    fail('Rota GET /:cpf', 'não encontrada');
    return;
  }
  if (categoriasIdx < cpfIdx) {
    pass('Ordem anotacaoRoutes', '/categorias antes de /:cpf');
  } else {
    fail('Ordem anotacaoRoutes', '/:cpf vem antes de /categorias');
  }
}

async function testRequireValidatedDoctorOnClinicalRoutes() {
  const files = [
    '../routes/diabetesRoutes.js',
    '../routes/enxaquecaRoutes.js',
    '../routes/anotacaoRoutes.js',
    '../routes/geminiRoutes.js',
    '../routes/resumoConsultaRoutes.js'
  ];
  for (const file of files) {
    const mod = await import(file);
    const router = mod.default;
    const stackText = JSON.stringify(getRoutePaths(router));
    const source = await import('fs').then((fs) =>
      fs.promises.readFile(path.join(__dirname, file.replace('../', '../')), 'utf8')
    );
    if (source.includes('requireValidatedDoctor')) {
      pass(`requireValidatedDoctor em ${path.basename(file)}`);
    } else {
      fail(`requireValidatedDoctor em ${path.basename(file)}`, 'middleware ausente');
    }
    void stackText;
  }
}

async function testAccessCodeNotifyRoute() {
  const accessCodeRoutes = (await import('../routes/accessCodeRoutes.js')).default;
  const paths = getRoutePaths(accessCodeRoutes);
  const found = paths.some((p) => p.includes('/notificar-acesso-email'));
  if (found) pass('Rota notificar-acesso-email', 'POST /notificar-acesso-email registrada');
  else fail('Rota notificar-acesso-email', 'não encontrada');
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = request.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function testLiveServer(port = 65432) {
  try {
    const { status, body } = await httpGet(`http://127.0.0.1:${port}/api/health`);
    if (status === 200 && body.includes('"status":"ok"')) {
      pass('Servidor HTTP vivo', `porta ${port} /api/health OK`);
      return true;
    }
    fail('Servidor HTTP vivo', `status ${status}`);
  } catch {
    warn('Servidor HTTP vivo', `nada escutando na porta ${port}`);
    return false;
  }
}

async function testLiveApiWithoutAuth(port = 65432) {
  try {
    const { status } = await httpGet(`http://127.0.0.1:${port}/api/anotacoes/categorias`);
    if (status === 401) {
      pass('GET /api/anotacoes/categorias sem token', '401 (rota alcançada, não confundida com CPF)');
    } else if (status === 404) {
      fail('GET /api/anotacoes/categorias sem token', '404 — rota pode estar errada');
    } else {
      warn('GET /api/anotacoes/categorias sem token', `status ${status}`);
    }
  } catch (e) {
    warn('GET /api/anotacoes/categorias', e.message);
  }
}

async function testPageGuardsModule() {
  const fs = await import('fs');
  const guardsPath = path.join(__dirname, '..', '..', 'client', 'public', 'js', 'utils', 'pageGuards.js');
  const authPath = path.join(__dirname, '..', '..', 'client', 'public', 'js', 'authGuard.js');
  if (fs.existsSync(guardsPath) && fs.existsSync(authPath)) {
    pass('Frontend guards', 'pageGuards.js e authGuard.js presentes');
  } else {
    fail('Frontend guards', 'arquivos ausentes em client/public/js');
  }
}

async function testJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    pass('JWT_SECRET', 'configurado');
  } else {
    fail('JWT_SECRET', 'ausente ou muito curto');
  }
}

console.log('\n=== PulseFlow Smoke Test ===\n');

await testJwtSecret();
const mongoOk = await testMongoDns();
await testAuthMiddlewareStatus();
await testAnotacaoRouteOrder();
await testRequireValidatedDoctorOnClinicalRoutes();
await testAccessCodeNotifyRoute();
await testPageGuardsModule();

const serverUp = await testLiveServer();
if (serverUp) {
  await testLiveApiWithoutAuth();
} else if (mongoOk) {
  warn('Servidor', 'Mongo OK mas servidor não está rodando — execute: cd server && npm start');
} else {
  warn('Servidor', 'não iniciado (MongoDB indisponível impede connectDB)');
}

const failed = results.filter((r) => r.ok === false).length;
const passed = results.filter((r) => r.ok === true).length;
const warnings = results.filter((r) => r.ok === null).length;

console.log(`\n--- Resumo: ${passed} OK, ${failed} FALHAS, ${warnings} AVISOS ---\n`);
process.exit(failed > 0 ? 1 : 0);
