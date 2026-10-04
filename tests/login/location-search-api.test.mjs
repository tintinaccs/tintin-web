import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/geo-search.js';

const makeContext = query => ({ request: new Request(`https://tintinaccesorios.pages.dev/api/geo-search?q=${encodeURIComponent(query)}`, { headers: { Origin: 'https://tintinaccesorios.pages.dev' } }), waitUntil() {} });
test('búsqueda gratuita usa Photon en Paraguay sin el idioma que devuelve 400 ni autocomplete Nominatim', async () => {
  const oldFetch = globalThis.fetch, oldCaches = globalThis.caches;
  let calls = 0;
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async url => {
    calls++;
    const request = new URL(url);
    assert.equal(request.hostname, 'photon.komoot.io');
    assert.equal(request.searchParams.has('lang'), false);
    assert.equal(request.searchParams.get('countrycode'), 'PY');
    return Response.json({ features: [{ geometry: { coordinates: [-57.6, -25.3] }, properties: { name: 'Shopping del Sol', street: 'Aviadores del Chaco', city: 'Asunción', country: 'Paraguay' } }] });
  };
  try {
    const response = await onRequest(makeContext('Shopping del Sol'));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).places[0].lat, -25.3);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; }
});
test('fallo del proveedor responde error recuperable en vez de lista vacía exitosa', async () => {
  const oldFetch = globalThis.fetch, oldCaches = globalThis.caches;
  globalThis.caches = { default: { match: async () => null } };
  globalThis.fetch = async () => new Response('', { status: 429 });
  try { assert.equal((await onRequest(makeContext('Asunción'))).status, 503); }
  finally { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; }
});
