import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import {
  processarAudioConsulta,
  buscarResumosPorPaciente,
  buscarResumoPorId
} from '../controllers/resumoConsultaController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configurar multer para upload de áudio
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/audio');
    // Criar diretório se não existir
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas arquivos de áudio
    const allowedMimes = [
      'audio/webm',
      'audio/mp3',
      'audio/wav',
      'audio/m4a',
      'audio/ogg',
      'audio/mpeg',
      'audio/x-m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas arquivos de áudio são aceitos.'));
    }
  }
});

// Rota para processar áudio de consulta
// IMPORTANTE: multer deve vir ANTES do verificarConexaoMedicoPaciente para que req.body seja populado
router.post(
  '/processar',
  authMiddleware,
  upload.single('audio'),
  verificarConexaoMedicoPaciente,
  processarAudioConsulta
);

// Rota para buscar resumos de um paciente
router.get(
  '/paciente',
  authMiddleware,
  verificarConexaoMedicoPaciente,
  buscarResumosPorPaciente
);

// Rota para buscar um resumo específico
router.get(
  '/:id',
  authMiddleware,
  buscarResumoPorId
);

export default router;

