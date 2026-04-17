import { API_URL } from './config.js';

export const REGION_SESSION_KEY = 'pulseflow_region_lock';

export function getSessionRegionLock() {
  try {
    const v = sessionStorage.getItem(REGION_SESSION_KEY);
    if (v === 'BR' || v === 'US') return v;
  } catch (_) {}
  return null;
}


export async function detectRegisterRegion() {
  const existing = getSessionRegionLock();
  if (existing === 'BR' || existing === 'US') {
    try {
      localStorage.setItem('pulseflow_lang', existing === 'US' ? 'en' : 'pt-BR');
    } catch (_) {}
    return existing;
  }

  let region = null;

  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 18000,
        maximumAge: 600000
      });
    });
    const res = await fetch(`${API_URL}/api/geo/reverse-country`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      })
    });
    if (res.ok) {
      const j = await res.json();
      if (j.region === 'BR' || j.region === 'US') region = j.region;
    }
  } catch (_) {
    /* permissão negada, timeout ou rede */
  }

  if (!region) {
    try {
      const res = await fetch(`${API_URL}/api/geo/ip-hint`, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const j = await res.json();
        if (j.region === 'BR' || j.region === 'US') region = j.region;
      }
    } catch (_) {}
  }

  if (region === 'BR' || region === 'US') {
    try {
      sessionStorage.setItem(REGION_SESSION_KEY, region);
      localStorage.setItem('pulseflow_lang', region === 'US' ? 'en' : 'pt-BR');
    } catch (_) {}
  }

  return region;
}


export function applyRegisterRegionLockUI(region) {
  if (region !== 'BR' && region !== 'US') return;
  const sel = document.getElementById('registerCountry');
  if (!sel) return;

  Array.from(sel.options).forEach((opt) => {
    if (opt.value !== region) opt.remove();
  });
  sel.value = region;
  sel.disabled = true;
  sel.setAttribute('aria-disabled', 'true');
  sel.title = '';

  document.querySelectorAll('.lang-switcher-register .lang-btn').forEach((btn) => {
    const l = btn.getAttribute('data-lang');
    const hide = (region === 'US' && l === 'pt-BR') || (region === 'BR' && l === 'en');
    btn.style.display = hide ? 'none' : '';
    if (hide) btn.setAttribute('tabindex', '-1');
    else btn.removeAttribute('tabindex');
  });
}
