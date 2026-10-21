import test from 'node:test';
import assert from 'node:assert/strict';
import { requestCurrentLocation } from '../../js/components/location/geolocalizacion.mjs';
import { accountAccessSummary } from '../../js/core/auth/presentacion-acceso.mjs';

test('permiso concedido no se presenta como bloqueo del sitio', async () => {
  const navigator = { permissions: { query: async () => ({ state: 'granted' }) }, geolocation: { getCurrentPosition: (_, fail) => fail({ code: 1 }) } };
  await assert.rejects(requestCurrentLocation({ navigator, secure: true }), /navegador tiene permiso/);
});
test('restricción de iframe tiene diagnóstico propio y no pide un permiso inútil', async () => {
  await assert.rejects(requestCurrentLocation({ secure: true, document: { permissionsPolicy: { allowsFeature: () => false } } }), /pestaña propia/);
});
test('ubicación no disponible reintenta con otra precisión y devuelve coordenadas', async () => {
  const options = [];
  const navigator = { geolocation: { getCurrentPosition: (ok, fail, config) => {
    options.push(config);
    if (options.length === 1) fail({ code: 2 });
    else ok({ coords: { latitude: -25.3, longitude: -57.6, accuracy: 25 } });
  } } };
  assert.deepEqual(await requestCurrentLocation({ navigator, secure: true }), { lat: -25.3, lng: -57.6, accuracy: 25 });
  assert.deepEqual(options.map(item => item.enableHighAccuracy), [false, true]);
});
test('rechazo de permiso no dispara una segunda solicitud', async () => {
  let calls = 0;
  const navigator = { geolocation: { getCurrentPosition: (_, fail) => { calls++; fail({ code: 1 }); } } };
  await assert.rejects(requestCurrentLocation({ navigator, secure: true }), /No se autorizó/);
  assert.equal(calls, 1);
});

test('un proveedor que nunca responde termina ambos intentos y permite reintentar', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const navigator = { geolocation: { getCurrentPosition: () => { calls++; } } };
  const pending = requestCurrentLocation({ navigator, secure: true });
  const rejected = assert.rejects(pending, /tardó demasiado/);
  t.mock.timers.tick(5000);
  await Promise.resolve();
  assert.equal(calls, 2);
  t.mock.timers.tick(5000);
  await rejected;
});

test('elegir un punto o cerrar el editor cancela la espera aunque el GPS no responda', async () => {
  const controller = new AbortController();
  const navigator = { geolocation: { getCurrentPosition: () => {} } };
  const pending = requestCurrentLocation({ navigator, secure: true, signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await rejected;
});

test('coordenadas inválidas no se guardan como ubicación encontrada', async () => {
  const navigator = { geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: NaN, longitude: -57 } }) } };
  await assert.rejects(requestCurrentLocation({ navigator, secure: true }), /no pudo determinar/);
});
test('una lectura inválida del proveedor se recupera con el segundo intento válido', async () => {
  let calls=0;
  const navigator={geolocation:{getCurrentPosition:ok=>{
    calls++;
    ok({coords:calls===1?{latitude:91,longitude:-57.6}:{latitude:-25.3,longitude:-57.6,accuracy:20}});
  }}};
  assert.deepEqual(await requestCurrentLocation({navigator,secure:true}),{lat:-25.3,lng:-57.6,accuracy:20});
  assert.equal(calls,2);
});
test('código por correo usado en una cuenta Google se muestra desde el token de sesión', () => {
  const data = accountAccessSummary({ provider: 'google', authMethods: ['google', 'emailOtp'] }, { firebase: { sign_in_provider: 'custom' } });
  assert.equal(data.current, 'Código por correo');
  assert.equal(data.methods, 'Google · Código por correo');
});
test('Google usado en cuenta registrada por código no aparece como código', () => {
  assert.equal(accountAccessSummary({ provider: 'emailOtp' }, { firebase: { sign_in_provider: 'google.com' } }).current, 'Google');
  assert.equal(accountAccessSummary().current, 'No disponible');
});
