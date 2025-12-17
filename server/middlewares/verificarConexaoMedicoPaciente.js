import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';
import Paciente from '../models/Paciente.js';

export const verificarConexaoMedicoPaciente = async (req, res, next) => {
  try {
    const medicoId = req.user._id || req.user.id;
    const pacienteId = req.query.pacienteId || req.params.pacienteId || req.body.pacienteId;
    const cpfParam = req.query.cpf || req.params.cpf || req.body.cpf;

    console.log('🔍 Verificando conexão médico-paciente');
    console.log('   Médico ID:', medicoId);
    console.log('   Paciente ID:', pacienteId);
    console.log('   CPF:', cpfParam);
    console.log('   Body completo:', req.body);

    if (!pacienteId && !cpfParam) {
      console.error('❌ CPF ou ID do paciente não fornecido');
      return res.status(400).json({ 
        success: false,
        message: 'Informe o CPF ou o ID do paciente para verificar a conexão' 
      });
    }

    let paciente = null;

    if (pacienteId) {
      paciente = await Paciente.findById(pacienteId);
    }

    if (!paciente && cpfParam) {
      const cpfLimpo = cpfParam.replace(/\D/g, '');
      paciente = await Paciente.findOne({ cpf: cpfLimpo });
      
      if (!paciente) {
        const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        paciente = await Paciente.findOne({ cpf: cpfFormatado });
      }
    }

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const conexaoAtiva = await ConexaoMedicoPaciente.findOne({
      pacienteId: paciente._id,
      medicoId: medicoId,
      isActive: true
    });

    if (!conexaoAtiva) {
      // Tentar criar conexão automaticamente
      try {
        const User = (await import('../models/User.js')).default;
        const medico = await User.findById(medicoId);
        
        if (medico) {
          // Desativar conexões anteriores do mesmo paciente com este médico
          await ConexaoMedicoPaciente.updateMany(
            { pacienteId: paciente._id, medicoId: medicoId, isActive: true },
            { isActive: false, disconnectedAt: new Date() }
          );
          
          // Criar nova conexão
          const novaConexao = new ConexaoMedicoPaciente({
            pacienteId: paciente._id,
            medicoId: medico._id,
            medicoNome: medico.nome,
            medicoEspecialidade: medico.areaAtuacao,
            connectedAt: new Date(),
            isActive: true
          });
          
          await novaConexao.save();
          
          req.paciente = paciente;
          req.conexaoAtiva = novaConexao;
          next();
          return;
        }
      } catch (createError) {
        return res.status(500).json({ message: 'Erro ao criar conexão com o paciente', error: createError.message });
      }
      
      // Se não conseguiu criar, retornar erro
      return res.status(403).json({ 
        message: 'Acesso negado. Você não tem uma conexão ativa com este paciente. Por favor, solicite acesso novamente.',
        codigo: 'CONEXAO_INATIVA'
      });
    }

    req.paciente = paciente;
    req.conexaoAtiva = conexaoAtiva;
    next();
  } catch (error) {
    res.status(500).json({ 
      message: 'Erro ao verificar conexão com o paciente',
      error: error.message 
    });
  }
};




