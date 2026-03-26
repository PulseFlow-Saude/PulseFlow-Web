import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import otpService from '../services/otpService.js';
import tokenService from '../services/tokenService.js';
import { sendHtmlEmail } from '../services/emailService.js';

const otpAttempts = new Map();
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_WINDOW_MS = 10 * 60 * 1000;

const getOtpAttemptKey = (userId, ip) => `${String(userId || '')}:${String(ip || '')}`;

const registerOtpAttempt = (userId, ip) => {
  const key = getOtpAttemptKey(userId, ip);
  const now = Date.now();
  const current = otpAttempts.get(key);

  if (!current || now > current.expiresAt) {
    otpAttempts.set(key, { count: 1, expiresAt: now + OTP_LOCK_WINDOW_MS });
    return { locked: false, count: 1, remainingMs: OTP_LOCK_WINDOW_MS };
  }

  const nextCount = current.count + 1;
  const locked = nextCount > OTP_MAX_ATTEMPTS;
  otpAttempts.set(key, { count: nextCount, expiresAt: current.expiresAt });
  return { locked, count: nextCount, remainingMs: Math.max(0, current.expiresAt - now) };
};

const clearOtpAttempts = (userId, ip) => {
  otpAttempts.delete(getOtpAttemptKey(userId, ip));
};

const isResendSandboxRecipientError = (msg) =>
  /only send testing emails|verify a domain at resend/i.test(String(msg || ''));

const getLoginEmailFailureMessage = (err) => {
  if (isResendSandboxRecipientError(err?.message)) {
    return 'Resend em modo teste: o código só pode ser enviado para o e-mail da sua conta. Para enviar a qualquer usuário, verifique um domínio em resend.com/domains e use um remetente desse domínio em RESEND_FROM_EMAIL.';
  }
  return 'Não foi possível enviar o código de verificação. Tente novamente em instantes.';
};

const getSendOtpEmailFailureMessage = (err) => {
  if (isResendSandboxRecipientError(err?.message)) {
    return getLoginEmailFailureMessage(err);
  }
  return 'Não foi possível enviar um novo código agora. Tente novamente em instantes.';
};

