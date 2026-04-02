import nodemailer from 'nodemailer';

const isTruthy = (value) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

/** Remove aspas extras que às vezes vêm do painel Render / .env */
const sanitizeEnv = (v) => {
  if (v == null) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

const createTransport = ({ host, port, secure, user, pass }) =>
  nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000,
    tls: {
      rejectUnauthorized: true,
      servername: host,
    },
  });

const sendWithTransport = async (transporter, { from, to, subject, html }) => {
  await transporter.sendMail({ from, to, subject, html });
};

/** Gmail: senha de app em https://myaccount.google.com/apppasswords */
const hasGmailCredentials = () => {
  const user = sanitizeEnv(process.env.GMAIL_USER);
  const pass = sanitizeEnv(process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS);
  return Boolean(user && pass);
};

const hasBrevoCredentials = () => {
  const user = sanitizeEnv(process.env.BREVO_SMTP_USER);
  const pass = sanitizeEnv(process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS);
  return Boolean(user && pass);
};

const hasLegacySingleSmtp = () => {
  const user = sanitizeEnv(process.env.EMAIL_USER);
  const pass = sanitizeEnv(process.env.EMAIL_PASS);
  return Boolean(user && pass);
};

const sendViaGmail = async ({ to, subject, html, from }) => {
  const emailUser = sanitizeEnv(process.env.GMAIL_USER);
  const emailPass = sanitizeEnv(process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS);
  const host = sanitizeEnv(process.env.GMAIL_SMTP_HOST) || 'smtp.gmail.com';
  const port = Number(process.env.GMAIL_SMTP_PORT || 587);
  const secure = process.env.GMAIL_SMTP_SECURE
    ? isTruthy(process.env.GMAIL_SMTP_SECURE)
    : port === 465;

  const smtpFrom =
    from ||
    sanitizeEnv(process.env.GMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM) ||
    emailUser;

  const transporter = createTransport({ host, port, secure, user: emailUser, pass: emailPass });
  await sendWithTransport(transporter, { from: smtpFrom, to, subject, html });
};

const sendViaBrevo = async ({ to, subject, html, from }) => {
  const emailUser = sanitizeEnv(process.env.BREVO_SMTP_USER);
  const emailPass = sanitizeEnv(process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS);
  const host = sanitizeEnv(process.env.BREVO_SMTP_HOST) || 'smtp-relay.brevo.com';
  const port = Number(process.env.BREVO_SMTP_PORT || 587);
  const secure = process.env.BREVO_SMTP_SECURE
    ? isTruthy(process.env.BREVO_SMTP_SECURE)
    : port === 465;

  const smtpFrom =
    from ||
    sanitizeEnv(process.env.BREVO_SMTP_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM) ||
    emailUser;

  const transporter = createTransport({ host, port, secure, user: emailUser, pass: emailPass });
  await sendWithTransport(transporter, { from: smtpFrom, to, subject, html });
};

/** Um único SMTP genérico (legado): EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT… */
const sendViaLegacySmtp = async ({ to, subject, html, from }) => {
  const emailUser = sanitizeEnv(process.env.EMAIL_USER);
  const emailPass = sanitizeEnv(process.env.EMAIL_PASS);
  const host = sanitizeEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE
    ? isTruthy(process.env.SMTP_SECURE)
    : port === 465;

  const smtpFrom =
    from ||
    sanitizeEnv(process.env.SMTP_FROM || process.env.EMAIL_FROM) ||
    emailUser;

  const transporter = createTransport({ host, port, secure, user: emailUser, pass: emailPass });
  await sendWithTransport(transporter, { from: smtpFrom, to, subject, html });
};

/**
 * Ordem: (1) Gmail se GMAIL_USER + GMAIL_APP_PASSWORD; em falha → Brevo se BREVO_*.
 * Se não houver Gmail: só Brevo, ou só SMTP legado (EMAIL_USER + EMAIL_PASS).
 * @param {{ to: string; subject: string; html: string; from?: string }} params
 */
export const sendHtmlEmail = async ({ to, subject, html, from }) => {
  if (hasGmailCredentials()) {
    try {
      await sendViaGmail({ to, subject, html, from });
      return;
    } catch (err) {
      if (hasBrevoCredentials()) {
        console.warn('[email] Gmail falhou; tentando Brevo:', err.message);
        try {
          await sendViaBrevo({ to, subject, html, from });
          return;
        } catch (err2) {
          throw new Error(
          `Falha no envio de email (Gmail e Brevo). Gmail: ${err.message} | Brevo: ${err2.message}`
        );
        }
      }
      throw new Error(`Falha no envio de email (Gmail): ${err.message}`);
    }
  }

  if (hasBrevoCredentials()) {
    try {
      await sendViaBrevo({ to, subject, html, from });
      return;
    } catch (err) {
      throw new Error(`Falha no envio de email (Brevo): ${err.message}`);
    }
  }

  if (hasLegacySingleSmtp()) {
    try {
      await sendViaLegacySmtp({ to, subject, html, from });
      return;
    } catch (err) {
      throw new Error(`Falha no envio de email (SMTP legado): ${err.message}`);
    }
  }

  throw new Error(
    'Configure envio de email: Gmail (GMAIL_USER + GMAIL_APP_PASSWORD) e opcionalmente Brevo (BREVO_SMTP_USER + BREVO_SMTP_KEY), ou SMTP legado (EMAIL_USER + EMAIL_PASS).'
  );
};
