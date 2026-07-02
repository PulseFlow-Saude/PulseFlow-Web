import express from 'express';
import { salvarCiclo, listarCiclos, buscarCiclosMedico } from '../controllers/cicloController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';

const router = express.Router();

router.post('/novo', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, salvarCiclo);
router.get('/medico', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, buscarCiclosMedico);
router.get('/:cpf', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, listarCiclos);

export default router;