// Função para registrar um novo usuário
export const register = async (req, res) => {
  try {
    const { senha, email, rqe } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Usuário já existe.' });
    }

    const requiredFields = [
      'nome', 'cpf', 'genero', 'email', 'senha', 'crm',
      'areaAtuacao', 'telefonePessoal', 'cep',
      'enderecoConsultorio', 'numeroConsultorio'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `Campo obrigatório ausente: ${field}` });
      }
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const rqeArray = Array.isArray(rqe) ? rqe.filter(r => r) : (typeof rqe === 'string' && rqe.trim() ? [rqe.trim()] : []);

    const newUser = new User({
      nome: req.body.nome,
      cpf: req.body.cpf,
      genero: req.body.genero,
      email: req.body.email,
      senha: hashedPassword,
      crm: req.body.crm,
      rqe: rqeArray,
      areaAtuacao: req.body.areaAtuacao,
      telefonePessoal: req.body.telefonePessoal,
      telefoneConsultorio: req.body.telefoneConsultorio,
      cep: req.body.cep,
      enderecoConsultorio: req.body.enderecoConsultorio,
      numeroConsultorio: req.body.numeroConsultorio,
      complemento: req.body.complemento,
      bairro: req.body.bairro,
      cidade: req.body.cidade,
      estado: req.body.estado
    });

    await newUser.save();

    try {
      await sendWelcomeEmail(email);
    } catch (emailError) {
      // Email de boas-vindas é opcional
    }

    res.status(201).json({ message: 'Usuário registrado com sucesso! Um e-mail de boas-vindas foi enviado.' });
  } catch (err) {
    res.status(500).json({ 
      message: 'Erro ao registrar.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

// Função para enviar o e-mail de boas-vindas
const sendWelcomeEmail = async (email) => {
  const contactUrl = getSupportContactUrl();
  await sendHtmlEmail({
    to: email,
    subject: '🎉 Bem-vindo(a) ao PulseFlow!',
    html: `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Bem-vindo ao PulseFlow</title>
        </head>
        <body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial,Helvetica,sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:28px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#002a42 0%,#0369a1 100%); padding:22px 28px; text-align:center;">
                      <span style="display:inline-block; color:#ffffff; font-size:24px; font-weight:800; letter-spacing:0.02em;">PulseFlow</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px 28px 24px;">
                      <h1 style="margin:0 0 10px; font-size:24px; line-height:1.2; color:#0f172a; text-align:center;">Bem-vindo(a) ao PulseFlow</h1>
                      <p style="margin:0 0 14px; font-size:15px; line-height:1.6; color:#334155; text-align:center;">
                        Olá, <strong>${email}</strong>! Sua conta foi criada com sucesso.
                      </p>
                      <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#334155; text-align:center;">
                        Estamos felizes em ter você com a gente. Agora você pode acompanhar sua saúde de forma integrada e inteligente.
                      </p>
                      <div style="text-align:center; margin:0 0 10px;">
                        <a href="${contactUrl}" style="display:inline-block; background:#0d6efd; color:#ffffff; text-decoration:none; padding:12px 24px; font-size:15px; font-weight:700; border-radius:10px;">
                          Falar com suporte
                        </a>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 28px 24px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;">
                        <tr>
                          <td style="padding-top:14px; font-size:12px; line-height:1.5; color:#64748b; text-align:center;">
                            Esta é uma mensagem automática. Por favor, não responda.<br/>
                            <a href="${contactUrl}" style="color:#0284c7; text-decoration:none;">Entre em contato com o suporte</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
};

// Função para login com envio de OTP
export const login = async (req, res) => {
  try {
    const { email, senha, lang } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });

    // Verificando a senha
    const isMatch = await bcrypt.compare(senha, user.senha);
    if (!isMatch) return res.status(401).json({ message: 'Credenciais inválidas.' });

    // Gerando OTP para o login
    const otp = otpService.generateOTP();
    user.otp = otp.code;
    user.otpExpires = otp.expires;
    await user.save();

    const langKey = lang === 'en' ? 'en' : 'pt-BR';
    // Responde já: SMTP no Render pode demorar e o proxy devolve 502 vazio se segurar a requisição.
    res.status(200).json({
      message: 'Código de verificação gerado. Verifique seu email.',
      userId: user._id,
    });
    setImmediate(() => {
      sendOTPByEmail(email, otp.code, langKey).catch((emailErr) => {
        console.error('[login] falha ao enviar OTP (background):', emailErr.message);
      });
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (process.env.NODE_ENV === 'development' || /email|smtp|sendgrid|resend|otp|timeout|auth|econn/i.test(msg)) {
      console.error('Erro no login:', msg);
    }
    const isEmailFailure = /email|smtp|sendgrid|resend|otp|timeout|auth|econn/i.test(String(err?.message || ''));
    res.status(isEmailFailure ? 502 : 500).json({
      message: isEmailFailure ? getLoginEmailFailureMessage(err) : 'Erro ao fazer login.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

// Função para verificar o OTP
export const verifyOTP = async (req, res) => {
  const { userId, code } = req.body;

  try {
    const attemptState = registerOtpAttempt(userId, req.ip);
    if (attemptState.locked) {
      return res.status(429).json({
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    // Verificando se o código do OTP é válido e não expirou
    if (user.otp !== code || new Date() > user.otpExpires) {
      return res.status(400).json({ message: 'Código inválido ou expirado.' });
    }

    // Limpa o OTP após a verificação
    user.otp = null;
    user.otpExpires = null;
    await user.save();
    clearOtpAttempts(userId, req.ip);

    // Gerando token JWT
    const token = tokenService.generateToken({ id: user._id, email: user.email });
    res.status(200).json({ message: 'Verificação concluída com sucesso!', token });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao verificar código.' });
  }
};

// Função para enviar um novo OTP
export const sendOtp = async (req, res) => {
  const { email, lang } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'Se o e-mail existir, um novo código será enviado.' });
    }

    // Gerando um novo OTP
    const otp = otpService.generateOTP();
    user.otp = otp.code;
    user.otpExpires = otp.expires;
    await user.save();

    const langKey = lang === 'en' ? 'en' : 'pt-BR';
    res.status(200).json({ message: 'Novo código de verificação enviado.' });
    setImmediate(() => {
      sendOTPByEmail(email, otp.code, langKey).catch((emailErr) => {
        console.error('[send-otp] falha ao enviar OTP (background):', emailErr.message);
      });
    });
  } catch (err) {
    const isEmailFailure = /email|smtp|sendgrid|resend|otp|timeout|auth|econn/i.test(String(err?.message || ''));
    res.status(isEmailFailure ? 502 : 500).json({
      message: isEmailFailure ? getSendOtpEmailFailureMessage(err) : 'Erro ao enviar o OTP.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
  }
};

// Templates do e-mail de OTP (PT e EN)
const OTP_EMAIL = {
  'pt-BR': {
    subject: '🔐 Seu Código de Verificação - PulseFlow',
    title: 'Código de Verificação',
    preheader: 'Use este código para concluir seu login com segurança.',
    body: 'Utilize o código abaixo para continuar seu login:',
    validFor: 'Este código é válido por 10 minutos.',
    ignoreText: 'Se você não solicitou esse código, ignore este e-mail.',
    securityTip: 'Nunca compartilhe este código com terceiros.',
    helpLine: 'Se tiver dúvidas, entre em contato com o suporte PulseFlow.'
  },
  en: {
    subject: '🔐 Your Verification Code - PulseFlow',
    title: 'Verification Code',
    preheader: 'Use this code to securely complete your sign in.',
    body: 'Use the code below to continue your login:',
    validFor: 'This code is valid for 10 minutes.',
    ignoreText: 'If you did not request this code, please ignore this email.',
    securityTip: 'Never share this code with third parties.',
    helpLine: 'If you have questions, contact PulseFlow support.'
  },
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
  return 'https://pulseflow-web.onrender.com/client/views/contato.html';
};

const getOTPEmailContent = (otpCode, lang = 'pt-BR') => {
  const t = OTP_EMAIL[lang] || OTP_EMAIL['pt-BR'];
  const contactUrl = getSupportContactUrl();
  return `
    <!doctype html>
    <html lang="${lang === 'en' ? 'en' : 'pt-BR'}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${t.title}</title>
      </head>
      <body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial,Helvetica,sans-serif;">
        <span style="display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden;">
          ${t.preheader}
        </span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0;">
                <tr>
                  <td style="background:linear-gradient(135deg,#002a42 0%,#0369a1 100%); padding:22px 28px; text-align:center;">
                    <span style="display:inline-block; color:#ffffff; font-size:24px; font-weight:800; letter-spacing:0.02em;">PulseFlow</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 22px;">
                    <h1 style="margin:0 0 10px; font-size:24px; line-height:1.2; color:#0f172a; text-align:center;">${t.title}</h1>
                    <p style="margin:0; font-size:15px; line-height:1.55; color:#334155; text-align:center;">${t.body}</p>

                    <div style="text-align:center; margin:22px 0 16px;">
                      <span style="display:inline-block; font-size:40px; letter-spacing:2px; font-weight:800; color:#0f172a; background:#e2e8f0; padding:12px 24px; border-radius:12px; border:1px solid #cbd5e1;">
                        ${otpCode}
                      </span>
                    </div>

                    <p style="margin:0 0 8px; font-size:14px; color:#475569; text-align:center;">${t.validFor}</p>
                    <p style="margin:0; font-size:13px; color:#0f766e; text-align:center;">${t.securityTip}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding-top:14px; font-size:12px; line-height:1.5; color:#64748b; text-align:center;">
                          ${t.ignoreText}<br/>
                          <a href="${contactUrl}" style="color:#0284c7; text-decoration:none;">${t.helpLine}</a>
                        </td>
                      </tr>
                    </table>
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

// Função para enviar e-mail com OTP
const sendOTPByEmail = async (email, otpCode, lang = 'pt-BR') => {
  const t = OTP_EMAIL[lang] || OTP_EMAIL['pt-BR'];
  const subject = t.subject;
  const html = getOTPEmailContent(otpCode, lang);
  await sendHtmlEmail({ to: email, subject, html });
};

// Função para solicitar redefinição de senha
export const resetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: 'Se o e-mail existir, enviaremos um link de redefinição.' });
    }

    // Gerando token de redefinição de senha
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const baseUrl = getPublicBaseUrl();
    const contactUrl = getSupportContactUrl();
    const resetLink = `${baseUrl}/client/views/reset-password-form.html?token=${token}`;

    await sendHtmlEmail({
      to: email,
      subject: '🔑 Redefinição de Senha - PulseFlow',
      html: `
        <!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Redefinição de senha</title>
          </head>
          <body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:28px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#002a42 0%,#0369a1 100%); padding:22px 28px; text-align:center;">
                        <span style="display:inline-block; color:#ffffff; font-size:24px; font-weight:800; letter-spacing:0.02em;">PulseFlow</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 28px 24px;">
                        <h1 style="margin:0 0 10px; font-size:24px; line-height:1.2; color:#0f172a; text-align:center;">Redefinição de senha</h1>
                        <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#334155; text-align:center;">
                          Olá, <strong>${user.nome || 'usuário(a)'}</strong> 👋
                        </p>
                        <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#334155; text-align:center;">
                          Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para continuar.
                        </p>
                        <div style="text-align:center; margin:0 0 10px;">
                          <a href="${resetLink}" style="display:inline-block; background:#0d6efd; color:#ffffff; text-decoration:none; padding:12px 24px; font-size:15px; font-weight:700; border-radius:10px;">
                            Redefinir senha
                          </a>
                        </div>
                        <p style="margin:14px 0 0; font-size:13px; line-height:1.55; color:#64748b; text-align:center;">
                          Se você não fez essa solicitação, ignore este e-mail. O link expira em 1 hora.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 28px 24px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;">
                          <tr>
                            <td style="padding-top:14px; font-size:12px; line-height:1.5; color:#64748b; text-align:center;">
                              Esta é uma mensagem automática. Não é necessário responder.<br/>
                              <a href="${contactUrl}" style="color:#0284c7; text-decoration:none;">Falar com o suporte</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
    res.status(200).json({ message: 'Link de redefinição de senha enviado.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar e-mail.', error: err.message });
  }
};

// Validação do token de redefinição de senha
export const validateResetToken = async (req, res) => {
  const { token } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token não fornecido.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ valid: false, message: 'Usuário não encontrado.' });
    }

    res.status(200).json({ valid: true, message: 'Token válido.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ valid: false, message: 'Token expirado. Solicite um novo código.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ valid: false, message: 'Token inválido.' });
    }
    return res.status(500).json({ valid: false, message: 'Erro ao validar token.', error: err.message });
  }
};

// Confirmação da redefinição de senha
export const confirmResetPassword = async (req, res) => {
  const { senha, token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: 'Usuário não encontrado.' });
    }

    // Criptografando a nova senha
    const hashedPassword = await bcrypt.hash(senha, 10);
    user.senha = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao redefinir a senha.', error: err.message });
  }
};

// Obter dados do usuário logado
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-senha -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      _id: user._id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      genero: user.genero,
      crm: user.crm,
      rqe: user.rqe,
      areaAtuacao: user.areaAtuacao,
      telefonePessoal: user.telefonePessoal,
      telefoneConsultorio: user.telefoneConsultorio,
      cep: user.cep,
      enderecoConsultorio: user.enderecoConsultorio,
      numeroConsultorio: user.numeroConsultorio,
      complemento: user.complemento,
      bairro: user.bairro,
      cidade: user.cidade,
      estado: user.estado,
      foto: user.foto
    });
  } catch (err) {
    console.error('Erro ao buscar dados do usuário:', err);
    res.status(500).json({ message: 'Erro ao buscar dados do usuário.', error: err.message });
  }
};

// Atualizar perfil do usuário
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const { nome, email, areaAtuacao } = req.body;

    // Verificar se o email já existe em outro usuário
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ error: 'Este email já está em uso por outro usuário' });
      }
      user.email = email;
    }

    if (nome !== undefined) {
      user.nome = nome;
    }

    if (areaAtuacao !== undefined) {
      user.areaAtuacao = areaAtuacao;
    }

    await user.save();

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        nome: user.nome,
        email: user.email,
        areaAtuacao: user.areaAtuacao
      }
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Este email já está em uso' });
    }
    res.status(500).json({ message: 'Erro ao atualizar perfil.', error: err.message });
  }
};

// Alterar senha do usuário
export const changePassword = async (req, res) => {
  try {
    const { senhaAtual, senha } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (!senhaAtual) {
      return res.status(400).json({ error: 'A senha atual é obrigatória' });
    }

    const isMatch = await bcrypt.compare(senhaAtual, user.senha);
    if (!isMatch) {
      return res.status(400).json({ error: 'A senha atual está incorreta' });
    }

    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    const isSamePassword = await bcrypt.compare(senha, user.senha);
    if (isSamePassword) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    user.senha = hashedPassword;
    await user.save();

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    res.status(500).json({ message: 'Erro ao alterar senha.', error: err.message });
  }
};

// Excluir conta do usuário
export const deleteAccount = async (req, res) => {
  try {
    const { senha } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verificar se a senha está correta
    const isMatch = await bcrypt.compare(senha, user.senha);
    if (!isMatch) {
      return res.status(400).json({ error: 'Senha incorreta' });
    }

    // Excluir o usuário
    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Conta excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir conta:', err);
    res.status(500).json({ message: 'Erro ao excluir conta.', error: err.message });
  }
};
