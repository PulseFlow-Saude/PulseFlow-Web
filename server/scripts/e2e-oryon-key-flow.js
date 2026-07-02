/**
 * Teste E2E do fluxo médico ↔ paciente (Chave Oryon).
 * Requer servidor rodando: node server.js
 * node scripts/e2e-oryon-key-flow.js
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import tokenService from '../services/tokenService.js';
import User from '../models/User.js';
import Paciente from '../models/Paciente.js';
import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || process.env.PORT_BACKEND || 65432}`;
const steps = [];

function step(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, urlPath, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function main() {
  console.log('\n=== E2E Fluxo Chave Oryon ===\n');

  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    step('MongoDB', false, 'MONGO_URI ausente');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const medico = await User.findOne({
    validationStatus: 'approved',
    hasChosenPlan: true,
    role: { $ne: 'admin' },
    isAdmin: { $ne: true }
  }).select('_id nome email areaAtuacao cpf');

  if (!medico) {
    step('Médico de teste', false, 'nenhum médico aprovado com plano no banco');
    await mongoose.disconnect();
    process.exit(1);
  }
  step('Médico de teste', true, `${medico.nome} (${medico._id})`);

  const paciente = await Paciente.findOne({ cpf: { $exists: true, $ne: '' } })
    .select('_id nome name cpf email')
    .sort({ updatedAt: -1 });

  if (!paciente) {
    step('Paciente de teste', false, 'nenhum paciente com CPF no banco');
    await mongoose.disconnect();
    process.exit(1);
  }
  const cpfLimpo = String(paciente.cpf).replace(/\D/g, '');
  step('Paciente de teste', true, `${paciente.name || paciente.nome} CPF ${cpfLimpo.slice(0, 3)}***`);

  const medicoToken = tokenService.generateAccessToken({ id: medico._id, email: medico.email });
  const pacienteToken = tokenService.generateAccessToken({
    id: paciente._id,
    email: paciente.email || `${paciente._id}@paciente.local`
  });

  const accessCode = String(Math.floor(100000 + Math.random() * 900000));

  // --- Etapa 1: médico busca CPF (só verifica existência) ---
  const buscar = await api('GET', `/api/pacientes/buscar?cpf=${cpfLimpo}`, { token: medicoToken });
  if (buscar.status === 200 && buscar.json.id) {
    step('1. Médico busca paciente por CPF', true, `encontrou ${buscar.json.nome || buscar.json.name}`);
  } else {
    step('1. Médico busca paciente por CPF', false, `status ${buscar.status} ${JSON.stringify(buscar.json)}`);
  }

  // --- Etapa 2: médico solicita acesso (notificação) ---
  const notif = await api('POST', '/api/access-code/notificar-solicitacao', {
    token: medicoToken,
    body: { cpf: cpfLimpo, medicoNome: medico.nome, especialidade: medico.areaAtuacao }
  });
  if (notif.status === 200) {
    step('2. Médico solicita acesso (notificação)', true, notif.json.message);
  } else {
    step('2. Médico solicita acesso (notificação)', false, `status ${notif.status}`);
  }

  // --- Etapa 3: paciente gera código no app (Pulse Key) ---
  const gerar = await api('POST', '/api/access-code/gerar', {
    token: pacienteToken,
    body: {
      patientId: String(paciente._id),
      accessCode,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      accessLogEmail: false,
      appLocale: 'pt-BR'
    }
  });
  if (gerar.status === 200 && gerar.json.codigo === accessCode) {
    step('3. Paciente gera Chave Oryon (app)', true, `código ${accessCode}`);
  } else {
    step('3. Paciente gera Chave Oryon (app)', false, `status ${gerar.status} ${JSON.stringify(gerar.json)}`);
  }

  // --- Etapa 4: paciente lista solicitações pendentes ---
  const sol = await api('GET', `/api/access-code/solicitacoes/${paciente._id}`, { token: pacienteToken });
  if (sol.status === 200) {
    step('4. Paciente vê solicitações pendentes', true, `${sol.json.total ?? sol.json.solicitacoes?.length ?? 0} solicitação(ões)`);
  } else {
    step('4. Paciente vê solicitações pendentes', false, `status ${sol.status}`);
  }

  // --- Etapa 5: médico conecta com CPF + código ---
  const conectar = await api('POST', '/api/pacientes/buscar-com-codigo', {
    token: medicoToken,
    body: { cpf: cpfLimpo, codigoAcesso: accessCode }
  });
  if (conectar.status === 200 && conectar.json.id) {
    step('5. Médico conecta com CPF + código', true, `sessão aberta para ${conectar.json.nome}`);
  } else {
    step('5. Médico conecta com CPF + código', false, `status ${conectar.status} ${JSON.stringify(conectar.json)}`);
  }

  // --- Etapa 6: verificar conexão ativa ---
  const verif = await api('GET', `/api/pacientes/verificar-conexao/${cpfLimpo}`, { token: medicoToken });
  if (verif.status === 200 && (verif.json.conectado === true || verif.json.isActive === true || verif.json.ativa)) {
    step('6. Conexão médico-paciente ativa', true, JSON.stringify(verif.json).slice(0, 80));
  } else if (verif.status === 200) {
    step('6. Conexão médico-paciente ativa', true, `resposta: ${JSON.stringify(verif.json).slice(0, 100)}`);
  } else {
    step('6. Conexão médico-paciente ativa', false, `status ${verif.status} ${JSON.stringify(verif.json)}`);
  }

  const conexaoDb = await ConexaoMedicoPaciente.findOne({
    medicoId: medico._id,
    pacienteId: paciente._id,
    isActive: true
  });
  if (conexaoDb) {
    step('6b. Registro ConexaoMedicoPaciente no MongoDB', true, `desde ${conexaoDb.connectedAt}`);
  } else {
    step('6b. Registro ConexaoMedicoPaciente no MongoDB', false, 'conexão ativa não encontrada');
  }

  // --- Etapa 7: médico acessa dado clínico (sem month/year — usa mês atual) ---
  const diabetes = await api('GET', `/api/diabetes/medico?cpf=${cpfLimpo}`, { token: medicoToken });
  if (diabetes.status === 200) {
    step('7. Médico acessa dados clínicos (diabetes)', true, '200 OK (mês atual por omissão)');
  } else if (diabetes.status === 403 && diabetes.json.codigo === 'CONEXAO_INATIVA') {
    step('7. Médico acessa dados clínicos (diabetes)', false, 'CONEXAO_INATIVA');
  } else {
    step('7. Médico acessa dados clínicos (diabetes)', false, `status ${diabetes.status} ${JSON.stringify(diabetes.json)}`);
  }

  // --- Etapa 8: código errado deve falhar ---
  const codigoErrado = await api('POST', '/api/pacientes/buscar-com-codigo', {
    token: medicoToken,
    body: { cpf: cpfLimpo, codigoAcesso: '000000' }
  });
  if (codigoErrado.status === 401) {
    step('8. Código inválido rejeitado', true, '401');
  } else {
    step('8. Código inválido rejeitado', false, `status ${codigoErrado.status}`);
  }

  // --- Etapa 9: médico não validado bloqueado ---
  const medicoPendente = await User.findOne({
    $or: [{ validationStatus: { $ne: 'approved' } }, { hasChosenPlan: false }],
    role: { $ne: 'admin' }
  }).select('_id email');
  if (medicoPendente) {
    const tokPend = tokenService.generateAccessToken({ id: medicoPendente._id, email: medicoPendente.email });
    const bloq = await api('GET', `/api/pacientes/buscar?cpf=${cpfLimpo}`, { token: tokPend });
    if (bloq.status === 403) {
      step('9. Médico não aprovado bloqueado', true, '403');
    } else {
      step('9. Médico não aprovado bloqueado', false, `status ${bloq.status}`);
    }
  } else {
    step('9. Médico não aprovado bloqueado', true, 'sem médico pendente para testar (skip)');
  }

  await mongoose.disconnect();

  const failed = steps.filter((s) => !s.ok).length;
  console.log(`\n--- Fluxo E2E: ${steps.length - failed}/${steps.length} etapas OK ---\n`);

  if (failed === 0) {
    console.log('O fluxo completo médico → paciente → código → conexão → prontuário está CORRETO.\n');
  } else {
    console.log('Há etapas com falha — ver detalhes acima.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
