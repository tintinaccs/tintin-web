import {
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';

// Photon permite búsqueda incremental; Nominatim público prohíbe autocomplete.
// Caché edge, país acotado y timeout evitan tráfico duplicado o esperas infinitas.
const APP_USER_AGENT = 'TintinAccesoriosCheckout/1.0 (+https://tintinaccs.com/)';
const CACHE_TTL_SECONDS = 21600; // 6 horas: direcciones no cambian de un rato a otro.
const MAX_QUERY_LENGTH = 120;
const DEFAULT_MAP_CENTER = { lat: -25.3007, lng: -57.6359 }; // Asunción, Paraguay.

function cleanQuery(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function normalizePhoton(feature) {
  const coordinates = feature?.geometry?.coordinates || [];
  const properties = feature?.properties || {};
  const name = properties.name || properties.street || properties.city || properties.locality || 'Ubicación';
  const address = [
    properties.street && properties.housenumber ? `${properties.street} ${properties.housenumber}` : properties.street,
    properties.district,
    properties.city || properties.locality,
    properties.state,
    properties.country
  ].filter(Boolean).join(', ');
  return {
    lat: Number(coordinates[1]),
    lng: Number(coordinates[0]),
    name,
    address: address || name,
    source: 'OpenStreetMap'
  };
}

async function fetchPhoton(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&countrycode=PY&lat=${DEFAULT_MAP_CENTER.lat}&lon=${DEFAULT_MAP_CENTER.lng}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': APP_USER_AGENT },
    signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error('location_provider_unavailable');
  const data = await response.json().catch(() => ({ features: [] }));
  return Array.isArray(data?.features) ? data.features.map(normalizePhoton) : [];
}

function dedupePlaces(places) {
  const seen = new Set();
  return places
    .filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180)
    .filter(place => {
      const key = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
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

  const query = cleanQuery(new URL(requestUrl).searchParams.get('q'));
  if (query.length < 3) {
    return jsonResponse({ places: [] }, 200, origin, requestUrl);
  }

  const cache = caches.default;
  // Versionamos la clave para que una respuesta vacía anterior no oculte la
  // cobertura ampliada durante el TTL de la caché.
  const cacheKey = new Request(`https://geo-search-v4-photon.cache.internal/?q=${encodeURIComponent(query.toLowerCase())}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.json();
    return jsonResponse(body, 200, origin, requestUrl);
  }

  let places;
  try { places = dedupePlaces(await fetchPhoton(query)); }
  catch { return jsonResponse({ error: 'Buscador no disponible. Marcá el punto manualmente.' }, 503, origin, requestUrl); }

  const responseBody = { places };
  if (places.length) {
    context.waitUntil(
      cache.put(cacheKey, new Response(JSON.stringify(responseBody), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CACHE_TTL_SECONDS}` }
      }))
    );
  }

  return jsonResponse(responseBody, 200, origin, requestUrl);
}
