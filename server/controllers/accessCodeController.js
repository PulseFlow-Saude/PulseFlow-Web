import Paciente from '../models/Paciente.js';
import SolicitacaoAcesso from '../models/SolicitacaoAcesso.js';
import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';
import { sendHtmlEmail } from '../services/emailService.js';
import crypto from 'crypto';
import {
  buildPatientPublicProfile,
  findPacienteByIdentifier,
  getPatientLookupKey,
  invalidIdentifierMessage,
  parsePatientIdentifier,
  resolveIdentifierFromRequest,
} from '../utils/patientIdentifier.js';

/** Duração da Chave Oryon no servidor (ms). Comparisons usam instante UTC — válido em qualquer região Render (ex.: Oregon). */
const ORYON_KEY_TTL_MS = 2 * 60 * 1000;

const normalizeAccessCode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeAppLocale = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'en' || s.startsWith('en')) return 'en';
  return 'pt-BR';
};

const getPublicBaseUrl = () => {
  const raw =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    '';
  const normalized = String(raw).trim().replace(/\/+$/, '');
  return normalized || 'https://pulseflow-web.onrender.com';
};

const getSupportContactUrl = () => {
  const configured = String(process.env.SUPPORT_CONTACT_URL || '').trim();
  if (configured) return configured;
  return `${getPublicBaseUrl()}/client/views/contato.html`;
};

/** Textos do e-mail de alerta da Chave Oryon (PT-BR do Brasil e EN). */
const ORYON_ACCESS_ALERT_COPY = {
  'pt-BR': {
    subject: 'Alerta de segurança — Oryon Health · Chave Oryon',
    preheader: 'Um profissional acessou sua conta com a Chave Oryon.',
    title: 'Acesso aos seus dados de saúde',
    greeting: 'Olá',
    body:
      'Um profissional de saúde acessou ou está conectado à sua conta por meio da <strong>Chave Oryon</strong>.',
    doctorLabel: 'Profissional',
    specialtyLabel: 'Especialidade',
    footer:
      'Se você não reconhece esta atividade, altere sua senha e entre em contato com o suporte.',
    footerCta: 'Falar com o suporte',
    tagline: 'Cuidado digital com privacidade.',
    defaultDoctor: 'Profissional de saúde',
    connectionSectionTitle: 'Detalhes da conexão',
  },
  en: {
    subject: 'Security alert — Oryon Health · Oryon Key',
    preheader: 'A healthcare professional accessed your account with the Oryon Key.',
    title: 'Access to your health information',
    greeting: 'Hello',
    body:
      'A healthcare professional has accessed or is connected to your account through the <strong>Oryon Key</strong>.',
    doctorLabel: 'Professional',
    specialtyLabel: 'Specialty',
    footer:
      'If you do not recognize this activity, change your password and contact support.',
    footerCta: 'Contact support',
    tagline: 'Digital care with privacy.',
    defaultDoctor: 'Healthcare professional',
    connectionSectionTitle: 'Connection details',
  },
};

