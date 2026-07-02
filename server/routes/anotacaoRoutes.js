import express from 'express';
import { 
  salvarAnotacao, 
  buscarAnotacoesPorPaciente,
  buscarCategorias,
  buscarAnotacaoPorId,
  deleteAnotacao,
  buscarAnotacoesMedico
} from '../controllers/anotacaoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import { verificarConexaoPorAnotacaoId } from '../middlewares/verificarConexaoPorRegistroId.js';

const router = express.Router();

// Rotas estáticas antes de /:cpf (Express interpreta "categorias" como CPF se a ordem estiver errada)
router.get('/categorias', authMiddleware, requireValidatedDoctor, buscarCategorias);
router.get('/medico', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, buscarAnotacoesMedico);
router.get('/detalhe/:id', authMiddleware, requireValidatedDoctor, verificarConexaoPorAnotacaoId, buscarAnotacaoPorId);
router.post('/nova', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, salvarAnotacao);
router.delete('/:id', authMiddleware, requireValidatedDoctor, verificarConexaoPorAnotacaoId, deleteAnotacao);
router.get('/:cpf', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, buscarAnotacoesPorPaciente);

export default router;
