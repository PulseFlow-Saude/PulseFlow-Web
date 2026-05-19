const SUPPORTED_COUNTRIES = new Set(['BR', 'US']);

function normalizeCountry(raw) {
  const value = String(raw || '').trim().toUpperCase();
  return SUPPORTED_COUNTRIES.has(value) ? value : null;
}

function getAllowedCountries() {
  const raw = String(process.env.GEO_ALLOWED_COUNTRIES || 'BR,US');
  const parsed = raw
    .split(',')
    .map((v) => normalizeCountry(v))
    .filter(Boolean);
  return parsed.length ? parsed : ['BR', 'US'];
}

function inferRequestCountry(req) {
  const fromCf = normalizeCountry(req.headers['cf-ipcountry']);
  if (fromCf) return { country: fromCf, source: 'cf-ipcountry' };

  const fromHeader = normalizeCountry(req.headers['x-country-code']);
  if (fromHeader) return { country: fromHeader, source: 'x-country-code' };

  const fromBody = normalizeCountry(req.body?.country);
  if (fromBody) return { country: fromBody, source: 'body.country' };

  const fromQuery = normalizeCountry(req.query?.country);
  if (fromQuery) return { country: fromQuery, source: 'query.country' };

  return { country: null, source: 'unknown' };
}

export function geoLockMiddleware(req, res, next) {
  const enforce = process.env.ENFORCE_GEO_LOCK === 'true' || process.env.NODE_ENV === 'production';
  if (!enforce) return next();

  const allowedCountries = getAllowedCountries();
  const { country, source } = inferRequestCountry(req);

  if (!country) {
    return res.status(403).json({
      message: 'Não foi possível validar sua região.',
      code: 'GEO_REGION_UNKNOWN'
    });
  }

  if (!allowedCountries.includes(country)) {
    return res.status(403).json({
      message: 'Acesso indisponível para sua região.',
      code: 'GEO_REGION_BLOCKED',
      regionSource: source
    });
  }

  req.geo = { country, source, allowedCountries };
  return next();
}