const buildOryonAccessAlertHtml = ({
  lang,
  nomePaciente,
  nomeMedicoSafe,
  espSafe,
  hasSpecialty,
}) => {
  const t = ORYON_ACCESS_ALERT_COPY[lang] || ORYON_ACCESS_ALERT_COPY['pt-BR'];
  const base = getPublicBaseUrl();
  const supportUrl = getSupportContactUrl();
  const logoUrl = `${base}/client/public/assets/9-removebg-preview.png`;
  const htmlLang = lang === 'en' ? 'en' : 'pt-BR';

  const specialtyRow = hasSpecialty
    ? `<tr>
        <td style="padding:4px 0 0; font-size:14px; color:#475569;">
          <span style="color:#64748b;">${t.specialtyLabel}:</span>
          <strong style="color:#0f172a;">${espSafe}</strong>
        </td>
      </tr>`
    : '';

  return `
    <!doctype html>
    <html lang="${htmlLang}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(t.title)}</title>
      </head>
      <body style="margin:0; padding:0; background:#eef2f7; font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
          ${t.preheader}
        </span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7; padding:32px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 40px rgba(15,23,42,0.06);">
                <tr>
                  <td style="background:linear-gradient(135deg,#001a2e 0%,#003d5c 45%,#0369a1 100%);padding:26px 28px;text-align:center;">
                    <img src="${logoUrl}" alt="Oryon Health" width="160" style="display:block;margin:0 auto 10px;max-height:48px;height:auto;max-width:160px;border:0;" />
                    <div style="color:rgba(255,255,255,0.92);font-size:13px;letter-spacing:0.04em;text-transform:uppercase;font-weight:600;">Oryon Health</div>
                    <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:6px;">${t.tagline}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px;">
                    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#0f172a;font-weight:700;">${t.title}</h1>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                      ${t.greeting}, <strong style="color:#0f172a;">${nomePaciente}</strong>.
                    </p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#334155;">${t.body}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;border-left:4px solid #0284c7;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:600;">${t.connectionSectionTitle}</p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding:0 0 4px;font-size:14px;color:#475569;">
                                <span style="color:#64748b;">${t.doctorLabel}:</span>
                                <strong style="color:#0f172a;">${nomeMedicoSafe}</strong>
                              </td>
                            </tr>
                            ${specialtyRow}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px;">
                    <p style="margin:20px 0 16px;font-size:14px;line-height:1.55;color:#64748b;">${t.footer}</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                      <tr>
                        <td style="border-radius:10px;background:#0284c7;">
                          <a href="${supportUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${t.footerCta}</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                      © ${new Date().getFullYear()} Oryon Health
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
};

/**
 * Envia e-mail de alerta de acesso (Chave Oryon) se a preferência estiver ativa e ainda não tiver sido enviado para esta conexão.
 * @returns {Promise<{ sent: boolean, duplicate?: boolean, reason?: string }>}
 */
export const trySendPulseKeyAccessLogEmail = async (patientId, options = {}) => {
  const {
    conexao: conexaoArg,
    medicoNome: nomeBody,
    medicoEspecialidade: espBody,
    lang: langOption,
  } = options;

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

  const lang = normalizeAppLocale(langOption ?? paciente.appLocale);
  const copy = ORYON_ACCESS_ALERT_COPY[lang] || ORYON_ACCESS_ALERT_COPY['pt-BR'];
  const nomeMedico = nomeBody || conexao.medicoNome || copy.defaultDoctor;
  const esp = espBody || conexao.medicoEspecialidade || '';

  const nomePaciente = escapeHtml(paciente.name || paciente.nome || 'Paciente');
  const nomeMedicoSafe = escapeHtml(nomeMedico);
  const espSafe = escapeHtml(esp);
  const hasSpecialty = Boolean(String(esp).trim());

  const subject = copy.subject;
  const html = buildOryonAccessAlertHtml({
    lang,
    nomePaciente,
    nomeMedicoSafe,
    espSafe,
    hasSpecialty,
  });

  await sendHtmlEmail({ to, subject, html });

  paciente.accessLogEmailLastConexaoId = conexaoId;
  await paciente.save();

  return { sent: true };
};

// Gerar código de acesso para o paciente
export const gerarCodigoAcesso = async (req, res) => {
  const { cpf, patientId, accessCode, expiresAt, accessLogEmail, appLocale, lang } = req.body;

  console.log('📥 [accessCodeController] Requisição recebida:', {
    patientId,
    accessCode,
    expiresAt,
    cpf,
    accessLogEmail,
    appLocale,
    lang,
  });

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
      const localeRaw = appLocale ?? lang;
      if (localeRaw != null && String(localeRaw).trim() !== '') {
        paciente.appLocale = normalizeAppLocale(localeRaw);
      }
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

  // Se vem da web (com CPF ou SSN)
  const raw = resolveIdentifierFromRequest(req.body);
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
      paciente: buildPatientPublicProfile(paciente),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Notificar paciente quando médico solicita acesso
export const notificarSolicitacaoAcesso = async (req, res) => {
  const raw = resolveIdentifierFromRequest(req.body);
  const { medicoNome, especialidade } = req.body;

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

    const lookup = getPatientLookupKey(paciente);

    // Criar registro de solicitação de acesso
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expira em 10 minutos

    const solicitacao = new SolicitacaoAcesso({
      pacienteId: paciente._id.toString(),
      pacienteCpf: lookup.value,
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

      const nomeMed =
        req.user?.nome || medicoNome || 'Um médico';
      const espMed =
        req.user?.areaAtuacao || especialidade || 'Especialidade não informada';

      await Notification.create({
        user: mongoose.Types.ObjectId.isValid(paciente._id) ? paciente._id : new mongoose.Types.ObjectId(paciente._id.toString()),
        userModel: 'Paciente',
        title: 'Nova solicitação de acesso',
        description: `${nomeMed} (${espMed}) está solicitando acesso aos seus dados de saúde por meio da Chave Oryon.`,
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
      paciente: buildPatientPublicProfile(paciente),
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
  const { patientId, medicoNome, medicoEspecialidade, appLocale, lang } = req.body || {};

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
      lang: appLocale ?? lang,
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
