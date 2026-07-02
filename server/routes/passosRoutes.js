import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import {
  registrarPassos,
  buscarPassosMedico,
  buscarPassosPaciente
} from '../controllers/passosController.js';

const router = express.Router();

router.post('/register', authPacienteMiddleware, registrarPassos);
router.get('/medico', authMiddleware, requireValidatedDoctor, verificarConexaoMedicoPaciente, buscarPassosMedico);
router.get('/paciente', authPacienteMiddleware, buscarPassosPaciente);

export default router;



