import AnotacaoMedica from '../models/AnotacaoMedica.js';
import Paciente from '../models/Paciente.js';
import { findPacienteByIdentifier } from '../utils/patientIdentifier.js';

export const salvarAnotacao = async (req, res) => {
  try {
    const { cpf, titulo, data, categoria, tipoConsulta, medico, anotacao } = req.body;
    const paciente = req.paciente || (cpf ? await findPacienteByIdentifier(cpf) : null);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const novaAnotacao = new AnotacaoMedica({
      pacienteId: paciente._id,
      titulo,
      data: new Date(data),
      categoria,
      tipoConsulta,
      medico,
      anotacao
    });

    await novaAnotacao.save();
    res.status(201).json({ message: 'Anotação salva com sucesso!' });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno ao salvar anotação' });
  }
};

export const buscarAnotacoesPorPaciente = async (req, res) => {
  try {
    const paciente = req.paciente || (await findPacienteByIdentifier(req.params.cpf));

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const anotacoes = await AnotacaoMedica.find({ pacienteId: paciente._id })
      .populate('pacienteId', 'name nome cpf email')
      .sort({ data: -1 });

    res.status(200).json(anotacoes);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno ao buscar anotações' });
  }
};

export const buscarCategorias = async (req, res) => {
  try {
    const categorias = await AnotacaoMedica.distinct('categoria');
    res.status(200).json(categorias);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno ao buscar categorias' });
  }
  
};

export const buscarAnotacaoPorId = async (req, res) => {
  try {
    const anotacao = req.anotacao || await AnotacaoMedica.findById(req.params.id);

    if (!anotacao) {
      return res.status(404).json({ message: 'Anotação não encontrada' });
    }

    res.status(200).json(anotacao);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno ao buscar anotação' });
  }
};

export const deleteAnotacao = async (req, res) => {
  try {
    const anotacao = req.anotacao || await AnotacaoMedica.findById(req.params.id);
    
    if (!anotacao) {
      return res.status(404).json({ message: 'Anotação não encontrada' });
    }

    await AnotacaoMedica.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Anotação excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno ao excluir anotação' });
  }
};

// Médico busca anotações de um paciente pelo CPF
export const buscarAnotacoesMedico = async (req, res) => {
  try {
    const paciente = req.paciente;

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const anotacoes = await AnotacaoMedica.find({ pacienteId: paciente._id })
      .populate('pacienteId', 'name nome cpf email')
      .sort({ data: -1 });

    res.json(anotacoes);
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
