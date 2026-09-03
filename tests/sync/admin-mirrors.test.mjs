import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('Sheets nunca elimina físicamente identidades de usuario', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const lifecycle = read('cloudflare/user-lifecycle-domain.js');
  const parity = read('apps-script/AdminParity.gs');

  assert.doesNotMatch(webhook, /deleteFirebaseUser/);
  assert.doesNotMatch(webhook, /path:\s*`users\/\$\{uid\}`\s*,\s*delete:\s*true/);
  assert.match(webhook, /action === 'deleteUser' \|\| action === 'softDeleteUser'/);
  assert.match(lifecycle, /deleted:\s*fsBoolean\(true\)/);
  assert.match(lifecycle, /setFirebaseUserDisabled\(env, uid, action === 'softDelete'\)/);
  assert.match(parity, /'ELIMINAR' \? 'softDeleteUser'/);
  assert.match(parity, /'REACTIVAR' \? 'reactivateUser'/);
  assert.doesNotMatch(parity, /sheet\.deleteRow/);
});

test('Pedidos web solo administra pedidos mediante el dominio canónico de inventario', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');
  const orderDomain = read('cloudflare/order-admin-domain.js');

  assert.match(webhook, /input\.entity === 'order'/);
  assert.match(webhook, /applyOrderAdminMutation/);
  assert.match(webhook, /createOrderAdmin/);
  assert.match(parity, /entity: 'order'/);
  assert.match(parity, /action: 'updateOrder'/);
  assert.match(parity, /baseChangeId:/);
  assert.match(parity, /tintinParityCallWebhook_\(TINTIN_ADMIN_WEBHOOK_PATH, payload\)/);
  assert.doesNotMatch(parity, /productInventory\//);
  assert.doesNotMatch(parity, /firestoreAdmin(?:Batch)?Commit|phase4Commit_/);
  assert.match(orderDomain, /computeInventoryDeltas/);
  assert.match(orderDomain, /auditLog/);
});

test('Usuarios administrativos usa changeId, baseChangeId y origen', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');

  assert.match(webhook, /baseChangeId/);
  assert.match(webhook, /currentChangeId === nextChangeId/);
  assert.match(webhook, /baseChangeId !== currentChangeId/);
  assert.match(webhook, /syncOrigin/);
  assert.match(parity, /baseChangeId:/);
  assert.match(parity, /source: 'google-sheets:Usuarios web'/);
  assert.match(parity, /schemaVersion: 6/);
});

test('Snapshot administrativo pagina hasta 5000 y recupera cédula de checkout', () => {
  const snapshot = read('functions/api/sheets-sync-snapshot.js');
  assert.match(snapshot, /const MAX_RECORDS = 5000;/);
  assert.match(snapshot, /checkoutDefaults/);
  assert.match(snapshot, /ci:\s*user\.ci \|\| checkoutDefaults\.ci \|\| ''/);
  assert.match(snapshot, /firestoreAdminListAll\(env, collection, MAX_RECORDS\)/);
  assert.match(snapshot, /firstName: user\.firstName/);
  assert.match(snapshot, /locationName: savedLocation\.name/);
  assert.match(snapshot, /ruc: invoice\.ruc/);
});

test('Bloqueo desde Sheets compensa Firebase Auth si falla Firestore', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  assert.match(webhook, /restoreAuthStateBestEffort/);
  assert.match(webhook, /previousDisabled = current\.blocked === true/);
  assert.match(webhook, /if \(previousDisabled !== blocked\)/);
  assert.match(webhook, /authFirestoreCompensation:\s*true/);
});

test('Historial sync serializa inserciones y Nuevo pedido no se corta en fila 1000', () => {
  const productsScript = read('apps-script/ProductosUnificados.gs');
  const parity = read('apps-script/AdminParity.gs');
  assert.match(productsScript, /LockService\.getScriptLock\(\)/);
  assert.match(productsScript, /lock\.tryLock\(10000\)/);
  assert.match(productsScript, /lock\.releaseLock\(\)/);
  assert.doesNotMatch(parity, /Productos!\$A\$7:\$F\$1000/);
  assert.match(parity, /Productos!\$A\$7:\$F;2;FALSE/);
  assert.match(parity, /Productos!\$A\$7:\$F;6;FALSE/);
});
