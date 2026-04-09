import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { sendHtmlEmail } from '../services/emailService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'contact-messages.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function submitContact(req, res) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!name || name.length > 200) {
      return res.status(400).json({ ok: false, error: 'invalid_name' });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email' });
    }
    if (message.length < 10 || message.length > 8000) {
      return res.status(400).json({ ok: false, error: 'invalid_message' });
    }

    await fs.mkdir(DATA_DIR, { recursive: true });

    let list = [];
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }

    list.push({
      id: randomUUID(),
      name,
      email,
      message,
      createdAt: new Date().toISOString()
    });

    await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');

    const notifyTo =
      process.env.CONTACT_NOTIFY_EMAIL ||
      process.env.GMAIL_USER ||
      'pulseflowsaude@gmail.com';

    // Responde já: SMTP/API pode demorar vários segundos e o browser trata como falha/CORS.
    res.json({ ok: true });

    void sendHtmlEmail({
      to: notifyTo,
      subject: `[PulseFlow] Contato — ${name}`,
      html: `<p><b>De:</b> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p><b>Mensagem:</b></p><pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message)}</pre>`
    }).catch((err) => {
      console.warn('[contact] aviso: notificação por e-mail falhou (mensagem gravada em disco):', err.message);
    });
  } catch (err) {
    console.error('[contact]', err);
    res.status(500).json({ ok: false, error: 'server' });
  }
}
