import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('Sheets nunca elimina físicamente identidades de usuario', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const lifecycle = read('cloudflare/user-lifecycle-domain.js');
  const appsScript = read('apps-script/ProductosUnificados.gs');

  assert.doesNotMatch(webhook, /deleteFirebaseUser/);
  assert.doesNotMatch(webhook, /path:\s*`users\/\$\{uid\}`\s*,\s*delete:\s*true/);
  assert.match(webhook, /action === 'deleteUser' \|\| action === 'softDeleteUser'/);
  assert.match(lifecycle, /deleted:\s*fsBoolean\(true\)/);
  assert.match(lifecycle, /setFirebaseUserDisabled\(env, uid, action === 'softDelete'\)/);
  assert.match(appsScript, /'ELIMINAR' \? 'softDeleteUser' : 'updateUser'/);
  assert.doesNotMatch(appsScript, /payload\.action === 'deleteUser'\) sheet\.deleteRow/);
});

test('Pedidos web es espejo de solo lectura y no salta integridad de inventario', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const appsScript = read('apps-script/ProductosUnificados.gs');

  assert.match(webhook, /input\.entity === 'order'/);
  assert.match(webhook, /Pedidos web es un espejo de solo lectura/);
  assert.doesNotMatch(webhook, /path:\s*`orders\/\$\{orderId\}`/);
  assert.match(appsScript, /Pedidos web es un espejo de solo lectura/);
  assert.doesNotMatch(appsScript, /entity: 'order', orderId:/);
});

test('Usuarios administrativos usa changeId, baseChangeId y origen', () => {
  const webhook = read('functions/api/sheets-admin-webhook.js');
  const appsScript = read('apps-script/ProductosUnificados.gs');

  assert.match(webhook, /baseChangeId/);
  assert.match(webhook, /currentChangeId === nextChangeId/);
  assert.match(webhook, /baseChangeId !== currentChangeId/);
  assert.match(webhook, /syncOrigin/);
  assert.match(appsScript, /baseChangeId:/);
  assert.match(appsScript, /source: 'google-sheets:Usuarios web'/);
  assert.match(appsScript, /schemaVersion: 4/);
});
