import CnesEstabelecimento from '../models/CnesEstabelecimento.js';
import { buscarClinicasGoogle, isGooglePlacesEnabled } from './googlePlacesSearch.js';
import { formatClinicaSimples } from './clinicaFormat.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTelefoneBr(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '';
}

export function formatClinicaCnes(e) {
  const endereco =
    e.endereco || [e.municipio, e.uf].filter(Boolean).join(' - ');
  return formatClinicaSimples({
    nome: e.nome || '',
    endereco,
    telefone: formatTelefoneBr(e.telefone) || e.telefone || '',
    email: e.email || ''
  });
}

function useGooglePlaces() {
  return process.env.CNES_CLINICAS_USE_GOOGLE === 'true' || process.env.CNES_CLINICAS_USE_GOOGLE === '1';
}

export async function buscarClinicasMongo(texto, limit = 8) {
  const term = String(texto || '').trim();
  if (!term) return [];

  let q;
  const m = term.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (m && m[2].length === 2) {
    q = {
      nome: /cl[ií]nica/i,
      municipio: new RegExp(escapeRegex(m[1].trim()), 'i'),
      uf: m[2].toUpperCase()
    };
  } else {
    const uf2 = term.length === 2 ? term.toUpperCase() : '';
    q = {
      $and: [
        { nome: /cl[ií]nica/i },
        uf2
          ? { uf: uf2 }
          : {
              $or: [
                { municipio: new RegExp(escapeRegex(term), 'i') },
                { nome: new RegExp(escapeRegex(term), 'i') }
              ]
            }
      ]
    };
  }

  const items = await CnesEstabelecimento.find(q)
    .sort({ nome: 1 })
    .limit(Math.min(limit, 15))
    .lean();

  return items.map(formatClinicaCnes);
}

export async function buscarClinicas(texto, limit = 5) {
  const mongoBlocks = await buscarClinicasMongo(texto, limit * 2);
  const blocks = [];
  const seen = new Set();

  for (const b of mongoBlocks) {
    if (blocks.length >= limit) break;
    const key = b.split('\n')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(b);
  }

  let google = { ok: true, blocks: [], error: null };
  if (useGooglePlaces() && isGooglePlacesEnabled() && blocks.length < limit) {
    google = await buscarClinicasGoogle(texto, limit - blocks.length);
    for (const b of google.blocks || []) {
      if (blocks.length >= limit) break;
      const key = b.split('\n')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(b);
    }
  }

  return {
    blocks,
    googleOk: google.ok,
    googleError: google.error,
    mongoCount: mongoBlocks.length,
    googleEnabled: useGooglePlaces() && isGooglePlacesEnabled(),
    fonte: blocks.length && mongoBlocks.length ? 'cnes' : google.blocks?.length ? 'google' : 'nenhuma'
  };
}
