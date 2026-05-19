import User from '../models/User.js';
import MedicoContato from '../models/MedicoContato.js';
import CnesEstabelecimento from '../models/CnesEstabelecimento.js';
import { filterUsersWhoAreNotAdmins } from '../utils/userAdminFlags.js';
import { onlyDigits } from './medicosMongoSearch.js';

const USER_SELECT =
  'nome email cpf crm crmUf telefonePessoal telefoneConsultorio cidade estado areaAtuacao';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeNome(n) {
  return String(n ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findPulseflowMatchForCnes(cnes) {
  const base = filterUsersWhoAreNotAdmins();
  const nome = String(cnes.nome || '').trim();
  const uf = String(cnes.uf || '').toUpperCase().slice(0, 2);
  const municipio = String(cnes.municipio || '').trim();
  const crm = onlyDigits(cnes.registroConselho);

  if (crm) {
    const byCrm = await User.findOne({
      $and: [base, { crm }, ...(uf ? [{ crmUf: uf }] : [])]
    })
      .select(USER_SELECT)
      .lean();
    if (byCrm) return { user: byCrm, match: 'crm' };
  }

  if (!nome) return null;

  const nomeNorm = normalizeNome(nome);
  const and = [base, { nome: new RegExp(escapeRegex(nome), 'i') }];
  if (uf) and.push({ estado: uf });
  if (municipio) and.push({ cidade: new RegExp(escapeRegex(municipio), 'i') });

  const candidatos = await User.find({ $and: and }).select(USER_SELECT).limit(10).lean();
  if (!candidatos.length) return null;

  const exatos = candidatos.filter((u) => normalizeNome(u.nome) === nomeNorm);
  if (exatos.length === 1) return { user: exatos[0], match: 'nome+cidade' };
  if (exatos.length > 1) return { user: exatos[0], match: 'nome (vários)', ambiguous: true };
  if (candidatos.length === 1) return { user: candidatos[0], match: 'nome parcial' };
  return null;
}

export async function findContatoImportado(cnes) {
  const crm = onlyDigits(cnes.registroConselho);
  const uf = String(cnes.uf || '').toUpperCase().slice(0, 2);
  const cpf = onlyDigits(cnes.cpf);

  if (crm) {
    const byCrm = await MedicoContato.findOne({ crm, ...(uf ? { crmUf: uf } : {}) }).lean();
    if (byCrm) return byCrm;
  }
  if (cpf) {
    const byCpf = await MedicoContato.findOne({ cpf }).lean();
    if (byCpf) return byCpf;
  }

  const nome = String(cnes.nome || '').trim();
  if (!nome) return null;
  const and = [{ nome: new RegExp(escapeRegex(nome), 'i') }];
  if (uf) and.push({ uf });
  if (cnes.municipio) and.push({ municipio: new RegExp(escapeRegex(cnes.municipio), 'i') });

  const list = await MedicoContato.find({ $and: and }).limit(5).lean();
  const exato = list.filter((c) => normalizeNome(c.nome) === normalizeNome(nome));
  return exato[0] || list[0] || null;
}

export async function findEstabelecimentoCnes(cnes) {
  const codigo = onlyDigits(cnes.codigoEstabelecimentoCnes);
  if (!codigo) return null;
  return CnesEstabelecimento.findOne({ codigoCnes: codigo }).lean();
}

export async function enrichCnesRecord(cnes) {
  const [pulseflow, contato, estabelecimento] = await Promise.all([
    findPulseflowMatchForCnes(cnes),
    findContatoImportado(cnes),
    findEstabelecimentoCnes(cnes)
  ]);
  return { pulseflow, contato, estabelecimento };
}

export function formatEnriquecimentoPulseflow(pf) {
  if (!pf?.user) return '';
  const u = pf.user;
  const lines = [
    '━━━ PulseFlow (cadastro com consentimento) ━━━',
    u.cpf ? `🪪 CPF: ${u.cpf}` : null,
    u.email ? `📧 E-mail: ${u.email}` : null,
    u.telefonePessoal ? `📱 Tel.: ${u.telefonePessoal}` : null,
    u.telefoneConsultorio ? `📞 Consultório: ${u.telefoneConsultorio}` : null,
    u.crm ? `📋 CRM: ${u.crm}${u.crmUf ? `-${u.crmUf}` : ''}` : null,
    pf.ambiguous ? '⚠️ Vários cadastros parecidos' : null
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatEnriquecimentoContato(c) {
  if (!c) return '';
  return [
    '━━━ Sua base importada (LGPD) ━━━',
    `Base legal: ${c.baseLegal}`,
    c.cpf ? `🪪 CPF: ${c.cpf}` : null,
    c.email ? `📧 E-mail: ${c.email}` : null,
    c.telefone ? `📱 Tel.: ${c.telefone}` : null,
    c.crm ? `📋 CRM: ${c.crm}${c.crmUf ? `-${c.crmUf}` : ''}` : null,
    c.fonte ? `Fonte: ${c.fonte}` : null
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatEnriquecimentoEstabelecimento(e) {
  if (!e) return '';
  return [
    '━━━ Unidade CNES (dado público DATASUS) ━━━',
    e.nome ? `🏥 ${e.nome}` : null,
    e.telefone ? `📞 Tel. unidade: ${e.telefone}` : null,
    e.email ? `📧 E-mail unidade: ${e.email}` : null,
    `CNES: ${e.codigoCnes}`,
    '(telefone da clínica/hospital — não é celular pessoal do médico)'
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatResumoLegal(enriquecido) {
  const tem =
    enriquecido.pulseflow ||
    enriquecido.contato ||
    (enriquecido.estabelecimento && (enriquecido.estabelecimento.telefone || enriquecido.estabelecimento.email));

  if (tem) return '';

  const crm = onlyDigits(enriquecido.cnes?.registroConselho);
  const uf = enriquecido.cnes?.uf;
  return [
    '━━━ Como obter contato (formas legais) ━━━',
    '1. Cadastro na PulseFlow (consentimento)',
    '2. Planilha sua: npm run import-medicos-contatos',
    '3. Tel. da unidade: npm run import-cnes-estabelecimentos',
    '4. CFM (só dados profissionais): portal.cfm.org.br',
    crm && uf ? `   CRM ${crm}-${uf}` : null,
    '',
    'CPF de terceiros não é dado público no Brasil.'
  ]
    .filter(Boolean)
    .join('\n');
}

export async function formatEnriquecimentoCompleto(cnes) {
  const enriquecido = await enrichCnesRecord(cnes);
  enriquecido.cnes = cnes;
  const parts = [
    formatEnriquecimentoPulseflow(enriquecido.pulseflow),
    formatEnriquecimentoContato(enriquecido.contato),
    formatEnriquecimentoEstabelecimento(enriquecido.estabelecimento),
    formatResumoLegal(enriquecido)
  ].filter(Boolean);
  return parts.join('\n\n');
}
