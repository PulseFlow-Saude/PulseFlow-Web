// controllers/insoniaController.js
import Insonia from '../models/Insonia.js';
import Paciente from '../models/Paciente.js';
import { resolveMonthYearQuery } from '../utils/resolveMonthYearQuery.js';

// Paciente registra dados de sono
export const registrarInsonia = async (req, res) => {
  const { data, valor } = req.body;
  const pacienteId = req.user.id;

  try {
    const [ano, mes, dia] = data.split('-');
    const dataCorrigida = new Date(ano, mes - 1, dia, 12);

    const novoRegistro = new Insonia({
      pacienteId: pacienteId,
      data: dataCorrigida,
      valor: Number(valor)
    });

    await novoRegistro.save();
    res.status(201).json({ message: 'Registro de sono salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar sono:', error);
    res.status(500).json({ message: 'Erro ao registrar sono' });
  }
};

// Médico busca dados de sono (CPF ou SSN via middleware)
export const buscarInsoniaMedico = async (req, res) => {
  const paciente = req.paciente;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const registros = await Insonia.find({
      pacienteId: paciente._id.toString(),
      data: { $gte: startDate, $lt: endDate }
    }).sort({ data: 1 });

    const data = registros.map(r => ({
      dia: new Date(r.data).getDate(),
      valor: r.valor
    }));

    res.json({ paciente: paciente.nome, data });
  } catch (error) {
    console.error('Erro ao buscar dados de sono:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Paciente busca seus próprios dados
export const buscarInsoniaPaciente = async (req, res) => {
  const pacienteId = req.user.id;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    const registros = await Insonia.find({
      pacienteId: pacienteId,
      data: { $gte: startDate, $lt: endDate }
    }).sort({ data: 1 });

    const data = registros.map(r => ({
      dia: new Date(r.data).getDate(),
      valor: r.valor
    }));

    res.json({ data });
  } catch (error) {
    console.error('Erro ao buscar dados de sono do paciente:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
