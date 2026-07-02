import express from 'express';
import { registrarPaciente, loginPaciente, mePaciente } from '../controllers/pacienteAuthController.js';
import { geoLockMiddleware } from '../middlewares/geoLockMiddleware.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';

const router = express.Router();

router.post('/register', geoLockMiddleware, registrarPaciente);
router.post('/login', geoLockMiddleware, loginPaciente);
router.get('/me', authPacienteMiddleware, mePaciente);

export default router;
