import express from 'express';
import { getCrises, getCrise, createCrise, updateCrise, deleteCrise, buscarCrisesMedico } from '../controllers/criseGastriteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import { verificarConexaoMedicoPaciente } from '../middlewares/verificarConexaoMedicoPaciente.js';
import { CriseGastrite } from '../models/criseGastriteModel.js';
import { findPacienteByIdentifier } from '../utils/patientIdentifier.js';

const router = express.Router();

// Aplica o middleware de autenticação em todas as rotas
router.use(authMiddleware);
router.use(requireValidatedDoctor);

// Rotas para crises de gastrite
router.get('/medico', verificarConexaoMedicoPaciente, buscarCrisesMedico);
router.get('/crises/:cpf', verificarConexaoMedicoPaciente, getCrises);
router.get('/crises/detalhes/:id', getCrise);
router.post('/crises', verificarConexaoMedicoPaciente, createCrise);
router.put('/crises/:id', updateCrise);
router.delete('/crises/:id', deleteCrise);

// Rota para obter detalhes de uma crise específica
router.get('/crises/:cpf/:id', verificarConexaoMedicoPaciente, async (req, res) => {
    try {
        const { cpf, id } = req.params;

        const paciente = await findPacienteByIdentifier(cpf);

        if (!paciente) {
            return res.status(404).json({ message: 'Paciente não encontrado' });
        }

        // Depois, encontrar a crise pelo ID e pelo ID do paciente
        const crise = await CriseGastrite.findOne({
            _id: id,
            paciente: paciente._id
        });

        if (!crise) {
            return res.status(404).json({ message: 'Crise não encontrada' });
        }

        res.json(crise);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar detalhes da crise' });
    }
});

export default router; 