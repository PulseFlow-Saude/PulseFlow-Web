import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

const isTruthy = (value) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

/** @returns {'resend'|'sendgrid'|'smtp'} */
export const resolveEmailProvider = () => {
  const explicit = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'resend') return 'resend';
  if (explicit === 'sendgrid') return 'sendgrid';
  if (explicit === 'smtp') return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (isTruthy(process.env.USE_SENDGRID) && process.env.SENDGRID_API_KEY) return 'sendgrid';
  return 'smtp';
};

let resendClient;

const getResend = () => {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

const getResendFrom = () => {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  return from || 'PulseFlow <onboarding@resend.dev>';
};

const sendViaResend = async ({ to, subject, html, from }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY não configurado');
  }
  const { error } = await getResend().emails.send({
    from: from || getResendFrom(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
  if (error) {
    throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
  }
};

const sendViaSendGrid = async ({ to, subject, html, from }) => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY não configurado');
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const fromEmail = from || process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER;
  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL ou EMAIL_USER não configurado');
  }
  await sgMail.send({ to, from: fromEmail, subject, html });
};

const sendViaSmtp = async ({ to, subject, html, from }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Configuração de email não disponível');
  }
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = process.env.SMTP_SECURE
    ? isTruthy(process.env.SMTP_SECURE)
    : smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: { rejectUnauthorized: true },
  });

  await transporter.sendMail({
    from: from || process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};

/**
 * Envia e-mail HTML usando o provedor configurado (Resend, SendGrid ou SMTP).
 * @param {{ to: string; subject: string; html: string; from?: string }} params
 */
export const sendHtmlEmail = async ({ to, subject, html, from }) => {
  const provider = resolveEmailProvider();
  try {
    if (provider === 'resend') {
      await sendViaResend({ to, subject, html, from });
      return;
    }
    if (provider === 'sendgrid') {
      await sendViaSendGrid({ to, subject, html, from });
      return;
    }
    await sendViaSmtp({ to, subject, html, from });
  } catch (err) {
    throw new Error(`Falha no envio de e-mail (${provider}): ${err.message}`);
  }
};
