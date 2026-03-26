import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import { gerarInsightsPaciente, responderPergunta, traduzirTexto } from '../controllers/geminiController.js';

const router = express.Router();

// Rota para gerar insights do paciente usando Gemini AI
router.get('/insights/:cpf', authMiddleware, verificarConexaoMedicoPaciente, gerarInsightsPaciente);

// Rota para responder perguntas do médico sobre o paciente
router.post('/pergunta/:cpf', authMiddleware, verificarConexaoMedicoPaciente, responderPergunta);

// Rota para traduzir texto (ex.: conteúdo de registro clínico) para o idioma da interface
router.post('/translate', authMiddleware, traduzirTexto);

export default router;

