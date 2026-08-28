import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const checkout = read('apps-script/CrearPedido.gs');
const appsRouter = read('apps-script/ProductosUnificados.gs');
const parity = read('apps-script/AdminParity.gs');
const adminEndpoint = read('functions/api/admin-order-mutation.js');
const sheetsEndpoint = read('functions/api/sheets-admin-webhook.js');
const superadminCrud = read('js/admin/orders/pedidos-superadmin-crud.js');

test('checkout refleja Sheets solo después de confirmar Firestore y también repara reintentos', () => {
  const commitAt = checkout.indexOf('var commit = phase4Commit_(writes, transactionId);');
  const syncNewAt = checkout.lastIndexOf('tintinParityUpsertCheckoutOrder_(orderId, orderData)');
  assert.ok(commitAt >= 0, 'falta el commit canónico del checkout');
  assert.ok(syncNewAt > commitAt, 'Sheets no puede ejecutarse antes del commit comercial');
  assert.match(checkout, /tintinParityUpsertCheckoutOrder_\(orderId, existingOrder\)/);
});

test('router Apps Script acepta syncOrder sin reemplazar createOrder ni productos', () => {
  assert.match(appsRouter, /tintinHandleUnifiedProductsPost_\(body\)/);
  assert.match(appsRouter, /tintinParityHandleServerOrderSync_\(body\)/);
  assert.match(appsRouter, /tintinHandleEngagement_\(body\)/);
});

test('Sheets crea pedidos por el webhook canónico y reconcilia cada minuto', () => {
  assert.match(parity, /action:\s*'createOrder'/);
  assert.match(parity, /TINTIN_PARITY_NEW_ORDER_SHEET\s*=\s*'Nuevo pedido web'/);
  assert.match(parity, /everyMinutes\(1\)/);
  assert.match(parity, /tintinParityUpsertOrder_\(/);
  assert.match(parity, /tintinParityHandleServerOrderSync_/);
  assert.match(sheetsEndpoint, /createOrderAdmin/);
});

test('Superadmin crea por dominio canónico y el endpoint empuja el resultado a Sheets en best-effort', () => {
  assert.match(superadminCrud, /fetch\('\/api\/admin-order-mutation'/);
  assert.match(superadminCrud, /action:\s*'createOrder'/);
  assert.match(adminEndpoint, /createOrderAdmin/);
  assert.match(adminEndpoint, /syncOrderToSheetsBestEffort/);
});
