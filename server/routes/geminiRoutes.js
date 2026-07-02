import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';
import { gerarInsightsPaciente, responderPergunta, responderPerguntaPaciente, traduzirTexto } from '../controllers/geminiController.js';

const router = express.Router();

// Chat Oryon Assist no app do paciente
router.post('/assist/chat', authPacienteMiddleware, responderPerguntaPaciente);

// Rota para gerar insights do paciente usando Gemini AI
router.get('/insights/:cpf', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, gerarInsightsPaciente);

// Rota para responder perguntas do médico sobre o paciente
router.post('/pergunta/:cpf', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, responderPergunta);

// Rota para traduzir texto (ex.: conteúdo de registro clínico) para o idioma da interface
router.post('/translate', authMiddleware, requireValidatedDoctor, traduzirTexto);

export default router;

