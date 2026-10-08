import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseLocationSearchInput } from '../../js/components/location/selector-ubicacion.js';
let searchPlaces;
let searchCase = 0;
test.beforeEach(async () => {
  ({ searchPlaces } = await import(`../../js/components/location/selector-ubicacion.js?case=${++searchCase}`));
});

const root = path.resolve(import.meta.dirname, '../..');

// La forma exacta que devuelve functions/api/geo-search.js. Si el buscador
// leyera otra clave (por ejemplo `results`), devolvería siempre lista vacía
// contra la API real sin que nada fallara a la vista.
const API_RESPONSE = {
  places: [
    { lat: -25.2921, lng: -57.6357, name: 'Av. España 1234', address: 'Av. España 1234, Asunción, Paraguay', source: 'OpenStreetMap' },
    { lat: -25.3007, lng: -57.6359, name: 'Shopping del Sol', address: 'Shopping del Sol, Asunción, Paraguay', source: 'OpenStreetMap' },
  ],
};

function stubFetch(response, { ok = true } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok, json: async () => response });
  return () => { globalThis.fetch = original; };
}

test('el buscador lee la clave que realmente devuelve /api/geo-search', async () => {
  const restore = stubFetch(API_RESPONSE);
  try {
    const places = await searchPlaces('Av. España');
    assert.equal(places.length, 2);
    assert.equal(places[0].name, 'Av. España 1234');
    assert.equal(places[0].lat, -25.2921);
    assert.equal(places[0].lng, -57.6357);
  } finally { restore(); }
});

test('geo-search.js sigue respondiendo con `places`', () => {
  // Guarda contra el otro lado del contrato: si el endpoint cambiara de clave,
  // este test avisa en vez de dejar el buscador mudo.
  const source = fs.readFileSync(path.join(root, 'functions/api/geo-search.js'), 'utf8');
  assert.match(source, /const responseBody = \{ places \}/);
  assert.match(source, /jsonResponse\(\{ places: \[\] \}/);
});

test('los resultados sin coordenadas usables se descartan', async () => {
  const restore = stubFetch({ places: [
    { lat: -25.29, lng: -57.63, name: 'Válido', address: 'Válido' },
    { lat: null, lng: -57.63, name: 'Sin lat', address: 'Sin lat' },
    { lat: 'x', lng: 'y', name: 'No numérico', address: 'No numérico' },
  ] });
  try {
    const places = await searchPlaces('algo');
    assert.equal(places.length, 1);
    assert.equal(places[0].name, 'Válido');
  } finally { restore(); }
});

test('una consulta demasiado corta no llega a pegarle a la API', async () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => API_RESPONSE }; };
  try {
    assert.deepEqual(await searchPlaces('av'), []);
    assert.equal(called, false);
  } finally { globalThis.fetch = original; }
});

test('una respuesta de error se propaga en vez de simular "sin resultados"', async () => {
  const restore = stubFetch({}, { ok: false });
  try {
    await assert.rejects(() => searchPlaces('Av. España'));
  } finally { restore(); }
});

test('un cuerpo inesperado no rompe el buscador', async () => {
  const restore = stubFetch({ algo: 'distinto' });
  try {
    assert.deepEqual(await searchPlaces('Av. España'), []);
  } finally { restore(); }
});

test('el parser compartido acepta resultados de Google Maps por coordenadas', () => {
  const source = fs.readFileSync(path.join(root, 'js/components/location/selector-ubicacion.js'), 'utf8');
  assert.match(source, /!3d/);
  assert.match(source, /center\|destination\|origin/);
});

test('el parser convierte enlaces reales de Google Maps en una búsqueda legible', () => {
  const parsed = parseLocationSearchInput('https://www.google.com/maps/search/Shopping+del+Sol,+Asunci%C3%B3n');
  assert.deepEqual(parsed, { query: 'Shopping del Sol, Asunción' });
});

test('el buscador convierte un enlace de Google Maps con coordenadas en un lugar seleccionable', async () => {
  const place = (await searchPlaces('https://www.google.com/maps/search/Shopping+del+Sol/@-25.2867,-57.6467,17z'))[0];
  assert.equal(place.lat, -25.2867);
  assert.equal(place.lng, -57.6467);
  assert.equal(place.source, 'Google Maps');
});

test('checkout acepta enlaces completos de Google Maps con coordenadas', () => {
    const source = fs.readFileSync(path.join(root, 'js/components/location/mapa-ubicacion.js'), 'utf8');
    const selectorSource = fs.readFileSync(path.join(root, 'js/components/location/selector-ubicacion.js'), 'utf8');
    assert.match(selectorSource, /!3d/);
    assert.match(selectorSource, /center\|destination\|origin/);
    assert.match(source, /parseLocationSearchInput/);
});

test('repetir una búsqueda responde de memoria sin consultar de nuevo ni compartir objetos mutables', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(API_RESPONSE); };
  try {
    const first = await searchPlaces('Shopping del Sol');
    first[0].lat = 0;
    const second = await searchPlaces('SHOPPING   DEL SOL');
    assert.equal(calls, 1);
    assert.equal(second[0].lat, API_RESPONSE.places[0].lat);
  } finally { globalThis.fetch = original; }
});

test('un proveedor caído no se consulta dos veces mediante rutas idénticas', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
  try {
    await assert.rejects(searchPlaces('Shopping del Sol'));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('una ruta ausente conserva el respaldo y una cancelación impide guardar resultados', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('', { status: 404 }) : Response.json(API_RESPONSE);
  try {
    assert.equal((await searchPlaces('Shopping del Sol')).length, 2);
    assert.equal(calls, 2);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(searchPlaces('Shopping del Sol', { signal: controller.signal }), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});

test('una búsqueda que no responde termina a los ocho segundos sin reintento duplicado', async t => {
  const original = globalThis.fetch;
  let calls = 0;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.fetch = async (_, { signal }) => { calls++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); };
  try {
    const pending = searchPlaces('Shopping del Sol');
    const rejected = assert.rejects(pending, { name: 'TimeoutError' });
    t.mock.timers.tick(8000);
    await rejected;
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; t.mock.timers.reset(); }
});

test('los resultados cancelados no vuelven como resultados cacheados', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    if (++calls === 1) controller.abort();
    return Response.json(API_RESPONSE);
  };
  try {
    await assert.rejects(searchPlaces('Shopping del Sol', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal((await searchPlaces('Shopping del Sol')).length, 2);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
