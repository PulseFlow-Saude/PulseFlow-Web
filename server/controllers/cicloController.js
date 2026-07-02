import CicloMenstrual from '../models/CicloMenstrual.js';
import Paciente from '../models/Paciente.js';
import { findPacienteByIdentifier } from '../utils/patientIdentifier.js';

export const salvarCiclo = async (req, res) => {
  try {
    const { cpf, dataInicio, dataFim } = req.body;
    const paciente = req.paciente || (await findPacienteByIdentifier(cpf));

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const novoCiclo = new CicloMenstrual({
      pacienteId: paciente._id,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
    });

    await novoCiclo.save();
    res.status(201).json({ message: 'Ciclo salvo com sucesso!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno ao salvar ciclo' });
  }
};

export const listarCiclos = async (req, res) => {
  try {
    const paciente =
      req.paciente || (await findPacienteByIdentifier(req.params.cpf));

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const ciclos = await CicloMenstrual.find({ pacienteId: paciente._id })
      .populate('pacienteId', 'name nome cpf email')
      .sort({ dataInicio: -1 });

    res.status(200).json(ciclos);
  } catch (err) {
    res.status(500).json({ message: 'Erro interno ao buscar ciclos' });
  }
};

export const buscarCiclosMedico = async (req, res) => {
  try {
    const paciente = req.paciente;
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const ciclos = await CicloMenstrual.find({ pacienteId: paciente._id })
      .populate('pacienteId', 'name nome cpf email')
      .sort({ dataInicio: -1 });

    res.json(ciclos);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
