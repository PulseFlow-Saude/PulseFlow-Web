import express from 'express';
import { registrarPaciente, loginPaciente } from '../controllers/pacienteAuthController.js';
import { geoLockMiddleware } from '../middlewares/geoLockMiddleware.js';

const router = express.Router();

router.post('/register', geoLockMiddleware, registrarPaciente);
router.post('/login', geoLockMiddleware, loginPaciente);

export default router;
