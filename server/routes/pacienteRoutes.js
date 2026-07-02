// routes/pacienteRoutes.js
import express from 'express';
import Paciente from '../models/Paciente.js';
import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';
import User from '../models/User.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authPacienteMiddleware } from '../middlewares/pacienteAuthMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';

import { trySendPulseKeyAccessLogEmail } from '../controllers/accessCodeController.js';
import {
  buildPatientPublicProfile,
  findPacienteByIdentifier,
  getPatientLookupKey,
  invalidIdentifierMessage,
  parsePatientIdentifier,
  resolveIdentifierFromRequest,
} from '../utils/patientIdentifier.js';

const router = express.Router();

const sanitizePacienteForApp = (paciente) => {
  const obj = paciente.toObject ? paciente.toObject() : { ...paciente };
  delete obj.password;
  delete obj.senha;
  return obj;
};

// Perfil do paciente autenticado (app mobile)
router.get('/me', authPacienteMiddleware, async (req, res) => {
  try {
    res.json(sanitizePacienteForApp(req.user));
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

const normalizeAccessCode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

const checkConexaoAtiva = async (medicoId, pacienteId) => {
  return ConexaoMedicoPaciente.findOne({
    pacienteId,
    medicoId,
    isActive: true
  });
};

const buildPacienteProfileResponse = (paciente) => {
  const lookup = getPatientLookupKey(paciente);
  return {
    nome: paciente.name || paciente.nome,
    cpf: paciente.cpf,
    socialSecurityNumber: paciente.socialSecurityNumber || '',
    residenceCountry: paciente.residenceCountry || null,
    identifierType: lookup.type,
    identifier: lookup.value,
    genero: paciente.gender || paciente.genero,
    altura: paciente.height || paciente.altura,
    peso: paciente.weight || paciente.peso,
    dataNascimento: paciente.birthDate || paciente.dataNascimento,
    nacionalidade: paciente.nationality || paciente.nacionalidade,
    profissao: paciente.profession || paciente.profissao,
    telefone: paciente.phone || paciente.telefone,
    observacoes: paciente.observacoes,
    fotoPerfil: paciente.profilePhoto || paciente.fotoPerfil,
  };
};

// Médico busca paciente pelo CPF ou SSN
router.get('/buscar', authMiddleware, requireValidatedDoctor, async (req, res) => {
  const raw = resolveIdentifierFromRequest(req.query);

  if (!raw) {
    return res.status(400).json({ message: 'CPF ou SSN é obrigatório' });
  }

  try {
    const parsed = parsePatientIdentifier(raw);
    if (!parsed.valid) {
      return res.status(400).json({ message: invalidIdentifierMessage() });
    }

    const paciente = await findPacienteByIdentifier(raw);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    res.json(buildPatientPublicProfile(paciente));
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Médico busca paciente pelo identificador e código de acesso
router.post('/buscar-com-codigo', authMiddleware, requireValidatedDoctor, async (req, res) => {
  const raw = resolveIdentifierFromRequest(req.body);
  const { codigoAcesso } = req.body;

  if (!raw || !codigoAcesso) {
    return res.status(400).json({ message: 'Identificador e código de acesso são obrigatórios' });
  }

  try {
    const parsed = parsePatientIdentifier(raw);
    if (!parsed.valid) {
      return res.status(400).json({ message: invalidIdentifierMessage() });
    }

    const codigoNormalizado = normalizeAccessCode(codigoAcesso);

    if (codigoNormalizado.length !== 6) {
      return res.status(400).json({ message: 'Código de acesso deve ter 6 dígitos' });
    }

    const paciente = await findPacienteByIdentifier(raw);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Verificar se o código de acesso está correto e não expirou
    const codigoPaciente = normalizeAccessCode(paciente.accessCode);
    if (!codigoPaciente || codigoPaciente !== codigoNormalizado) {
      return res.status(401).json({ message: 'Código de acesso inválido' });
    }

    if (!paciente.accessCodeExpires || new Date() > paciente.accessCodeExpires) {
      return res.status(401).json({ message: 'Código de acesso expirado' });
    }

    const medico = await User.findById(req.user._id);
    if (medico) {
      await ConexaoMedicoPaciente.updateMany(
        { pacienteId: paciente._id, isActive: true },
        { isActive: false, disconnectedAt: new Date() }
      );
      const novaConexao = new ConexaoMedicoPaciente({
        pacienteId: paciente._id,
        medicoId: medico._id,
        medicoNome: medico.nome,
        medicoEspecialidade: medico.areaAtuacao,
        connectedAt: new Date(),
        isActive: true
      });
      await novaConexao.save();
      try {
        await trySendPulseKeyAccessLogEmail(paciente._id, {
          conexao: novaConexao,
          medicoNome: medico.nome,
          medicoEspecialidade: medico.areaAtuacao,
        });
      } catch (mailErr) {
        console.warn('[buscar-com-codigo] alerta e-mail Chave Oryon:', mailErr?.message || mailErr);
      }
    }

    // Código válido - retornar dados do paciente
    res.json(buildPatientPublicProfile(paciente));
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Endpoint para paciente consultar médico conectado (deve vir antes de rotas genéricas)
router.get('/:patientId/conexao-ativa', authPacienteMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    if (String(req.user._id) !== String(patientId)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    const conexaoAtiva = await ConexaoMedicoPaciente.findOne({
      pacienteId: patientId,
      isActive: true
    }).sort({ connectedAt: -1 });
    
    if (!conexaoAtiva) {
      return res.json({
        conectado: false,
        medico: null,
        tempoConectado: null
      });
    }
    
    const tempoConectado = Math.floor((new Date() - conexaoAtiva.connectedAt) / 1000);
    
    res.json({
      conectado: true,
      medico: {
        id: conexaoAtiva.medicoId,
        nome: conexaoAtiva.medicoNome,
        especialidade: conexaoAtiva.medicoEspecialidade
      },
      tempoConectado: tempoConectado,
      connectedAt: conexaoAtiva.connectedAt
    });
  } catch (err) {
    console.error('Erro ao buscar conexão ativa:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Endpoint para verificar se médico logado está conectado ao paciente (CPF ou SSN)
router.get('/verificar-conexao/:identifier', authMiddleware, requireValidatedDoctor, async (req, res) => {
  try {
    const paciente = await findPacienteByIdentifier(req.params.identifier);
    if (!paciente) {
      return res.json({ conectado: false, mensagem: 'Paciente não encontrado' });
    }
    const conexaoAtiva = await checkConexaoAtiva(req.user._id, paciente._id);
    if (!conexaoAtiva) return res.json({ conectado: false });
    res.json({ conectado: true });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Endpoint para desconectar médico (deve vir antes de rotas genéricas)
router.post('/:patientId/desconectar-medico', authPacienteMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    if (String(req.user._id) !== String(patientId)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    const resultado = await ConexaoMedicoPaciente.updateMany(
      { pacienteId: patientId, isActive: true },
      { 
        isActive: false, 
        disconnectedAt: new Date() 
      }
    );
    
    if (resultado.modifiedCount === 0) {
      return res.status(404).json({ 
        message: 'Nenhuma conexão ativa encontrada para este paciente' 
      });
    }
    
    res.json({
      message: 'Médico desconectado com sucesso',
      desconectado: true
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Buscar paciente por identificador (CPF ou SSN) — usado no perfil
router.get('/perfil/:identifier', authMiddleware, requireValidatedDoctor, async (req, res) => {
  try {
    const medicoId = req.user._id;
    const paciente = await findPacienteByIdentifier(req.params.identifier);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Verificar conexão ativa
    const conexaoAtiva = await ConexaoMedicoPaciente.findOne({
      pacienteId: paciente._id,
      medicoId: medicoId,
      isActive: true
    });

    if (!conexaoAtiva) {
      return res.status(403).json({ 
        message: 'Acesso negado. Você não tem uma conexão ativa com este paciente. Por favor, solicite acesso novamente.',
        codigo: 'CONEXAO_INATIVA'
      });
    }

    res.json(buildPacienteProfileResponse(paciente));
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Buscar paciente por ID (usado no perfil)
router.get('/id/:id', authMiddleware, requireValidatedDoctor, async (req, res) => {
  const { id } = req.params;

  try {
    const paciente = await Paciente.findById(id);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const conexaoAtiva = await checkConexaoAtiva(req.user._id, paciente._id);
    if (!conexaoAtiva) {
      return res.status(403).json({
        message: 'Acesso negado. Você não tem uma conexão ativa com este paciente.',
        codigo: 'CONEXAO_INATIVA'
      });
    }

    res.json(buildPacienteProfileResponse(paciente));
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar perfil do paciente (médico pode editar)
router.put('/perfil/:identifier', authMiddleware, requireValidatedDoctor, async (req, res) => {
  try {
    const paciente = await findPacienteByIdentifier(req.params.identifier);

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Verificar conexão ativa
    const conexaoAtiva = await ConexaoMedicoPaciente.findOne({
      pacienteId: paciente._id,
      medicoId: req.user._id,
      isActive: true
    });

    if (!conexaoAtiva) {
      return res.status(403).json({ 
        message: 'Acesso negado. Você não tem uma conexão ativa com este paciente. Por favor, solicite acesso novamente.',
        codigo: 'CONEXAO_INATIVA'
      });
    }

    // Atualizar campos permitidos
    const { nome, genero, nacionalidade, altura, peso, profissao, email, telefone, observacoes } = req.body;

    if (nome !== undefined) {
      paciente.name = nome;
      paciente.nome = nome; // Compatibilidade
    }
    if (genero !== undefined) {
      paciente.gender = genero;
      paciente.genero = genero; // Compatibilidade
    }
    if (nacionalidade !== undefined) {
      paciente.nationality = nacionalidade;
      paciente.nacionalidade = nacionalidade; // Compatibilidade
    }
    if (altura !== undefined) {
      paciente.height = altura ? parseFloat(altura) : null;
      paciente.altura = altura ? altura.toString() : null; // Compatibilidade
    }
    if (peso !== undefined) {
      paciente.weight = peso ? parseFloat(peso) : null;
      paciente.peso = peso ? peso.toString() : null; // Compatibilidade
    }
    if (profissao !== undefined) {
      paciente.profession = profissao;
      paciente.profissao = profissao; // Compatibilidade
    }
    if (email !== undefined && email.trim() !== '') {
      paciente.email = email;
    }
    if (telefone !== undefined) {
      paciente.phone = telefone;
      paciente.telefone = telefone; // Compatibilidade
    }
    if (observacoes !== undefined) {
      paciente.observacoes = observacoes;
    }

    await paciente.save();

    try {
      const Notification = (await import('../models/Notification.js')).default;
      const mongoose = (await import('mongoose')).default;
      
      const notif = await Notification.create({
        user: mongoose.Types.ObjectId.isValid(paciente._id) ? paciente._id : new mongoose.Types.ObjectId(paciente._id.toString()),
        userModel: 'Paciente',
        title: 'Dados do perfil alterados',
        description: `Seus dados de perfil foram atualizados por ${req.user.nome || 'um médico'}. Verifique as alterações em seu perfil.`,
        type: 'profile_update',
        link: `/profile`,
        unread: true
      });

      try {
        const { sendNotificationToUser } = await import('../services/fcmService.js');
        
        await sendNotificationToUser(
          paciente._id,
          'Paciente',
          'Dados do perfil alterados',
          `Seus dados de perfil foram atualizados por ${req.user.nome || 'um médico'}. Verifique as alterações em seu perfil.`,
          {
            link: `/profile`,
            type: 'profile_update',
            notificationId: notif._id.toString()
          }
        );
      } catch (fcmError) {
        console.error('Erro ao enviar notificação push:', fcmError);
      }
    } catch (notifError) {
      console.error('Erro ao criar notificação:', notifError);
    }

    res.json({
      message: 'Perfil atualizado com sucesso',
      paciente: {
        nome: paciente.name || paciente.nome,
        genero: paciente.gender || paciente.genero,
        nacionalidade: paciente.nationality || paciente.nacionalidade,
        altura: paciente.height || paciente.altura,
        peso: paciente.weight || paciente.peso,
        profissao: paciente.profession || paciente.profissao,
        email: paciente.email,
        telefone: paciente.phone || paciente.telefone,
        observacoes: paciente.observacoes
      }
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil do paciente:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para listar pacientes conectados ao médico
router.get('/', authMiddleware, requireValidatedDoctor, async (req, res) => {
  try {
    const medicoId = req.user._id;
    
    // Buscar conexões ativas do médico
    const conexoes = await ConexaoMedicoPaciente.find({
      medicoId,
      isActive: true
    }).populate('pacienteId', 'name email phone profilePhoto');

    const pacientes = conexoes
      .map(conexao => conexao.pacienteId)
      .filter(paciente => paciente !== null);

    res.json(pacientes);
  } catch (err) {
    console.error('Erro ao listar pacientes:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

router.post('/fcm-token', authPacienteMiddleware, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const pacienteId = req.user._id;

    if (!fcmToken) {
      return res.status(400).json({ message: 'Token FCM não fornecido' });
    }

    const paciente = await Paciente.findByIdAndUpdate(
      pacienteId,
      { fcmToken: fcmToken },
      { new: true }
    );

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    res.json({ message: 'Token FCM salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar token FCM:', error);
    res.status(500).json({ message: 'Erro ao salvar token FCM' });
  }
});

router.get('/historico-acessos', authPacienteMiddleware, async (req, res) => {
  try {
    const pacienteId = req.user._id;

    const historicoAcessos = await ConexaoMedicoPaciente.find({
      pacienteId: pacienteId
    })
      .sort({ connectedAt: -1 })
      .limit(100);

    const acessosFormatados = historicoAcessos.map(acesso => ({
      id: acesso._id,
      medicoId: acesso.medicoId,
      medicoNome: acesso.medicoNome,
      medicoEspecialidade: acesso.medicoEspecialidade || 'Não informado',
      dataHora: acesso.connectedAt ? acesso.connectedAt.toISOString() : null,
      desconectadoEm: acesso.disconnectedAt ? acesso.disconnectedAt.toISOString() : null,
      isActive: acesso.isActive,
      duracao: acesso.disconnectedAt 
        ? Math.floor((acesso.disconnectedAt - acesso.connectedAt) / 1000)
        : acesso.isActive 
          ? Math.floor((new Date() - acesso.connectedAt) / 1000)
          : null
    }));

    res.json({
      total: acessosFormatados.length,
      acessos: acessosFormatados
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de acessos:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de acessos' });
  }
});

export default router;