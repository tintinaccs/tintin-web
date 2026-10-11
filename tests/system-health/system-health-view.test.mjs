import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const view = fs.readFileSync(new URL('../../js/admin/diagnostics/estado-ecosistema-admin.js', import.meta.url), 'utf8');

test('el estado del ecosistema explica PayPal deshabilitado sin mostrar credenciales', () => {
  assert.match(view, /\['PayPal', paypalState/);
  assert.match(view, /paypalOptionalDisabled \? 'NOT_APPLICABLE'/);
  assert.match(view, /Deshabilitado por configuración/);
  assert.match(view, /Sandbox habilitado · requiere entorno Live/);
  assert.match(view, /Client ID de PayPal/);
  assert.match(view, /Client Secret de PayPal/);
  assert.match(view, /Webhook ID de PayPal/);
  assert.match(view, /actualizar la tasa de cambio/);
  assert.match(view, /const allGreen = payload\?\.ok === true && rows\.every\(\(\[, value\]\) => value === true \|\| value === 'NOT_APPLICABLE'\)/);
  assert.match(view, /setOverall\(allGreen \? 'PASS' : 'FAIL'/);
  assert.match(view, /Hay componentes que requieren revisión: \$\{failures\.join\(', '\)/);
  assert.doesNotMatch(view, /paypal\.(?:clientSecret|clientId|webhookSecret)/i);
});


test('render distingue servicio opcional de errores reales y desconocidos', () => {
  const nodes = new Map(['system-health-areas', 'system-health-notice'].map(id => [id, {}]));
  let overall;
  const rows = [];
  const context = vm.createContext({
    document: { getElementById: id => nodes.get(id) },
    paypalMissingLabels: () => [],
    item: (name, value, detail) => { rows.push({ name, value, detail }); return ''; },
    setOverall: value => { overall = value; },
    renderMeta: () => {}, renderAuthorities: () => {},
  });
  vm.runInContext(view.slice(view.indexOf('function render(payload)'), view.indexOf('async function authorizedFetch')), context);
  const payload = {
    ok: true,
    admin: Object.fromEntries(['products', 'productInventory', 'collections', 'orders', 'users', 'auditLog', 'settings', 'siteContent', 'visualBuilder'].map(key => [key, true])),
    integrations: { firebase: true, resend: true, cloudinary: true, sheets: true,
      appsScript: { protocolOk: true }, paypal: { optionalDisabled: true, productionReady: false } },
    checkout: { available: true, ok: true },
  };
  context.payload = payload;
  vm.runInContext('render(payload)', context);
  assert.equal(overall, 'PASS');
  assert.equal(rows.find(row => row.name === 'PayPal').value, 'NOT_APPLICABLE');
  payload.checkout.ok = false;
  vm.runInContext('render(payload)', context);
  assert.equal(overall, 'FAIL');
  assert.match(nodes.get('system-health-notice').textContent, /Checkout/);
  payload.checkout.ok = true;
  payload.integrations.paypal = { enabled: false, productionReady: false };
  vm.runInContext('render(payload)', context);
  assert.equal(overall, 'FAIL');
  payload.integrations.paypal = { optionalDisabled: true, productionReady: false };
  payload.checkout.available = false;
  vm.runInContext('render(payload)', context);
  assert.equal(overall, 'FAIL');
});
