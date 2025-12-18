import express from 'express';
import { cloudinaryUpload } from '../middlewares/cloudinaryUpload.js';
import { uploadExame, buscarExamesMedico, buscarExamesPaciente, downloadExame, uploadExameMedico, previewExame } from '../controllers/anexoExameController.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import { verificarConexaoPorExameId } from '../middlewares/verificarConexaoPorRegistroId.js';

const router = express.Router();

// Rotas com Cloudinary
router.post('/upload', 
    authPacienteMiddleware, 
    cloudinaryUpload('exames', 'raw', {
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
            const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/heic'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Tipo de arquivo não suportado. Use PDF, PNG, JPG, JPEG ou HEIC.'));
            }
        },
        fieldName: 'arquivo'
    }),
    uploadExame
);

router.post('/medico/upload', 
    authMiddleware, 
    cloudinaryUpload('exames', 'raw', {
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
            const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/heic'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Tipo de arquivo não suportado. Use PDF, PNG, JPG, JPEG ou HEIC.'));
            }
        },
        fieldName: 'arquivo'
    }),
    uploadExameMedico
);
router.get('/medico', authMiddleware, verificarConexaoMedicoPaciente, buscarExamesMedico);
router.get('/paciente', authPacienteMiddleware, buscarExamesPaciente);

// ROTA DE DOWNLOAD PROTEGIDO (verifica conexão ativa)
router.get('/download/:id', authMiddleware, verificarConexaoPorExameId, downloadExame);

// ROTA DE PREVIEW (serve o arquivo para visualização)
router.get('/preview/:id', authMiddleware, verificarConexaoPorExameId, previewExame);

export default router;
