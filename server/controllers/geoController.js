const NOMINATIM_UA = 'PulseFlow/1.0 (suporte via site oficial)';

/**
 * Converte lat/lng em código BR | US (apenas estes dois mercados).
 */
export async function reverseCountry(req, res) {
  try {
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Coordenadas inválidas.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Coordenadas fora do intervalo.' });
    }
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`;
    const r = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_UA }
    });
    if (!r.ok) {
      return res.status(502).json({ message: 'Falha na geocodificação.' });
    }
    const data = await r.json();
    const cc = (data?.address?.country_code || '').toUpperCase();
    let region = null;
    if (cc === 'BR') region = 'BR';
    else if (cc === 'US') region = 'US';
    return res.json({ region, countryCode: cc || null });
  } catch (e) {
    console.error('[geo reverse-country]', e);
    return res.status(500).json({ message: 'Erro ao resolver região.' });
  }
}


export async function ipHint(req, res) {
  try {
    const cf = (req.headers['cf-ipcountry'] || req.headers['CF-IPCountry'] || '').toUpperCase();
    if (cf === 'BR') return res.json({ region: 'BR', source: 'cf' });
    if (cf === 'US') return res.json({ region: 'US', source: 'cf' });

    let ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (!ip) ip = req.socket.remoteAddress || '';
    ip = ip.replace(/^::ffff:/, '');
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return res.json({ region: null, source: 'local' });
    }

    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country_code/`, {
      headers: { 'User-Agent': 'PulseFlow-Backend/1.0' }
    });
    if (!r.ok) return res.json({ region: null, source: 'ipapi' });
    const text = (await r.text()).trim();
    const code = text.replace(/"/g, '').toUpperCase();
    if (code === 'BR') return res.json({ region: 'BR', source: 'ipapi' });
    if (code === 'US') return res.json({ region: 'US', source: 'ipapi' });
    return res.json({ region: null, countryCode: code || null, source: 'ipapi' });
  } catch (e) {
    console.error('[geo ip-hint]', e);
    return res.json({ region: null, source: 'error' });
  }
}
