/**
 * Consulta dados PÚBLICOS e 100% GRATUITOS de médicos (fontes governamentais).
 *
 * ── EUA ────────────────────────────────────────────────────────────────────
 * API NPPES (CMS) — gratuita, sem cadastro.
 *   node scripts/fetch-medicos.js --pais=US --npi=1234567890
 *   node scripts/fetch-medicos.js --pais=US --nome=John --sobrenome=Smith --estado=CA
 *
 * ── Brasil ─────────────────────────────────────────────────────────────────
 * 1) Portal CFM (gratuito) — reCAPTCHA impede automação total. Opções:
 *    a) Semi-automático (recomendado): fetch-medicos-cfm-browser.js (você clica no captcha 1x)
 *    b) Manual: copie --captcha= do DevTools após buscar no portal
 *    node scripts/fetch-medicos.js --pais=BR --fonte=cfm --crm=123456 --uf=SP --captcha=TOKEN
 *
 * 2) Base CNES/DATASUS (download gratuito, milhões de registros):
 *    - Baixe "PROFISSIONAIS BRASIL" em https://cnes.datasus.gov.br/pages/downloads/arquivosAplicacao.jsp
 *    - Descompacte e passe o CSV:
 *    node scripts/fetch-medicos.js --pais=BR --fonte=cnes --arquivo=PFRLHBR202502.csv --uf=SP --limit=50
 *
 * Não há API federal brasileira gratuita para listar todos os CRMs sem captcha ou download em massa.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NPPES_BASE = 'https://npiregistry.cms.hhs.gov/api/';
const CFM_BUSCAR = 'https://portal.cfm.org.br/api_rest_php/api/v1/medicos/buscar_medicos';
const CBO_MEDICO_PREFIXES = ['2251', '2252', '2253'];

const HELP = `Fontes 100% gratuitas (governo).

EUA (automático):
  --pais=US --npi=<10 dígitos>
  --pais=US --nome=<primeiro> --sobrenome=<último> [--estado=SP] [--limit=10]

Brasil — CFM (--captcha copiado do DevTools):
  --pais=BR --fonte=cfm --crm=<n> --uf=<UF> --captcha=<token>

Brasil — CFM semi-automático (sem copiar token):
  node scripts/fetch-medicos-cfm-browser.js --crm=<n> --uf=<UF>

Brasil — arquivo CNES (download gratuito no DATASUS):
  --pais=BR --fonte=cnes --arquivo=<caminho.csv> [--uf=SP] [--nome=joao] [--limit=100]

Geral: --output=arquivo.json  --format=json|csv

Plataforma interna: export-medicos-plataforma.js
`;

function parseArgs(argv) {
  const opts = {
    pais: 'BR',
    fonte: 'cfm',
    crm: '',
    uf: '',
    nome: '',
    sobrenome: '',
    npi: '',
    estado: '',
    captcha: '',
    arquivo: '',
    limit: 10,
    format: 'json',
    output: ''
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    }
    if (arg.startsWith('--pais=')) opts.pais = arg.slice(7).trim().toUpperCase();
    else if (arg.startsWith('--fonte=')) opts.fonte = arg.slice(8).trim().toLowerCase();
    else if (arg.startsWith('--crm=')) opts.crm = arg.slice(6).trim();
    else if (arg.startsWith('--uf=')) opts.uf = arg.slice(5).trim().toUpperCase();
    else if (arg.startsWith('--nome=')) opts.nome = arg.slice(7).trim();
    else if (arg.startsWith('--sobrenome=')) opts.sobrenome = arg.slice(12).trim();
    else if (arg.startsWith('--npi=')) opts.npi = arg.slice(6).replace(/\D/g, '');
    else if (arg.startsWith('--estado=')) opts.estado = arg.slice(9).trim().toUpperCase();
    else if (arg.startsWith('--captcha=')) opts.captcha = arg.slice(10).trim();
    else if (arg.startsWith('--arquivo=')) opts.arquivo = arg.slice(10).trim();
    else if (arg.startsWith('--limit=')) opts.limit = Math.max(1, parseInt(arg.slice(8), 10) || 10);
    else if (arg.startsWith('--format=')) opts.format = arg.slice(9).trim().toLowerCase();
    else if (arg.startsWith('--output=')) opts.output = arg.slice(9).trim();
  }
  return opts;
}

async function httpGet(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
  return body;
}

function normalizeNppes(result) {
  const b = result.basic || {};
  const primaryTax = (result.taxonomies || []).find((t) => t.primary) || result.taxonomies?.[0];
  const loc = (result.addresses || []).find((a) => a.address_purpose === 'LOCATION') || result.addresses?.[0];
  const nome = [b.first_name, b.middle_name, b.last_name, b.credential]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    pais: 'US',
    fonte: 'nppes',
    npi: result.number,
    nome,
    credencial: b.credential || null,
    status: b.status === 'A' ? 'ATIVO' : b.status,
    especialidade: primaryTax?.desc || null,
    estado: loc?.state || null,
    cidade: loc?.city || null,
    telefone: loc?.telephone_number || null
  };
}

async function buscarNppes(opts) {
  const params = new URLSearchParams({ version: '2.1', limit: String(opts.limit) });
  if (opts.npi) {
    if (opts.npi.length !== 10) throw new Error('NPI deve ter 10 dígitos.');
    params.set('number', opts.npi);
  } else {
    params.set('enumeration_type', 'NPI-1');
    if (opts.nome) params.set('first_name', opts.nome);
    if (opts.sobrenome) params.set('last_name', opts.sobrenome);
    if (opts.estado) params.set('state', opts.estado);
  }
  const data = await httpGet(`${NPPES_BASE}?${params}`);
  const items = (data.results || []).map(normalizeNppes);
  return { total: data.result_count ?? items.length, items };
}

function normalizeCfm(d) {
  return {
    pais: 'BR',
    fonte: 'cfm',
    uf: d.SG_UF || d.uf,
    crm: d.NU_CRM || d.NU_REGISTRO || d.numero_registro || d.crmMedico,
    nome: d.NM_MEDICO || d.nome_razao_social || d.nome,
    situacao: d.SITUACAO || d.situacao || d.DS_SITUACAO,
    tipoInscricao: d.TP_INSCRICAO || d.tipo_inscricao,
    especialidades: d.DS_ESPECIALIDADE || d.especialidades || null,
    municipio: d.NM_MUNICIPIO || d.municipioMedico || null
  };
}

async function buscarCfm(opts) {
  if (!opts.captcha) {
    throw new Error(
      'Brasil/CFM: token reCAPTCHA obrigatório (gratuito). Abra portal.cfm.org.br/busca-medicos, ' +
        'faça uma busca, copie o campo "captcha" na requisição buscar_medicos e use --captcha=...'
    );
  }
  const payload = [
    {
      useCaptchav2: true,
      captcha: opts.captcha,
      medico: {
        nome: opts.nome || '',
        ufMedico: opts.uf || '',
        crmMedico: opts.crm ? String(opts.crm).replace(/\D/g, '') : '',
        municipioMedico: '',
        tipoInscricaoMedico: '',
        situacaoMedico: '',
        detalheSituacaoMedico: '',
        especialidadeMedico: '',
        areaAtuacaoMedico: ''
      },
      page: 1,
      pageNumber: 1,
      pageSize: Math.min(opts.limit, 100)
    }
  ];

  const res = await fetch(CFM_BUSCAR, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://portal.cfm.org.br',
      Referer: 'https://portal.cfm.org.br/busca-medicos/'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok || text.trim().startsWith('<!')) {
    throw new Error(
      'CFM indisponível ou bloqueou a requisição. Use --fonte=cnes com arquivo do DATASUS, ' +
        'ou gere um novo token --captcha no portal.'
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do CFM: ${text.slice(0, 120)}`);
  }

  const lista = data.dados || data.items || (Array.isArray(data) ? data : []);
  const items = (Array.isArray(lista) ? lista : []).map(normalizeCfm).slice(0, opts.limit);
  return { total: items.length, items };
}

function splitCsvLine(line, sep) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      parts.push(cur);
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

function detectSeparator(headerLine) {
  if (headerLine.includes(';')) return ';';
  if (headerLine.includes('\t')) return '\t';
  return ',';
}

function rowToMedico(headers, values) {
  const row = Object.fromEntries(headers.map((h, i) => [h.toUpperCase(), values[i] ?? '']));
  const cbo = String(row.CO_CBO || row.CBO || '').replace(/\D/g, '');
  if (cbo && !CBO_MEDICO_PREFIXES.some((p) => cbo.startsWith(p))) return null;

  const nome = row.NO_PROFISSIONAL || row.NOME || row.NOME_PROFISSIONAL;
  if (!nome) return null;

  return {
    pais: 'BR',
    fonte: 'cnes',
    nome,
    cbo: cbo || null,
    cns: row.CO_CNS || row.NU_CNS || null,
    cpf: row.NU_CPF || row.CPF || null,
    uf: row.CO_UF || row.SG_UF || row.UF || null,
    municipio: row.NO_MUNICIPIO || row.MUNICIPIO || null,
    conselho: row.CO_CONSELHO || row.SG_CONSELHO || null,
    registroConselho: row.NU_REGISTRO || row.NU_CRM || row.CRM || null
  };
}

async function buscarCnesArquivo(opts) {
  const filePath = path.resolve(opts.arquivo);
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);

  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'latin1' }), crlfDelay: Infinity });
  let headers = null;
  let sep = ';';
  const items = [];
  const nomeRx = opts.nome ? new RegExp(opts.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      sep = detectSeparator(line);
      headers = splitCsvLine(line, sep).map((h) => h.replace(/^\uFEFF/, '').trim());
      continue;
    }
    const values = splitCsvLine(line, sep);
    const medico = rowToMedico(headers, values);
    if (!medico) continue;
    if (opts.uf && String(medico.uf || '').toUpperCase() !== opts.uf) continue;
    if (nomeRx && !nomeRx.test(medico.nome)) continue;
    items.push(medico);
    if (items.length >= opts.limit) break;
  }

  return { total: items.length, items };
}

function validateOpts(opts) {
  if (opts.pais === 'US') {
    if (opts.npi || (opts.nome && opts.sobrenome)) return;
    throw new Error('EUA: informe --npi ou --nome e --sobrenome');
  }
  if (opts.pais === 'BR') {
    if (opts.fonte === 'cnes') {
      if (opts.arquivo) return;
      throw new Error('Brasil/CNES: informe --arquivo=<csv baixado do DATASUS>');
    }
    if (opts.fonte === 'cfm') {
      if (opts.captcha && (opts.crm || opts.nome)) return;
      throw new Error('Brasil/CFM: informe --captcha=TOKEN e --crm+--uf ou --nome');
    }
    throw new Error('Brasil: use --fonte=cfm ou --fonte=cnes');
  }
  throw new Error('Use --pais=BR ou --pais=US');
}

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
}

function writeOutput(payload, opts) {
  const output = opts.format === 'csv' ? toCsv(payload.items) : JSON.stringify(payload, null, 2);
  if (opts.output) {
    fs.writeFileSync(opts.output, output, 'utf8');
    console.log(`${payload.total} registro(s) salvo(s) em ${opts.output}`);
  } else {
    console.log(output);
  }
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  validateOpts(opts);

  let payload;
  if (opts.pais === 'US') {
    payload = await buscarNppes(opts);
  } else if (opts.fonte === 'cnes') {
    payload = await buscarCnesArquivo(opts);
  } else {
    payload = await buscarCfm(opts);
  }

  writeOutput(payload, opts);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
