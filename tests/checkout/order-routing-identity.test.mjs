import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el checkout público usa únicamente el bridge de Cloudflare para crear pedidos', () => {
  const client = read('js/create-order-client.js');

  assert.match(client, /apiUrl\(['"]apps-script-bridge['"]\)/);
  assert.doesNotMatch(client, /EMAIL_WEBHOOK_URL/);
  assert.doesNotMatch(client, /script\.google\.com/);
});

test('Cloudflare verifica la sesión y descarta identidad controlada por el navegador', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  assert.match(bridge, /authenticatedUser = await verifyFirebaseIdToken\(idToken\)/);
  assert.match(bridge, /delete forwardedPayload\.userId/);
  assert.match(bridge, /delete forwardedPayload\.customerId/);
  assert.match(bridge, /delete forwardedPayload\.userEmail/);
});

test('un pedido exitoso debe quedar ligado a CUS_<UID> antes de responder éxito', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  assert.match(bridge, /const customerId = `CUS_\$\{uid\}`/);
  assert.match(bridge, /clean\(order\.userId, 128\) !== uid/);
  assert.match(bridge, /existingCustomerId && existingCustomerId !== customerId/);
  assert.match(bridge, /mergeFields: \['customerId'\]/);
  assert.match(bridge, /enforceCanonicalOrderIdentity\(env, parsed\.orderId, authenticatedUser\)/);
});

test('el espejo inmediato a Sheets recibe el pedido ya canonizado', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  assert.match(bridge, /syncOrderToSheetsBestEffort/);
  assert.match(bridge, /order: identity\.order/);
  assert.match(bridge, /parsed\.sheetsSync = sheetsSync/);
});

test('Apps Script deriva userId desde el token y no desde el payload', () => {
  const appsScript = read('apps-script/CrearPedido.gs');

  assert.match(appsScript, /var uid = auth\.uid;/);
  assert.match(appsScript, /userId: uid/);
  assert.doesNotMatch(appsScript, /userId:\s*payload\./);
});
