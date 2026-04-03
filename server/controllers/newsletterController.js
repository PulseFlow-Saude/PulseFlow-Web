import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'newsletter-subscribers.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeNewsletter(req, res) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email' });
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

    const exists = list.some((e) => e && e.email === email);
    if (exists) {
      return res.json({ ok: true, already: true });
    }

    list.push({
      email,
      subscribedAt: new Date().toISOString(),
      source: 'footer'
    });

    await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    console.error('[newsletter]', err);
    res.status(500).json({ ok: false, error: 'server' });
  }
}
