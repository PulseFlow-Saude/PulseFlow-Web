import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import {
    criarRegistro,
    obterRegistros,
    obterRegistro,
    atualizarRegistro,
    excluirRegistro,
    buscarMenstruacaoMedico
} from '../controllers/menstruacaoController.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas para registros de menstruação
router.post('/', verificarConexaoMedicoPaciente, criarRegistro);
router.get('/medico', verificarConexaoMedicoPaciente, buscarMenstruacaoMedico);
router.get('/:cpf', verificarConexaoMedicoPaciente, obterRegistros);
router.get('/:cpf/:id', verificarConexaoMedicoPaciente, obterRegistro);
router.put('/:cpf/:id', verificarConexaoMedicoPaciente, atualizarRegistro);
router.delete('/:cpf/:id', verificarConexaoMedicoPaciente, excluirRegistro);

export default router; 