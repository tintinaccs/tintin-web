import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const view = fs.readFileSync(new URL('../../js/admin/diagnostics/estado-ecosistema-admin.js', import.meta.url), 'utf8');

test('el estado del ecosistema explica PayPal deshabilitado sin mostrar credenciales', () => {
  assert.match(view, /\['PayPal', paypalProductionReady/);
  assert.match(view, /Sandbox habilitado · requiere entorno Live/);
  assert.match(view, /Client ID de PayPal/);
  assert.match(view, /Client Secret de PayPal/);
  assert.match(view, /Webhook ID de PayPal/);
  assert.match(view, /actualizar la tasa de cambio/);
  assert.match(view, /const allGreen = payload\?\.ok === true && rows\.every\(\(\[, value\]\) => value === true\)/);
  assert.match(view, /setOverall\(allGreen \? 'PASS' : 'FAIL'/);
  assert.match(view, /Hay componentes que requieren revisión: \$\{failures\.join\(', '\)/);
  assert.doesNotMatch(view, /paypal\.(?:clientSecret|clientId|webhookSecret)/i);
});
