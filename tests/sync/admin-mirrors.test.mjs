import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('Sheets no puede eliminar cuentas: sólo activas o bloqueadas', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const parity = read('apps-script/AdminParity.gs');

  assert.doesNotMatch(webhook, /deleteFirebaseUser|applyUserLifecycle/);
  assert.doesNotMatch(webhook, /path:\s*`users\/\$\{uid\}`\s*,\s*delete:\s*true/);
  assert.match(webhook, /La eliminación de cuentas fue retirada/);
  assert.doesNotMatch(parity, /softDeleteUser|reactivateUser|'ELIMINAR'/);
  assert.match(parity, /tintinPullUsersFromWeb_\(\)/);
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
  assert.match(snapshot, /return \{ \.\.\.record, eventId: documentId\(document\), timestamp: asIso/);
});

test('Reconciliación Sheets reintenta solo errores de red transitorios del snapshot de solo lectura', async () => {
  const productsScript = read('apps-script/ProductosUnificados.gs');
  const snapshot = productsScript.match(/function tintinSnapshot_\(entity\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(snapshot, /TINTIN_SNAPSHOT_PATH/);
  const makeContext = (call, waits = []) => {
    const context = { tintinCallInternalWebhook_: call, TINTIN_SNAPSHOT_PATH: '/api/sheets-sync-snapshot', Utilities: { sleep: ms => waits.push(ms) } };
    vm.runInNewContext(`${snapshot}\nthis.runSnapshot = tintinSnapshot_;`, context);
    return context;
  };

  let calls = 0;
  const waits = [];
  const retryContext = makeContext(() => {
    calls += 1;
    if (calls < 3) throw new Error('Exception: Address unavailable: https://example.test/api/sheets-sync-snapshot');
    return { records: [{ uid: 'fixture' }] };
  }, waits);
  assert.deepEqual(retryContext.runSnapshot('users'), [{ uid: 'fixture' }]);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [250, 750]);

  calls = 0;
  const apiError = new Error('HTTP 503: service unavailable');
  const noRetryContext = makeContext(() => { calls += 1; throw apiError; });
  assert.throws(() => noRetryContext.runSnapshot('users'), /HTTP 503/);
  assert.equal(calls, 1);

  calls = 0;
  const offlineWaits = [];
  const offlineContext = makeContext(() => { calls += 1; throw new Error('Address unavailable'); }, offlineWaits);
  assert.throws(() => offlineContext.runSnapshot('users'), /Address unavailable/);
  assert.equal(calls, 3);
  assert.deepEqual(offlineWaits, [250, 750]);
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
