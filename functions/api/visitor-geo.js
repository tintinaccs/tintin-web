import {
  corsHeaders,
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/cloudinary-security.js';

function cleanText(value, maxLength = 80) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} .,'’()\-]/gu, '')
    .trim()
    .slice(0, maxLength);
}

function countryName(countryCode) {
  if (!countryCode) return '';
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'GET, OPTIONS');
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Método no permitido' }, 405, origin, requestUrl);
  }

  const cf = request.cf || {};
  const countryCode = /^[A-Z]{2}$/i.test(cf.country || '')
    ? String(cf.country).toUpperCase()
    : '';
  const headers = corsHeaders(origin, requestUrl);

  // Cloudflare estima estos datos desde la conexión. Nunca se devuelve IP,
  // coordenadas, código postal, ASN, navegador ni identificadores personales.
  return new Response(JSON.stringify({
    approximate: true,
    city: cleanText(cf.city),
    region: cleanText(cf.region),
    country: cleanText(countryName(countryCode)),
    countryCode,
    source: countryCode || cf.city ? 'cloudflare' : 'unavailable'
  }), { status: 200, headers });
}
