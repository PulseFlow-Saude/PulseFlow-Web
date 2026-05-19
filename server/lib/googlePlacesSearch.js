/**
 * Busca clínicas via Google Places API.
 * GOOGLE_PLACES_API_KEY no .env
 */
import { formatClinicaSimples } from './clinicaFormat.js';

function apiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

export function isGooglePlacesEnabled() {
  return Boolean(apiKey());
}

function formatFromPlaceNew(p) {
  return formatClinicaSimples({
    nome: p.displayName?.text || p.displayName || '',
    endereco: p.formattedAddress || '',
    telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    email: ''
  });
}

async function searchTextNew(textQuery, limit = 5) {
  const key = apiKey();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber'
    },
    body: JSON.stringify({ textQuery, languageCode: 'pt-BR', maxResultCount: Math.min(limit, 10) })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error?.message || `HTTP ${res.status}`, blocks: [] };
  }

  const places = (data.places || []).slice(0, limit);
  return { ok: true, places, blocks: places.map(formatFromPlaceNew) };
}

async function searchTextLegacy(query, limit = 5) {
  const key = apiKey();
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pt-BR&key=${key}`;
  const data = await fetch(searchUrl).then((r) => r.json());

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return { ok: false, error: data.error_message || data.status, blocks: [] };
  }

  const blocks = [];
  for (const r of (data.results || []).slice(0, limit)) {
    let tel = '';
    if (r.place_id) {
      const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(r.place_id)}&fields=formatted_phone_number&language=pt-BR&key=${key}`;
      const det = await fetch(detUrl).then((x) => x.json()).catch(() => ({}));
      tel = det.result?.formatted_phone_number || '';
    }
    blocks.push(
      formatClinicaSimples({
        nome: r.name || '',
        endereco: r.formatted_address || '',
        telefone: tel,
        email: ''
      })
    );
  }

  return { ok: true, blocks };
}

export async function buscarClinicasGoogle(texto, limit = 5) {
  const q = String(texto || '').trim();
  if (!q) return { ok: false, error: 'Informe cidade ou nome da clínica', blocks: [] };
  if (!isGooglePlacesEnabled()) {
    return {
      ok: false,
      error: 'Defina GOOGLE_PLACES_API_KEY no .env',
      blocks: []
    };
  }

  const query = /\bcl[ií]nica\b/i.test(q) ? q : `clínicas ${q}`;

  try {
    const neu = await searchTextNew(query, limit);
    if (neu.ok && neu.blocks.length) return neu;
    if (neu.ok) return { ok: true, blocks: [] };
    return await searchTextLegacy(query, limit);
  } catch (e) {
    return { ok: false, error: e.message || String(e), blocks: [] };
  }
}
