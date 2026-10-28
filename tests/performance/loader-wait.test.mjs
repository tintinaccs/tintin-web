import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { waitLoaderGone } = createRequire(import.meta.url)('./_helpers.js');

test('la espera del loader usa el timeout como opción de Playwright, no como argumento del navegador', async () => {
  let received;
  await waitLoaderGone({ waitForFunction: async (...args) => { received = args; } }, 123);
  assert.equal(received[1], null);
  assert.deepEqual(received[2], { timeout: 123 });
});

test('un loader que no termina hace fallar la prueba y no se presenta como éxito', async () => {
  const timeout = new Error('Timeout esperando al loader');
  await assert.rejects(waitLoaderGone({ waitForFunction: async () => { throw timeout; } }, 123), error => error === timeout);
});
