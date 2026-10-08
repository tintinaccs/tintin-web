import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Ejecutar el cliente real con fetch aislado, sin importar el programa que
// consulta GitHub y publica checks al iniciarse.
const source = fs.readFileSync(new URL('../../scripts/mantenimiento-flujos-github.mjs', import.meta.url), 'utf8');
const client = source.slice(source.indexOf('const githubFailure ='), source.indexOf('const list ='));
const invoke = (response, path = 'pulls/1071', body) => {
  const context = vm.createContext({ fetch: async () => response, config: { repository: 'fixture/repo' },
    process: { env: { GH_TOKEN: 'test-secret-never-print' } }, AbortSignal });
  vm.runInContext(`${client}\nglobalThis.invoke = api;`, context);
  return context.invoke(path, body);
};
const failure = (message, headers = {}, status = 403) => new Response(JSON.stringify({ message }), { status, headers });

test('403 de cuota incluye endpoint, request id y tiempo de reinicio', async () => {
  await assert.rejects(invoke(failure('API rate limit exceeded for installation', {
    'x-ratelimit-limit': '1000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791498000',
    'x-github-request-id': 'ABCD:0123:4567',
  })), error => /HTTP 403.*GET pulls\/1071.*Límite de consultas/.test(error.message) &&
    error.message.includes('request-id=ABCD:0123:4567') && error.message.includes('reset-unix=1791498000'));
});
test('límite secundario se distingue sin confundirlo con permisos', async () => {
  await assert.rejects(invoke(failure('You have exceeded a secondary rate limit', { 'retry-after': '60' })),
    error => error.message.includes('Límite de consultas') && error.message.includes('retry-after-seconds=60'));
});
test('falta de acceso identifica POST y nunca devuelve cuerpo arbitrario', async () => {
  await assert.rejects(invoke(failure('Resource not accessible by integration'), 'check-runs', {}),
    error => error.message.includes('POST check-runs') && error.message.includes('no tiene acceso'));
});
test('respuestas desconocidas, query y cabeceras hostiles no filtran secretos ni comandos', async () => {
  await assert.rejects(invoke(failure('test-secret-never-print ::error::evil', {
    'x-github-request-id': 'test-secret-never-print', 'retry-after': '::error::evil',
    'x-ratelimit-reset': 'test-secret-never-print',
  }), 'pulls/1071?token=test-secret-never-print'), error =>
    !/test-secret-never-print|::error::|token=/.test(error.message) && error.message.includes('causa reconocida'));
});
test('respuesta no JSON mantiene el rechazo y evidencia HTTP', async () => {
  await assert.rejects(invoke(new Response('private response', { status: 502 })),
    error => error.message.includes('HTTP 502') && !error.message.includes('private response'));
});
test('respuesta exitosa conserva JSON sin cambiar el comportamiento del cliente', async () => {
  assert.deepEqual(await invoke(new Response(JSON.stringify({ id: 10 }))), { id: 10 });
});
