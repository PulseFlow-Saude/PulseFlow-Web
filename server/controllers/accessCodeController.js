import Paciente from '../models/Paciente.js';
import SolicitacaoAcesso from '../models/SolicitacaoAcesso.js';
import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';
import { sendHtmlEmail } from '../services/emailService.js';
import crypto from 'crypto';

/** Duração da Chave Oryon no servidor (ms). Comparisons usam instante UTC — válido em qualquer região Render (ex.: Oregon). */
const ORYON_KEY_TTL_MS = 2 * 60 * 1000;

const normalizeAccessCode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Envia e-mail de alerta de acesso (Chave Oryon) se a preferência estiver ativa e ainda não tiver sido enviado para esta conexão.
 * @returns {Promise<{ sent: boolean, duplicate?: boolean, reason?: string }>}
 */
export const trySendPulseKeyAccessLogEmail = async (patientId, options = {}) => {
  const { conexao: conexaoArg, medicoNome: nomeBody, medicoEspecialidade: espBody } = options;

  const paciente = await Paciente.findById(patientId);
  if (!paciente) {
    return { sent: false, reason: 'patient_not_found' };
  }
  if (!paciente.accessLogEmail) {
    return { sent: false, reason: 'disabled' };
  }

  const to = paciente.email;
  if (!to || !String(to).trim()) {
    return { sent: false, reason: 'no_email' };
  }

  let conexao = conexaoArg;
  if (!conexao) {
    conexao = await ConexaoMedicoPaciente.findOne({
      pacienteId: patientId,
      isActive: true,
    }).sort({ connectedAt: -1 });
  }

  if (!conexao) {
    return { sent: false, reason: 'no_active_connection' };
  }

  const conexaoId = conexao._id;
  if (String(paciente.accessLogEmailLastConexaoId || '') === String(conexaoId)) {
    return { sent: false, duplicate: true };
  }

  const nomeMedico = nomeBody || conexao.medicoNome || 'Profissional de saúde';
  const esp = espBody || conexao.medicoEspecialidade || '';

  const nomePaciente = escapeHtml(paciente.name || paciente.nome || 'Paciente');
  const nomeMedicoSafe = escapeHtml(nomeMedico);
  const espSafe = escapeHtml(esp);

  const subject = 'Alerta de acesso — Chave Oryon (PulseFlow)';
  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f1f5f9;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width:560px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
                <tr>
                  <td style="background:linear-gradient(135deg,#002a42 0%,#0369a1 100%); padding:20px; text-align:center;">
                    <span style="color:#fff; font-size:20px; font-weight:700;">PulseFlow</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">Acesso aos teus dados de saúde</h1>
                    <p style="margin:0 0 16px; font-size:15px; line-height:1.55; color:#334155;">
                      Olá, <strong>${nomePaciente}</strong>.
                    </p>
                    <p style="margin:0 0 16px; font-size:15px; line-height:1.55; color:#334155;">
                      Um profissional acedeu ou está ligado à tua conta através da <strong>Chave Oryon</strong>.
                    </p>
                    <p style="margin:0; font-size:15px; line-height:1.55; color:#334155;">
                      <strong>Médico:</strong> ${nomeMedicoSafe}<br/>
                      ${esp ? `<strong>Especialidade:</strong> ${espSafe}` : ''}
                    </p>
                    <p style="margin:20px 0 0; font-size:13px; color:#64748b;">
                      Se não reconheces esta atividade, altera a tua palavra-passe e contacta o suporte.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendHtmlEmail({ to, subject, html });

  paciente.accessLogEmailLastConexaoId = conexaoId;
  await paciente.save();

  return { sent: true };
};

