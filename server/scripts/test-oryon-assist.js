/**
 * Teste do Oryon Assist (POST /api/gemini/assist/chat)
 * node scripts/test-oryon-assist.js [baseUrl]
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import tokenService from '../services/tokenService.js';
import Paciente from '../models/Paciente.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE = process.argv[2] || `http://127.0.0.1:${process.env.PORT || process.env.PORT_BACKEND || 65432}`;

async function main() {
  console.log('\n=== Teste Oryon Assist IA ===\n');
  console.log('Base URL:', BASE);

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    console.log('❌ GEMINI_API_KEY não configurada no .env');
    process.exit(1);
  }
  console.log('✅ GEMINI_API_KEY presente');

  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    console.log('❌ MONGO_URI ausente');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const paciente = await Paciente.findOne({ cpf: { $exists: true, $ne: '' } })
    .select('_id nome name cpf email')
    .sort({ updatedAt: -1 });

  if (!paciente) {
    console.log('❌ Nenhum paciente encontrado no banco');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✅ Paciente: ${paciente.name || paciente.nome} (${paciente._id})`);

  const token = tokenService.generateAccessToken({
    id: paciente._id,
    email: paciente.email || `${paciente._id}@paciente.local`,
  });

  const pergunta = 'Faça um resumo breve da minha saúde com base nos meus registros.';

  const started = Date.now();
  const res = await fetch(`${BASE}/api/gemini/assist/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pergunta, historico: [], lang: 'pt-BR' }),
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  console.log(`\nHTTP ${res.status} (${elapsed}s)`);

  if (res.status === 200 && json.success && json.resposta) {
    console.log('✅ IA FUNCIONAL — resposta recebida do Gemini\n');
    console.log('--- Resposta (trecho) ---');
    console.log(String(json.resposta).slice(0, 800));
    if (json.resposta.length > 800) console.log('\n... (truncado)');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('❌ Falha no teste da IA');
  console.log(JSON.stringify(json, null, 2));
  await mongoose.disconnect();
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
