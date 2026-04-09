import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWSLETTER_FILE = path.join(DATA_DIR, 'newsletter-subscribers.json');
const CONTACT_FILE = path.join(DATA_DIR, 'contact-messages.json');
const AUDIT_FILE = path.join(DATA_DIR, 'admin-audit.json');

const MAX_AUDIT = 3000;

export async function recordAdminAudit(req, action, detail) {
  await appendAudit({ adminId: req.user?._id, action, detail });
}

async function appendAudit({ adminId, action, detail }) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    let list = [];
    try {
      const raw = await fs.readFile(AUDIT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
    list.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      adminUserId: adminId ? String(adminId) : '',
      action,
      detail: detail && typeof detail === 'object' ? detail : { info: String(detail || '') }
    });
    if (list.length > MAX_AUDIT) {
      list = list.slice(-MAX_AUDIT);
    }
    await fs.writeFile(AUDIT_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('[admin-audit]', e.message);
  }
}

async function readNewsletterList() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(NEWSLETTER_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readContactListWithIds() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let list = [];
  try {
    const raw = await fs.readFile(CONTACT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    list = Array.isArray(parsed) ? parsed : [];
  } catch {
    list = [];
  }
  let mutated = false;
  for (const item of list) {
    if (item && !item.id) {
      item.id = randomUUID();
      mutated = true;
    }
  }
  if (mutated) {
    await fs.writeFile(CONTACT_FILE, JSON.stringify(list, null, 2), 'utf8');
  }
  return list;
}

export async function listNewsletterSubscribers(req, res) {
  try {
    const list = await readNewsletterList();
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.subscribedAt || 0).getTime();
      const tb = new Date(b.subscribedAt || 0).getTime();
      return tb - ta;
    });
    res.json({ items: sorted, total: sorted.length });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao listar newsletter' });
  }
}

export async function exportNewsletterCsv(req, res) {
  try {
    const list = await readNewsletterList();
    const lines = ['email,subscribedAt,source'];
    for (const row of list) {
      if (!row || !row.email) continue;
      const email = String(row.email).replace(/"/g, '""');
      const at = String(row.subscribedAt || '').replace(/"/g, '""');
      const src = String(row.source || '').replace(/"/g, '""');
      lines.push(`"${email}","${at}","${src}"`);
    }
    const csv = lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pulseflow-newsletter.csv"');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).send(e.message || 'Erro');
  }
}

export async function removeNewsletterSubscriber(req, res) {
  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : typeof req.query?.email === 'string'
          ? req.query.email.trim().toLowerCase()
          : '';
    if (!email) {
      return res.status(400).json({ message: 'Informe o e-mail.' });
    }
    const list = await readNewsletterList();
    const next = list.filter((e) => !e || String(e.email).toLowerCase() !== email);
    if (next.length === list.length) {
      return res.status(404).json({ message: 'E-mail não encontrado na lista.' });
    }
    await fs.writeFile(NEWSLETTER_FILE, JSON.stringify(next, null, 2), 'utf8');
    await appendAudit({
      adminId: req.user?._id,
      action: 'newsletter_remove',
      detail: { email }
    });
    res.json({ ok: true, removed: email });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao remover' });
  }
}

export async function listContactMessages(req, res) {
  try {
    const list = await readContactListWithIds();
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    res.json({ items: sorted, total: sorted.length });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao listar mensagens' });
  }
}

export async function removeContactMessage(req, res) {
  try {
    const id = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
    if (!id) {
      return res.status(400).json({ message: 'ID inválido.' });
    }
    const list = await readContactListWithIds();
    const next = list.filter((item) => item && item.id !== id);
    if (next.length === list.length) {
      return res.status(404).json({ message: 'Mensagem não encontrada.' });
    }
    await fs.writeFile(CONTACT_FILE, JSON.stringify(next, null, 2), 'utf8');
    await appendAudit({
      adminId: req.user?._id,
      action: 'contact_remove',
      detail: { messageId: id }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao remover' });
  }
}

export async function getAuditLog(req, res) {
  try {
    let list = [];
    try {
      const raw = await fs.readFile(AUDIT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(String(req.query.limit || '30'), 10) || 30));
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.at || 0).getTime();
      const tb = new Date(b.at || 0).getTime();
      return tb - ta;
    });
    const total = sorted.length;
    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, total, page, limit, totalPages });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao ler auditoria' });
  }
}