// Gerar código de acesso para o paciente
export const gerarCodigoAcesso = async (req, res) => {
  const { cpf, patientId, accessCode, expiresAt, accessLogEmail } = req.body;

  console.log('📥 [accessCodeController] Requisição recebida:', { patientId, accessCode, expiresAt, cpf, accessLogEmail });

  // App mobile: expiração sempre calculada no servidor (evita desvio fuso/ISO vs Oregon UTC).
  if (patientId && accessCode) {
    try {
      if (String(req.user?._id) !== String(patientId)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      console.log('📱 [accessCodeController] Buscando paciente por ID:', patientId);
      const paciente = await Paciente.findById(patientId);
      
      if (!paciente) {
        console.log('❌ [accessCodeController] Paciente não encontrado:', patientId);
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      console.log('✅ [accessCodeController] Paciente encontrado:', paciente._id);
      console.log('💾 [accessCodeController] Salvando código de acesso...');

      paciente.accessCode = accessCode;
      paciente.accessCodeExpires = new Date(Date.now() + ORYON_KEY_TTL_MS);
      paciente.accessLogEmail = Boolean(accessLogEmail);
      await paciente.save();

      console.log('✅ [accessCodeController] Código salvo com sucesso');

      res.json({
        message: 'Código de acesso salvo com sucesso',
        codigo: accessCode,
        expiraEm: paciente.accessCodeExpires
      });
    } catch (error) {
      console.error('❌ [accessCodeController] Erro ao salvar código:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
    return;
  }

  // Se vem da web (com CPF)
  if (!cpf) {
    return res.status(400).json({ message: 'CPF é obrigatório' });
  }

  try {
    // Limpar CPF removendo caracteres não numéricos
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Validar se CPF tem 11 dígitos
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ message: 'CPF deve ter 11 dígitos' });
    }

    // Buscar paciente
    let paciente = await Paciente.findOne({ cpf: cpfLimpo });
    
    if (!paciente) {
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
    }

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Paciente autenticado só pode gerar código para o próprio CPF
    if (String(req.user?._id) !== String(paciente._id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Gerar código de 6 dígitos com PRNG criptográfico
    const codigoAcesso = crypto.randomInt(100000, 1000000).toString();
    
    const dataExpiracao = new Date(Date.now() + ORYON_KEY_TTL_MS);

    // Atualizar paciente com o novo código
    paciente.accessCode = codigoAcesso;
    paciente.accessCodeExpires = dataExpiracao;
    await paciente.save();

    res.json({
      message: 'Código de acesso gerado com sucesso',
      codigo: codigoAcesso,
      expiraEm: dataExpiracao
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Verificar se código de acesso é válido
export const verificarCodigoAcesso = async (req, res) => {
  const { codigoAcesso, accessCode, patientId } = req.body;

  // Aceitar tanto codigoAcesso (web) quanto accessCode (app)
  const codigo = normalizeAccessCode(codigoAcesso || accessCode);

  if (!codigo) {
    return res.status(400).json({ message: 'Código de acesso é obrigatório' });
  }

  try {
    // Validar se código tem 6 dígitos
    if (codigo.length !== 6) {
      return res.status(400).json({ message: 'Código de acesso deve ter 6 dígitos' });
    }

    let paciente;

    // Se tem patientId, buscar por ID primeiro
    if (patientId) {
      if (String(req.user?._id) !== String(patientId)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      paciente = await Paciente.findById(patientId);
      if (!paciente) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }
      
      // Verificar se o código do paciente corresponde
      if (normalizeAccessCode(paciente.accessCode) !== codigo) {
        return res.status(401).json({ message: 'Código de acesso inválido' });
      }
    } else {
      // Buscar paciente pelo código de acesso
      paciente = await Paciente.findOne({ accessCode: codigo });
      if (!paciente) {
        return res.status(404).json({ message: 'Código de acesso não encontrado' });
      }
    }

    // Verificar se o código não expirou
    if (!paciente.accessCodeExpires || new Date() > paciente.accessCodeExpires) {
      return res.status(401).json({ message: 'Código de acesso expirado' });
    }

    res.json({
      message: 'Código de acesso válido',
      valido: true,
      paciente: {
        id: paciente._id,
        nome: paciente.name || paciente.nome,
        cpf: paciente.cpf
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Notificar paciente quando médico solicita acesso
export const notificarSolicitacaoAcesso = async (req, res) => {
  const { cpf, medicoNome, especialidade } = req.body;

  if (!cpf) {
    return res.status(400).json({ message: 'CPF é obrigatório' });
  }

  try {
    // Limpar CPF
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Buscar paciente
    let paciente = await Paciente.findOne({ cpf: cpfLimpo });
    
    if (!paciente) {
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
    }

    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Criar registro de solicitação de acesso
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expira em 10 minutos

    const solicitacao = new SolicitacaoAcesso({
      pacienteId: paciente._id.toString(),
      pacienteCpf: paciente.cpf,
      medicoId: req.user?._id || null,
      medicoNome: req.user?.nome || medicoNome || 'Não informado',
      medicoEspecialidade: req.user?.areaAtuacao || especialidade || 'Não informada',
      dataHora: new Date(),
      visualizada: false,
      expiresAt: expiresAt
    });

    await solicitacao.save();

    try {
      const Notification = (await import('../models/Notification.js')).default;
      const mongoose = (await import('mongoose')).default;
      
      await Notification.create({
        user: mongoose.Types.ObjectId.isValid(paciente._id) ? paciente._id : new mongoose.Types.ObjectId(paciente._id.toString()),
        userModel: 'Paciente',
        title: 'Nova solicitação de acesso',
        description: `${medicoNome || 'Um médico'} (${especialidade || 'Especialidade não informada'}) está solicitando acesso aos seus dados de saúde através do Pulse Key`,
        type: 'pulse_key',
        link: `/pulse-key`,
        unread: true
      });
    } catch (notifError) {
      console.error('Erro ao criar notificação:', notifError);
    }

    console.log('✅ Solicitação de acesso registrada:', {
      paciente: paciente.name || paciente.nome,
      medico: medicoNome,
      especialidade: especialidade
    });

    res.json({
      message: 'Solicitação de acesso registrada. O paciente será notificado.',
      notificacaoRegistrada: true,
      paciente: {
        nome: paciente.name || paciente.nome,
        cpf: paciente.cpf
      }
    });
  } catch (error) {
    console.error('❌ Erro ao registrar solicitação:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Buscar solicitações de acesso pendentes para um paciente
export const buscarSolicitacoesPendentes = async (req, res) => {
  const { patientId } = req.params;

  if (!patientId) {
    return res.status(400).json({ message: 'ID do paciente é obrigatório' });
  }

  try {
    if (String(req.user?._id) !== String(patientId)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    // Buscar solicitações não visualizadas e não expiradas
    const solicitacoes = await SolicitacaoAcesso.find({
      pacienteId: patientId,
      visualizada: false,
      expiresAt: { $gt: new Date() }
    }).sort({ dataHora: -1 });

    res.json({
      total: solicitacoes.length,
      solicitacoes: solicitacoes.map(s => ({
        id: s._id,
        medicoNome: s.medicoNome,
        especialidade: s.medicoEspecialidade,
        dataHora: s.dataHora,
        visualizada: s.visualizada
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Marcar solicitação como visualizada
export const marcarSolicitacaoVisualizada = async (req, res) => {
  const { solicitacaoId } = req.params;

  try {
    const solicitacao = await SolicitacaoAcesso.findById(solicitacaoId);

    if (!solicitacao) {
      return res.status(404).json({ message: 'Solicitação não encontrada' });
    }

    if (String(solicitacao.pacienteId) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    solicitacao.visualizada = true;
    await solicitacao.save();

    res.json({
      message: 'Solicitação marcada como visualizada',
      solicitacao: {
        id: solicitacao._id,
        visualizada: solicitacao.visualizada
      }
    });
  } catch (error) {
    console.error('❌ Erro ao marcar solicitação:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Buscar todas as solicitações de acesso (para médico ver suas solicitações)
export const buscarTodasSolicitacoes = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.nome) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const filtroMedico = user?._id
      ? { $or: [{ medicoId: user._id }, { medicoId: { $exists: false }, medicoNome: user.nome }] }
      : { medicoNome: user.nome };

    const solicitacoes = await SolicitacaoAcesso.find(filtroMedico)
      .sort({ dataHora: -1 })
      .limit(100);

    res.json({
      total: solicitacoes.length,
      solicitacoes: solicitacoes.map(s => ({
        id: s._id,
        pacienteId: s.pacienteId,
        pacienteCpf: s.pacienteCpf,
        medicoNome: s.medicoNome,
        especialidade: s.medicoEspecialidade,
        dataHora: s.dataHora,
        visualizada: s.visualizada,
        expiresAt: s.expiresAt
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

/** POST /api/access-code/notificar-acesso-email — paciente (Bearer); pede envio de e-mail de alerta de acesso (idempotente por conexão ativa). */
export const notificarAcessoEmail = async (req, res) => {
  const { patientId, medicoNome, medicoEspecialidade } = req.body || {};

  if (!patientId) {
    return res.status(400).json({ message: 'patientId é obrigatório' });
  }
  if (String(req.user?._id) !== String(patientId)) {
    return res.status(403).json({ message: 'Acesso negado' });
  }

  try {
    const result = await trySendPulseKeyAccessLogEmail(patientId, {
      medicoNome,
      medicoEspecialidade,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ [accessCodeController] notificarAcessoEmail:', err);
    return res.status(500).json({
      message: 'Erro ao enviar e-mail de alerta',
      sent: false,
      reason: 'send_failed',
    });
  }
};

// Rota de teste para verificar conexão
export const testConnection = async (req, res) => {
  res.json({ 
    message: 'Conexão com o backend funcionando!',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
};
