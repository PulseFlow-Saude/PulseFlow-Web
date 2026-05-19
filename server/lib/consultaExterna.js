/**
 * API de consultas externa (centralbrasil.shop).
 *   base: CONSULTA_API_BASE_URL ou https://centralbrasil.shop/apis/
 *   key:  CONSULTA_API_KEY ou 123
 */

import { httpGet } from './consultaHttp.js';

function onlyDigits(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export const BOT_CONSULTA_API = {
  baseUrl: 'https://centralbrasil.shop/apis/',
  apiKey: '123'
};

const ENDPOINTS = {
  cpf: { path: 'cpf.php', param: 'cpf' },
  cns: { path: 'cns.php', param: 'cns' },
  falecimento: { path: 'data_falecimento.php', param: 'data_falecimento' },
  nascimento: { path: 'nascimento.php', param: 'nascimento' },
  nome: { path: 'nome.php', param: 'nome' }
};

function baseUrl() {
  const b = process.env.CONSULTA_API_BASE_URL || BOT_CONSULTA_API.baseUrl;
  return b.endsWith('/') ? b : `${b}/`;
}

function apiKey() {
  const k = process.env.CONSULTA_API_KEY ?? BOT_CONSULTA_API.apiKey;
  return String(k).trim();
}

export function isConsultaExternaEnabled() {
  return Boolean(apiKey());
}

function normalizeNome(n) {
  return String(n ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatarRespostaBrutaPhp(dados) {
  let s = String(dados ?? '');
  s = s.replace(/Warning.*\n/g, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\{"|"\}|",/g, (m) => (m === '",' ? '\n' : ''));
  s = s.replace(/:/g, ' =');
  s = s.replace(/\s*=\s*""/g, ' = Não informado');
  s = s.replace(/"/g, '');
  return s.trim();
}

function pickField(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k] ?? obj[String(k).toUpperCase()] ?? obj[String(k).toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rec = {
    nome: pickField(raw, 'nome', 'NOME', 'name'),
    cpf: onlyDigits(pickField(raw, 'cpf', 'CPF')),
    cns: onlyDigits(pickField(raw, 'cns', 'CNS')),
    data_nascimento: pickField(raw, 'data_nascimento', 'nascimento', 'dataNascimento', 'dt_nascimento'),
    sexo: pickField(raw, 'sexo', 'SEXO'),
    mae: pickField(raw, 'mae', 'MAE', 'nome_mae'),
    pai: pickField(raw, 'pai', 'PAI', 'nome_pai'),
    rg: pickField(raw, 'rg', 'RG'),
    telefone: pickField(raw, 'telefone', 'tel', 'celular'),
    email: pickField(raw, 'email', 'EMAIL'),
    endereco: pickField(raw, 'endereco', 'logradouro', 'rua'),
    municipio: pickField(raw, 'municipio', 'cidade', 'MUNICIPIO'),
    uf: pickField(raw, 'uf', 'UF', 'estado').toUpperCase().slice(0, 2),
    cep: pickField(raw, 'cep', 'CEP'),
    situacao: pickField(raw, 'situacao', 'status'),
    obito: pickField(raw, 'obito', 'falecido'),
    data_falecimento: pickField(raw, 'data_falecimento', 'data_obito', 'falecimento')
  };
  if (!rec.nome && !rec.cpf && !rec.cns) return null;
  return rec;
}

export function parseRespostaExterna(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return [];

  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(normalizeRecord).filter(Boolean);
    if (j?.data && Array.isArray(j.data)) return j.data.map(normalizeRecord).filter(Boolean);
    if (j?.resultados && Array.isArray(j.resultados)) {
      return j.resultados.map(normalizeRecord).filter(Boolean);
    }
    const one = normalizeRecord(j);
    return one ? [one] : [];
  } catch {
    /* JSON inválido — tenta linhas key=value (pós formatarRespostaBruta) */
  }

  const records = [];
  for (const block of s.split(/\n\s*\n/).filter(Boolean)) {
    const obj = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*([^:=]+)\s*[=:]\s*(.*)$/);
      if (!m) continue;
      const k = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      const v = m[2].trim();
      if (v && v !== 'Não informado') obj[k] = v;
    }
    const rec = normalizeRecord(obj);
    if (rec) records.push(rec);
  }
  return records;
}

export function formatRegistroPessoa(rec, ctx = {}) {
  const lines = [];
  lines.push(`👤 *${rec.nome || ctx.nomeFallback || '—'}*`);
  if (rec.cpf) lines.push(`🪪 CPF: \`${rec.cpf}\``);
  if (rec.cns) lines.push(`🏥 CNS: ${rec.cns}`);
  if (rec.data_nascimento) lines.push(`📅 Nasc.: ${rec.data_nascimento}`);
  if (rec.sexo) lines.push(`⚧ Sexo: ${rec.sexo}`);
  if (rec.mae) lines.push(`👩 Mãe: ${rec.mae}`);
  if (rec.rg) lines.push(`🆔 RG: ${rec.rg}`);
  if (rec.telefone) lines.push(`📱 Tel.: ${rec.telefone}`);
  if (rec.email) lines.push(`📧 E-mail: ${rec.email}`);
  const loc = [rec.municipio, rec.uf].filter(Boolean).join(' / ');
  if (loc) lines.push(`📍 ${loc}`);
  if (rec.endereco) lines.push(`🏠 ${rec.endereco}`);
  if (rec.cep) lines.push(`CEP: ${rec.cep}`);
  if (rec.data_falecimento || rec.obito) lines.push(`⚰️ ${rec.data_falecimento || rec.obito}`);
  if (ctx.cbo) lines.push(`⚕️ CBO: ${ctx.cbo}`);
  if (ctx.crm) lines.push(`📋 CRM: ${ctx.crm}`);
  if (ctx.cnesUnidade) lines.push(`🏥 Unidade CNES: ${ctx.cnesUnidade}`);
  return lines.join('\n');
}

function processarBodyConsulta(body, url) {
  if (!body?.trim()) return { ok: false, error: 'Resposta vazia', url };

  let records = parseRespostaExterna(body);
  if (!records.length) {
    const texto = formatarRespostaBrutaPhp(body);
    records = parseRespostaExterna(texto);
    if (!records.length && texto) {
      return { ok: true, raw: body, records: [], formatted: texto, url };
    }
  }
  return { ok: true, raw: body, records, url };
}

export async function consultaExterna(tipo, valor) {
  const key = apiKey();
  const cfg = ENDPOINTS[tipo];
  if (!cfg) return { ok: false, error: `Tipo inválido: ${tipo}` };

  const v = String(valor ?? '').trim();
  if (!v) return { ok: false, error: 'Parâmetro vazio' };

  const params = new URLSearchParams({ key, [cfg.param]: v });
  const url = `${baseUrl()}${cfg.path}?${params}`;

  try {
    const { status, body } = await httpGet(url);
    if (status !== 200) return { ok: false, error: `HTTP ${status}`, raw: body, url };
    return processarBodyConsulta(body, url);
  } catch (e) {
    const msg = e.message || String(e);
    return {
      ok: false,
      error:
        `${msg}\n\nVerifique CONSULTA_API_BASE_URL no .env se a API estiver fora do ar.`,
      url
    };
  }
}

export async function buscarRegistrosExternos(tipo, valor) {
  const r = await consultaExterna(tipo, valor);
  if (!r.ok) return { ok: false, error: r.error, records: [], formatted: null, url: r.url };

  if (r.records?.length) {
    return { ok: true, records: r.records, raw: r.raw, formatted: null, url: r.url };
  }
  if (r.formatted) {
    return { ok: true, records: [], raw: r.raw, formatted: r.formatted, url: r.url };
  }
  return { ok: false, error: 'Nenhum dado na resposta da API', records: [], url: r.url };
}

export function formatarResultadoApi({ records, formatted }) {
  if (records?.length) {
    return records.map((r) => formatRegistroPessoa(r)).join('\n\n---\n\n');
  }
  if (formatted) return formatted;
  return '';
}

export function findBestNameMatch(records, nome, uf, municipio) {
  if (!records?.length) return null;
  const alvo = normalizeNome(nome);
  const ufUp = String(uf || '').toUpperCase().slice(0, 2);
  const mun = normalizeNome(municipio);

  const scored = records.map((r) => {
    let score = 0;
    const rn = normalizeNome(r.nome);
    if (rn === alvo) score += 10;
    else if (rn.includes(alvo) || alvo.includes(rn)) score += 5;
    if (ufUp && r.uf === ufUp) score += 3;
    if (mun && normalizeNome(r.municipio) === mun) score += 2;
    if (r.cpf) score += 1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.r || records[0];
}

const cachePorNome = new Map();

export async function cpfDadosPorNome(nome, uf, municipio) {
  const key = `${normalizeNome(nome)}|${uf || ''}|${municipio || ''}`;
  if (cachePorNome.has(key)) return cachePorNome.get(key);

  let out = null;
  if (nome?.trim()) {
    const { records } = await buscarRegistrosExternos('nome', nome.trim());
    out = findBestNameMatch(records, nome, uf, municipio);
  }
  cachePorNome.set(key, out);
  return out;
}

export function clearConsultaCache() {
  cachePorNome.clear();
}

export function tipoBuscaParaConsulta(type) {
  if (['cpf', 'cns', 'nome', 'nascimento', 'falecimento'].includes(type)) return type;
  return null;
}

export function formatarRespostaExterna(dados) {
  return formatarResultadoApi({ records: parseRespostaExterna(dados), formatted: formatarRespostaBrutaPhp(dados) });
}
