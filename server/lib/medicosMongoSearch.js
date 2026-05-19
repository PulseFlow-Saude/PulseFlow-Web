import mongoose from 'mongoose';
import User from '../models/User.js';
import MedicoCnes from '../models/MedicoCnes.js';
import { filterUsersWhoAreNotAdmins } from '../utils/userAdminFlags.js';
import MedicoContato from '../models/MedicoContato.js';
import {
  buscarRegistrosExternos,
  findBestNameMatch,
  formatRegistroPessoa,
  formatarResultadoApi,
  tipoBuscaParaConsulta,
  clearConsultaCache
} from './consultaExterna.js';
import { enrichCnesRecord } from './medicoEnriquecimento.js';

function normalizeNomeBusca(n) {
  return String(n ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeCnesPorPessoa(items) {
  const map = new Map();
  for (const m of items) {
    const key = `${normalizeNomeBusca(m.nome)}|${String(m.uf || '').toUpperCase()}`;
    if (!map.has(key)) map.set(key, m);
  }
  return [...map.values()];
}

export function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase();
}

async function enrichFromApi(m) {
  const cpf = onlyDigits(m.cpf);
  if (cpf.length === 11) {
    const { ok, records } = await buscarRegistrosExternos('cpf', cpf);
    if (ok && records?.length) return records[0];
  }
  if (m.nome?.trim()) {
    const { ok, records } = await buscarRegistrosExternos('nome', m.nome.trim());
    if (ok && records?.length) return findBestNameMatch(records, m.nome, m.uf, m.municipio);
  }
  return null;
}

function pickTelefone(...vals) {
  for (const v of vals) {
    const d = onlyDigits(v);
    if (d.length >= 10) return String(v).trim();
  }
  return null;
}

function pickEmail(...vals) {
  for (const v of vals) {
    const e = normalizeEmail(v);
    if (e && e.includes('@')) return e;
  }
  return null;
}

/** CNES + API + PulseFlow + planilha + tel. unidade. */
export async function formatMedicoTelegram(m) {
  const [api, enriquecido] = await Promise.all([enrichFromApi(m), enrichCnesRecord(m)]);
  const pf = enriquecido.pulseflow?.user;
  const contato = enriquecido.contato;
  const est = enriquecido.estabelecimento;

  const telefone = pickTelefone(pf?.telefonePessoal, contato?.telefone, api?.telefone);
  const email = pickEmail(pf?.email, contato?.email, api?.email);
  const telConsultorio = pickTelefone(pf?.telefoneConsultorio);

  const rec = {
    nome: m.nome,
    cpf: m.cpf || api?.cpf || pf?.cpf || contato?.cpf,
    cns: m.cns || api?.cns,
    data_nascimento: api?.data_nascimento,
    sexo: api?.sexo,
    mae: api?.mae,
    telefone,
    email,
    municipio: m.municipio || api?.municipio || pf?.cidade,
    uf: m.uf || api?.uf || pf?.estado
  };

  const crm =
    m.registroConselho && m.conselho
      ? `${m.registroConselho}-${m.uf || ''}`
      : m.registroConselho
        ? `${m.registroConselho}${m.uf ? `-${m.uf}` : ''}`
        : pf?.crm
          ? `${pf.crm}${pf.crmUf ? `-${pf.crmUf}` : ''}`
          : null;

  const lines = [formatRegistroPessoa(rec, { nomeFallback: m.nome, cbo: m.cbo, crm, cnesUnidade: m.codigoEstabelecimentoCnes })];

  if (telConsultorio && onlyDigits(telConsultorio) !== onlyDigits(telefone)) {
    lines.push(`📞 Consultório: ${telConsultorio}`);
  }
  if (est?.telefone) lines.push(`📞 Tel. unidade (CNES): ${est.telefone}`);
  if (est?.email && !email) lines.push(`📧 E-mail unidade: ${est.email}`);
  if (contato?.baseLegal) lines.push(`📋 Base legal: ${contato.baseLegal}`);
  if (!telefone && !email && !telConsultorio && !est?.telefone) {
    lines.push('_Sem e-mail/tel. pessoal nesta base._');
  }

  return lines.join('\n');
}

export function formatContatoImportado(c) {
  const lines = [
    `👤 *${c.nome || '—'}*`,
    c.cpf ? `🪪 CPF: \`${c.cpf}\`` : null,
    c.email ? `📧 E-mail: ${c.email}` : null,
    c.telefone ? `📱 Tel.: ${c.telefone}` : null,
    c.crm ? `📋 CRM: ${c.crm}${c.crmUf ? `-${c.crmUf}` : ''}` : null,
    c.municipio || c.uf ? `📍 ${[c.municipio, c.uf].filter(Boolean).join(' / ')}` : null,
    `Fonte: planilha (${c.baseLegal || 'importação'})`
  ];
  return lines.filter(Boolean).join('\n');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function digitsFlexibleRegex(digits) {
  if (!digits) return null;
  return new RegExp(`^${digits.split('').map(escapeRegex).join('\\D*')}$`);
}

function baseUserFilter() {
  return filterUsersWhoAreNotAdmins();
}

export function formatUserForTelegram(u) {
  const lines = [
    `👤 ${u.nome || '—'}`,
    u.cpf ? `🪪 CPF: ${u.cpf}` : null,
    u.email ? `📧 E-mail: ${u.email}` : null,
    u.telefonePessoal ? `📱 Tel.: ${u.telefonePessoal}` : null,
    u.telefoneConsultorio ? `📞 Consultório: ${u.telefoneConsultorio}` : null,
    u.crm ? `📋 CRM: ${u.crm}${u.crmUf ? `-${u.crmUf}` : ''}` : null,
    u.npi ? `NPI: ${u.npi}` : null,
    u.areaAtuacao ? `⚕️ ${u.areaAtuacao}` : null,
    u.cidade || u.estado ? `📍 ${[u.cidade, u.estado].filter(Boolean).join(' / ')}` : null,
    u.validationStatus ? `Status: ${u.validationStatus}` : null,
    `Fonte: PulseFlow`
  ];
  return lines.filter(Boolean).join('\n');
}

/** Todas as colunas do Excel CNES (sempre exibidas). */
export const CNES_COLUNAS = [
  'nome',
  'cpf',
  'cns',
  'cbo',
  'uf',
  'municipio',
  'conselho',
  'registroConselho',
  'codigoEstabelecimentoCnes',
  'fonte',
  'competencia'
];

export const CNES_PAGE_SIZE = 2;

export function formatCnesFull(m, extraLines = '') {
  const row = {
    nome: m.nome,
    cpf: m.cpf,
    cns: m.cns,
    cbo: m.cbo,
    uf: m.uf,
    municipio: m.municipio,
    conselho: m.conselho,
    registroConselho: m.registroConselho,
    codigoEstabelecimentoCnes: m.codigoEstabelecimentoCnes,
    fonte: m.fonte,
    competencia: m.competencia
  };
  const base = CNES_COLUNAS.map((k) => `${k}: ${row[k] ?? '—'}`).join('\n');
  return extraLines ? `${base}\n\n${extraLines}` : base;
}

/** CNES + fontes legais (PulseFlow, importação LGPD, tel. unidade DATASUS). */
export async function formatCnesEnriquecido(m) {
  const { formatEnriquecimentoCompleto } = await import('./medicoEnriquecimento.js');
  const extras = await formatEnriquecimentoCompleto(m);
  return formatCnesFull(m, extras);
}

export function formatCnesForTelegram(m) {
  return formatCnesFull(m);
}

const USER_SELECT =
  'nome email cpf crm crmUf npi areaAtuacao telefonePessoal telefoneConsultorio cidade estado validationStatus country';

export async function countMedicosPulseflow() {
  return User.countDocuments(baseUserFilter());
}

export async function countMedicosCnes() {
  return MedicoCnes.estimatedDocumentCount();
}

export async function searchMedicosPulseflow(type, value, limit = 5) {
  const cap = Math.min(10, Math.max(1, limit));
  const base = baseUserFilter();
  let query = null;

  if (type === 'cpf') {
    const d = onlyDigits(value);
    if (d.length !== 11) return [];
    query = { $and: [base, { cpf: digitsFlexibleRegex(d) }] };
  } else if (type === 'email') {
    const e = normalizeEmail(value);
    if (!e) return [];
    query = { $and: [base, { email: new RegExp(`^${escapeRegex(e)}$`, 'i') }] };
  } else if (type === 'telefone') {
    const d = onlyDigits(value);
    if (d.length < 10) return [];
    const rx = digitsFlexibleRegex(d);
    query = { $and: [base, { $or: [{ telefonePessoal: rx }, { telefoneConsultorio: rx }] }] };
  } else if (type === 'nome') {
    const term = String(value).trim();
    if (!term) return [];
    query = { $and: [base, { nome: new RegExp(escapeRegex(term), 'i') }] };
  } else if (type === 'crm') {
    const parts = String(value).trim().split(/\s+/);
    const n = onlyDigits(parts[0]);
    if (!n) return [];
    const uf = (parts[1] || '').toUpperCase().slice(0, 2);
    const and = [base, { crm: new RegExp(`^${escapeRegex(n)}$`, 'i') }];
    if (uf) and.push({ crmUf: uf });
    query = { $and: and };
  } else if (type === 'cns') {
    return [];
  } else {
    return [];
  }

  return User.find(query).select(USER_SELECT).limit(cap).lean();
}

export async function searchMedicosCnes(type, value, limit = 10) {
  const cap = Math.min(15, Math.max(1, limit));
  let query = null;

  if (type === 'nome') {
    const term = String(value).trim();
    if (!term) return [];
    query = { nome: new RegExp(escapeRegex(term), 'i') };
  } else if (type === 'cns') {
    const c = onlyDigits(value);
    if (!c) return [];
    query = { cns: c };
  } else if (type === 'crm') {
    const parts = String(value).trim().split(/\s+/);
    const n = onlyDigits(parts[0]);
    if (!n) return [];
    const uf = (parts[1] || '').toUpperCase().slice(0, 2);
    query = { registroConselho: n };
    if (uf) query.uf = uf;
  } else if (type === 'cpf') {
    const d = onlyDigits(value);
    if (d.length !== 11) return [];
    query = { cpf: d };
  } else {
    return [];
  }

  return MedicoCnes.find(query).limit(cap).lean();
}

export async function searchMedicosContato(type, value, limit = 10) {
  const cap = Math.min(10, Math.max(1, limit));
  if (type === 'email') {
    const e = normalizeEmail(value);
    if (!e) return [];
    return MedicoContato.find({ email: new RegExp(escapeRegex(e), 'i') }).limit(cap).lean();
  }
  if (type === 'telefone') {
    const d = onlyDigits(value);
    if (d.length < 10) return [];
    const rx = digitsFlexibleRegex(d);
    return MedicoContato.find({ telefone: rx }).limit(cap).lean();
  }
  if (type === 'nome') {
    const term = String(value).trim();
    if (!term) return [];
    return MedicoContato.find({ nome: new RegExp(escapeRegex(term), 'i') }).limit(cap).lean();
  }
  if (type === 'cpf') {
    const d = onlyDigits(value);
    if (d.length !== 11) return [];
    return MedicoContato.find({ cpf: d }).limit(cap).lean();
  }
  return [];
}

/** Busca médicos — prioriza API externa (CPF/CNS) para nome/cpf/cns. */
export async function searchAllMedicos(type, value, limit = 10) {
  clearConsultaCache();
  const cap = Math.min(10, Math.max(1, limit));
  const extTipo = tipoBuscaParaConsulta(type);

  const blocks = [];

  if (extTipo) {
    const { ok, records, formatted } = await buscarRegistrosExternos(extTipo, value);
    if (ok) {
      const texto = formatarResultadoApi({ records: records.slice(0, cap), formatted });
      if (texto) blocks.push(texto);
    }
  }
  const contactTypes = ['email', 'telefone', 'cpf', 'nome'];
  const pulseLimit = contactTypes.includes(type) ? 5 : 0;

  if (pulseLimit > 0) {
    const users = await searchMedicosPulseflow(type, value, pulseLimit);
    for (const u of users) blocks.push(formatUserForTelegram(u));
  }

  if (['email', 'telefone', 'cpf', 'nome'].includes(type)) {
    const contatos = await searchMedicosContato(type, value, 5);
    for (const c of contatos) {
      if (blocks.length >= cap) break;
      blocks.push(formatContatoImportado(c));
    }
  }

  if (['nome', 'crm', 'cns'].includes(type)) {
    const cnes = await searchMedicosCnes(type, value, 15);
    const unicos = dedupeCnesPorPessoa(cnes);
    for (const m of unicos.slice(0, cap - blocks.length)) {
      blocks.push(await formatMedicoTelegram(m));
    }
  }

  return blocks.slice(0, cap);
}

export async function listCnesPage(page = 1, filter = {}) {
  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const skip = (p - 1) * CNES_PAGE_SIZE;
  const total = await MedicoCnes.countDocuments(filter);
  const items = await MedicoCnes.find(filter).sort({ _id: 1 }).skip(skip).limit(CNES_PAGE_SIZE).lean();
  const totalPages = Math.max(1, Math.ceil(total / CNES_PAGE_SIZE));
  return { items, page: p, totalPages, total, filter };
}

export function cnesRowsToCsv(rows) {
  const header = CNES_COLUNAS.join(';');
  const line = (m) =>
    CNES_COLUNAS.map((k) => String(m[k] ?? '').replace(/;/g, ',')).join(';');
  return `\uFEFF${header}\n${rows.map(line).join('\n')}`;
}

/** Exporta até `limit` linhas do CNES (busca ou página). */
export async function exportCnesCsv({ page, nome, limit = 500 }) {
  const cap = Math.min(2000, Math.max(1, limit));
  let rows = [];
  if (nome) {
    const term = String(nome).trim();
    rows = await MedicoCnes.find({ nome: new RegExp(escapeRegex(term), 'i') })
      .sort({ _id: 1 })
      .limit(cap)
      .lean();
  } else {
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const skip = (p - 1) * cap;
    rows = await MedicoCnes.find({}).sort({ _id: 1 }).skip(skip).limit(cap).lean();
  }
  return { csv: cnesRowsToCsv(rows), count: rows.length };
}

export async function getEstadosCnes() {
  const ufs = await MedicoCnes.distinct('uf', { uf: { $nin: ['', null] } });
  return ufs.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function getMunicipiosCnes(uf) {
  const municipios = await MedicoCnes.distinct('municipio', {
    uf: String(uf).toUpperCase(),
    municipio: { $nin: ['', null] }
  });
  return municipios.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function getMedicosPorMunicipio(uf, municipio, page = 1, limit = 3) {
  const filter = {
    uf: String(uf).toUpperCase(),
    municipio: String(municipio).trim()
  };
  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const cap = Math.min(5, Math.max(1, limit));
  const skip = (p - 1) * cap;
  const total = await MedicoCnes.countDocuments(filter);
  const items = await MedicoCnes.find(filter).sort({ nome: 1 }).skip(skip).limit(cap).lean();
  const totalPages = Math.max(1, Math.ceil(total / cap));
  return { items, page: p, totalPages, total, filter };
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}
