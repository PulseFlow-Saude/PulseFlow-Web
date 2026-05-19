import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '..');
export const DEFAULT_DB_PATH = path.join(SERVER_ROOT, 'data', 'medicos.db');

/** Caminho absoluto do SQLite (evita erro se o cwd não for a pasta server). */
export function resolveMedicosDbPath(envPath) {
  const raw = (envPath || '').trim() || DEFAULT_DB_PATH;
  return path.isAbsolute(raw) ? raw : path.resolve(SERVER_ROOT, raw);
}

export function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase();
}

export function normalizePhone(v) {
  const d = onlyDigits(v);
  if (d.length >= 11 && d.startsWith('55')) return d.slice(2);
  return d;
}

export function openMedicosDb(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fonte TEXT,
      nome TEXT,
      cpf TEXT,
      email TEXT,
      telefone TEXT,
      telefone2 TEXT,
      cns TEXT,
      crm TEXT,
      crm_uf TEXT,
      cbo TEXT,
      uf TEXT,
      municipio TEXT,
      estabelecimento TEXT,
      cnes TEXT,
      area_atuacao TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_medicos_cpf ON medicos(cpf);
    CREATE INDEX IF NOT EXISTS idx_medicos_email ON medicos(email);
    CREATE INDEX IF NOT EXISTS idx_medicos_tel ON medicos(telefone);
    CREATE INDEX IF NOT EXISTS idx_medicos_tel2 ON medicos(telefone2);
    CREATE INDEX IF NOT EXISTS idx_medicos_cns ON medicos(cns);
    CREATE INDEX IF NOT EXISTS idx_medicos_crm ON medicos(crm, crm_uf);
    CREATE INDEX IF NOT EXISTS idx_medicos_nome ON medicos(nome);
  `);
  return db;
}

export function insertMedicoBatch(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO medicos (
      fonte, nome, cpf, email, telefone, telefone2, cns, crm, crm_uf,
      cbo, uf, municipio, estabelecimento, cnes, area_atuacao
    ) VALUES (
      @fonte, @nome, @cpf, @email, @telefone, @telefone2, @cns, @crm, @crm_uf,
      @cbo, @uf, @municipio, @estabelecimento, @cnes, @area_atuacao
    )
  `);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  tx(rows);
}

export function mapRowToRecord(row, fonte = 'cnes') {
  const cpf = onlyDigits(row.cpf || row.CPF);
  const tel1 = normalizePhone(row.telefone || row.telefonePessoal || row.TELEFONE);
  const tel2 = normalizePhone(row.telefone2 || row.telefoneConsultorio || row.TELEFONE2);
  return {
    fonte,
    nome: String(row.nome || row.NOME || '').trim(),
    cpf: cpf.length === 11 ? cpf : cpf || '',
    email: normalizeEmail(row.email || row.EMAIL),
    telefone: tel1,
    telefone2: tel2,
    cns: onlyDigits(row.cns || row.CNS),
    crm: onlyDigits(row.crm || row.registroConselho || row.CRM || row.registro),
    crm_uf: String(row.crm_uf || row.crmUf || row.uf || row.UF || '').toUpperCase().slice(0, 2),
    cbo: onlyDigits(row.cbo || row.CBO),
    uf: String(row.uf || row.UF || '').toUpperCase().slice(0, 2),
    municipio: String(row.municipio || row.MUNICIPIO || '').trim(),
    estabelecimento: String(row.estabelecimento || row.ESTABELECIMENTO || '').trim(),
    cnes: onlyDigits(row.cnes || row.codigoEstabelecimentoCnes || row.CNES),
    area_atuacao: String(row.area_atuacao || row.areaAtuacao || row.DESCRICAO_CBO || '').trim()
  };
}

export function searchMedicos(db, { cpf, email, telefone, nome, crm, crmUf, cns, limit = 10 }) {
  const cap = Math.min(20, Math.max(1, limit));
  if (cpf) {
    const d = onlyDigits(cpf);
    return db.prepare(`SELECT * FROM medicos WHERE cpf = ? LIMIT ?`).all(d, cap);
  }
  if (email) {
    const e = normalizeEmail(email);
    return db.prepare(`SELECT * FROM medicos WHERE email = ? LIMIT ?`).all(e, cap);
  }
  if (telefone) {
    const t = normalizePhone(telefone);
    return db
      .prepare(`SELECT * FROM medicos WHERE telefone = ? OR telefone2 = ? LIMIT ?`)
      .all(t, t, cap);
  }
  if (cns) {
    const c = onlyDigits(cns);
    return db.prepare(`SELECT * FROM medicos WHERE cns = ? LIMIT ?`).all(c, cap);
  }
  if (crm) {
    const n = onlyDigits(crm);
    const uf = String(crmUf || '').toUpperCase();
    if (uf) {
      return db.prepare(`SELECT * FROM medicos WHERE crm = ? AND crm_uf = ? LIMIT ?`).all(n, uf, cap);
    }
    return db.prepare(`SELECT * FROM medicos WHERE crm = ? LIMIT ?`).all(n, cap);
  }
  if (nome) {
    const term = `%${String(nome).trim()}%`;
    return db
      .prepare(`SELECT * FROM medicos WHERE nome LIKE ? COLLATE NOCASE LIMIT ?`)
      .all(term, cap);
  }
  return [];
}

export function countMedicos(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM medicos').get().n;
}

export function formatMedicoForTelegram(m) {
  const lines = [
    `👤 ${m.nome || '—'}`,
    m.cpf ? `🪪 CPF: ${m.cpf}` : null,
    m.email ? `📧 E-mail: ${m.email}` : null,
    m.telefone ? `📱 Tel.: ${m.telefone}` : null,
    m.telefone2 ? `📞 Tel. 2: ${m.telefone2}` : null,
    m.cns ? `🏥 CNS: ${m.cns}` : null,
    m.crm ? `📋 CRM: ${m.crm}${m.crm_uf ? `-${m.crm_uf}` : ''}` : null,
    m.area_atuacao ? `⚕️ ${m.area_atuacao}` : m.cbo ? `CBO: ${m.cbo}` : null,
    m.municipio || m.uf ? `📍 ${[m.municipio, m.uf].filter(Boolean).join(' / ')}` : null,
    m.estabelecimento ? `🏢 ${m.estabelecimento}` : null,
    m.cnes ? `CNES: ${m.cnes}` : null,
    `Fonte: ${m.fonte || '—'}`
  ];
  return lines.filter(Boolean).join('\n');
}
