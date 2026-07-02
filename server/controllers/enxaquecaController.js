// controllers/enxaquecaController.js
import Enxaqueca from '../models/Enxaqueca.js';
import Paciente from '../models/Paciente.js';
import { resolveMonthYearQuery } from '../utils/resolveMonthYearQuery.js';

// Paciente registra sua enxaqueca
export const registrarEnxaqueca = async (req, res) => {
  const { data, intensidade, duracao } = req.body;
  const pacienteId = req.user.id;

  try {
    const [ano, mes, dia] = data.split('-');
    const dataCorrigida = new Date(ano, mes - 1, dia, 12);

    const novoRegistro = new Enxaqueca({
      pacienteId: pacienteId,
      data: dataCorrigida,
      intensidade: String(intensidade),
      duracao: Number(duracao)
    });

    await novoRegistro.save();
    res.status(201).json({ message: 'Registro de enxaqueca salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar registro de enxaqueca:', error);
    res.status(500).json({ error: 'Erro ao salvar registro' });
  }
};

// Médico busca os dados de um paciente (CPF ou SSN via middleware)
export const buscarEnxaquecaMedico = async (req, res) => {
  const paciente = req.paciente;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const registros = await Enxaqueca.find({
      pacienteId: paciente._id.toString(),
      data: { $gte: startDate, $lt: endDate }
    }).sort({ data: 1 });

    const data = registros.map((r) => ({
      dia: new Date(r.data).getDate(),
      intensidade: r.intensidade,
      duracao: r.duracao
    }));

    res.json({ paciente: paciente.nome, data });
  } catch (error) {
    console.error('Erro ao buscar enxaqueca:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Paciente busca seus próprios dados
export const buscarEnxaquecaPaciente = async (req, res) => {
  const pacienteId = req.user.id;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    const registros = await Enxaqueca.find({
      pacienteId: pacienteId,
      data: { $gte: startDate, $lt: endDate }
    }).sort({ data: 1 });

    const data = registros.map(r => ({
      dia: new Date(r.data).getDate(),
      intensidade: r.intensidade,
      duracao: r.duracao
    }));

    res.json({ data });
  } catch (error) {
    console.error('Erro ao buscar dados do próprio paciente:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};