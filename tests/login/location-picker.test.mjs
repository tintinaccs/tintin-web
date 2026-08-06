import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { searchPlaces } from '../../js/components/location/selector-ubicacion.js';

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
