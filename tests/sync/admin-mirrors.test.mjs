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
