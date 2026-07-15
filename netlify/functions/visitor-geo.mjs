const TRUSTED_ORIGINS = new Set([
  'https://tintinaccs.github.io',
  'https://tintinaccesorios.netlify.app'
]);

function originIsAllowed(origin) {
  if (!origin) return true;
  if (TRUSTED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/deploy-preview-\d+--tintinaccesorios\.netlify\.app$/i.test(origin)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

function cleanText(value, maxLength) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} .,'’()\-]/gu, '')
    .trim()
    .slice(0, maxLength);
}

function corsHeaders(origin) {
  const headers = {
    'cache-control': 'private, no-store, max-age=0',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
  if (origin && originIsAllowed(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export default async (request, context) => {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (!originIsAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Origen no permitido' }), { status: 403, headers });
  }

  if (request.method === 'OPTIONS') {
    headers['access-control-allow-methods'] = 'GET, OPTIONS';
    headers['access-control-max-age'] = '600';
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });
  }

  const geo = context?.geo || {};
  const countryCode = /^[A-Z]{2}$/i.test(geo.country?.code || '')
    ? String(geo.country.code).toUpperCase()
    : '';

  // Netlify utiliza la conexión para estimar la zona. Esta función nunca lee
  // context.ip ni devuelve coordenadas, código postal o ubicación exacta.
  return new Response(JSON.stringify({
    approximate: true,
    city: cleanText(geo.city, 80),
    region: cleanText(geo.subdivision?.name, 80),
    country: cleanText(geo.country?.name, 80),
    countryCode,
    source: countryCode || geo.city ? 'netlify' : 'unavailable'
  }), { status: 200, headers });
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['domain', 'ip'],
    windowSize: 60,
    windowLimit: 30
  }
};
