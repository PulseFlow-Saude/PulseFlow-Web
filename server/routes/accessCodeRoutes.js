import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { 
  gerarCodigoAcesso, 
  verificarCodigoAcesso, 
  testConnection, 
  notificarSolicitacaoAcesso,
  buscarSolicitacoesPendentes,
  marcarSolicitacaoVisualizada,
  buscarTodasSolicitacoes
} from '../controllers/accessCodeController.js';

const router = express.Router();

// Gerar código de acesso para o paciente
router.post('/gerar', authPacienteMiddleware, gerarCodigoAcesso);

// Verificar se código de acesso é válido
router.post('/verificar', authPacienteMiddleware, verificarCodigoAcesso);

// Notificar paciente sobre solicitação de acesso médico
router.post('/notificar-solicitacao', authMiddleware, requireValidatedDoctor, notificarSolicitacaoAcesso);

// Buscar solicitações pendentes de um paciente
router.get('/solicitacoes/:patientId', authPacienteMiddleware, buscarSolicitacoesPendentes);

// Marcar solicitação como visualizada
router.put('/solicitacoes/:solicitacaoId/visualizar', authPacienteMiddleware, marcarSolicitacaoVisualizada);

// Buscar todas as solicitações de acesso do médico logado
router.get('/solicitacoes', authMiddleware, requireValidatedDoctor, buscarTodasSolicitacoes);

// Teste de conexão
router.get('/test', authMiddleware, requireValidatedDoctor, testConnection);

export default router;
