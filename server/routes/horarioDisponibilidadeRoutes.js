import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import {
  criarHorario,
  listarHorarios,
  buscarHorario,
  atualizarHorario,
  deletarHorario,
  obterHorariosDisponiveis,
  listarHorariosMedico
} from '../controllers/horarioDisponibilidadeController.js';

const router = express.Router();

// Rotas públicas (sem autenticação)
router.get('/medico/:medicoId', listarHorariosMedico);
router.get('/disponiveis/:medicoId', obterHorariosDisponiveis);

// Rotas do médico: autenticação e conta aprovada
router.use(authMiddleware);
router.use(requireValidatedDoctor);

// Criar novo horário de disponibilidade
router.post('/', criarHorario);

// Listar horários do médico
router.get('/', listarHorarios);

// Buscar horário por ID
router.get('/:id', buscarHorario);

// Atualizar horário
router.put('/:id', atualizarHorario);

// Deletar horário
router.delete('/:id', deletarHorario);

export default router;

