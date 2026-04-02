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

const parseSender = (fromHeader, fallbackEmail) => {
  const raw = sanitizeEnv(fromHeader) || sanitizeEnv(fallbackEmail) || '';
  const m = /^(.+?)\s*<([^>]+)>$/.exec(raw.trim());
  if (m) {
    return {
      name: m[1].replace(/^["']|["']$/g, '').trim() || 'PulseFlow',
      email: m[2].trim(),
    };
  }
  if (raw.includes('@')) {
    return { name: 'PulseFlow', email: raw.trim() };
  }
  return { name: 'PulseFlow', email: sanitizeEnv(fallbackEmail) || 'invalid@localhost' };
};

const hasBrevoApiKey = () => Boolean(sanitizeEnv(process.env.BREVO_API_KEY));

const isRender = () => isTruthy(process.env.RENDER);

/** No Render o SMTP de saída costuma bloquear; a API Brevo em HTTPS funciona. */
const shouldPreferBrevoApiFirst = () =>
  hasBrevoApiKey() &&
  (isTruthy(process.env.EMAIL_BREVO_API_FIRST) || isTruthy(process.env.RENDER));

/**
 * Brevo Transactional API (HTTPS :443). Funciona no Render onde SMTP costuma dar timeout.
 * Chave em Brevo: SMTP & API → API keys (formato xkeysib-...), não é a senha SMTP xsmtpsib-.
 */
const sendViaBrevoRestApi = async ({ to, subject, html, from }) => {
  const apiKey = sanitizeEnv(process.env.BREVO_API_KEY);
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurado');
  }

  const smtpFrom =
    from ||
    sanitizeEnv(process.env.BREVO_SMTP_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM);
  const sender = parseSender(smtpFrom, process.env.GMAIL_USER || process.env.BREVO_SMTP_USER);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: Array.isArray(to) ? to[0] : to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API HTTP ${res.status}: ${text}`);
  }
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

const tryBrevoRestOrThrow = async (params, smtpContextLabel) => {
  if (!hasBrevoApiKey()) {
    throw new Error(
      `Sem BREVO_API_KEY. No Render o SMTP costuma dar timeout; crie uma chave de API (xkeysib) em Brevo → SMTP & API → API keys e adicione BREVO_API_KEY. Detalhe SMTP: ${smtpContextLabel}`
    );
  }
  console.warn('[email] tentando Brevo API (HTTPS):', smtpContextLabel);
  await sendViaBrevoRestApi(params);
};

/**
 * Ordem típica: Gmail SMTP → Brevo SMTP → Brevo API (se BREVO_API_KEY).
 * No Render, SMTP costuma dar timeout; com BREVO_API_KEY a API é tentada primeiro (RENDER ou EMAIL_BREVO_API_FIRST).
 * @param {{ to: string; subject: string; html: string; from?: string }} params
 */
export const sendHtmlEmail = async ({ to, subject, html, from }) => {
  const params = { to, subject, html, from };

  if (isRender() && !hasBrevoApiKey()) {
    throw new Error(
      'Render: defina BREVO_API_KEY (Brevo → SMTP & API → API keys, chave xkeysib-..., não é a senha SMTP xsmtpsib). SMTP de saída costuma ser bloqueado neste host.'
    );
  }

  if (shouldPreferBrevoApiFirst()) {
    try {
      await sendViaBrevoRestApi(params);
      return;
    } catch (err) {
      console.warn('[email] Brevo API (prioritário) falhou:', err.message);
      if (isRender()) {
        throw new Error(
          `Brevo API falhou no Render: ${err.message}. Verifique BREVO_API_KEY, remetente/domínio verificados no Brevo e SMTP_FROM.`
        );
      }
      console.warn('[email] tentando SMTP (ambiente local)...');
    }
  }

  if (hasGmailCredentials()) {
    try {
      await sendViaGmail(params);
      return;
    } catch (err) {
      if (hasBrevoCredentials()) {
        console.warn('[email] Gmail falhou; tentando Brevo SMTP:', err.message);
        try {
          await sendViaBrevo(params);
          return;
        } catch (err2) {
          try {
            await tryBrevoRestOrThrow(
              params,
              `Gmail: ${err.message} | Brevo SMTP: ${err2.message}`
            );
            return;
          } catch (err3) {
            throw new Error(
              `Falha no envio de email (Gmail, Brevo SMTP e Brevo API). ${err3.message}`
            );
          }
        }
      }
      if (hasBrevoApiKey()) {
        try {
          await tryBrevoRestOrThrow(params, err.message);
          return;
        } catch (err2) {
          throw new Error(`Falha no envio de email (Gmail e Brevo API). Gmail: ${err.message} | API: ${err2.message}`);
        }
      }
      throw new Error(`Falha no envio de email (Gmail): ${err.message}`);
    }
  }

  if (hasBrevoCredentials()) {
    try {
      await sendViaBrevo(params);
      return;
    } catch (err) {
      try {
        await tryBrevoRestOrThrow(params, err.message);
        return;
      } catch (err2) {
        throw new Error(`Falha no envio de email (Brevo SMTP e API). ${err2.message}`);
      }
    }
  }

  if (hasBrevoApiKey()) {
    try {
      await sendViaBrevoRestApi(params);
      return;
    } catch (err) {
      throw new Error(`Falha no envio de email (Brevo API): ${err.message}`);
    }
  }

  if (hasLegacySingleSmtp()) {
    try {
      await sendViaLegacySmtp(params);
      return;
    } catch (err) {
      throw new Error(`Falha no envio de email (SMTP legado): ${err.message}`);
    }
  }

  throw new Error(
    'Configure envio de email: Gmail + Brevo SMTP, ou BREVO_API_KEY (API Brevo, recomendado no Render), ou SMTP legado.'
  );
};
