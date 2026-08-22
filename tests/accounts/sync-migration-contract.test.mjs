import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('la sincronización usa TINTIN INVENTARIO y reutiliza Usuarios web', () => {
  const source = read('apps-script/SyncCuentas.gs');
  assert.match(source, /106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U/);
  assert.match(source, /users: 'Usuarios web'/);
  assert.match(source, /orders: 'Pedidos web'/);
  assert.match(source, /audit: 'Auditoría web'/);
  assert.match(source, /meta: 'Historial sync'/);
  assert.doesNotMatch(source, /1_6yZX6WZgDnh_Berz7F7dnn4vbWbaTbUIv5Cx5DBZPw/);
});

test('Usuarios web conserva customerId como clave canónica y no duplica la vista', () => {
  const source = read('apps-script/SyncCuentas.gs');
  assert.match(source, /'Customer ID'/);
  assert.match(source, /'@Username'/);
  assert.match(source, /'Cédula'/);
  assert.match(source, /'ID último cambio'/);
  assert.match(source, /var customerId = [\s\S]*?\('CUS_' \+ id\)/);
  assert.match(source, /tintinSyncExistingUserNotes_/);
});

test('el trigger de pedidos en Sheets sólo acepta estado y pago', () => {
  const source = read('apps-script/SyncCuentas.gs');
  assert.match(source, /var allowed = \['status', 'paymentStatus'\]/);
  assert.match(source, /Sólo status y paymentStatus pueden editarse desde Sheets/);
  assert.match(source, /tintinSyncRefreshOrderRow_/);
  assert.match(source, /everyMinutes\(5\)/);
});

test('la migración es conservadora e idempotente', () => {
  const source = read('apps-script/MigracionCuentas.gs');
  assert.match(source, /existingCustomerId && existingCustomerId !== expectedCustomerId/);
  assert.match(source, /customerId existente no coincide con CUS_<uid>/);
  assert.match(source, /if \(!existingCustomerId\) patch\.customerId = expectedCustomerId/);
  assert.match(source, /if \(!data\.identityVersion\) patch\.identityVersion = 1/);
  assert.match(source, /if \(!data\.profileStatus\) patch\.profileStatus = 'legacy'/);
  assert.doesNotMatch(source, /patch\.username\s*=/);
  assert.doesNotMatch(source, /patch\.dob\s*=/);
});

test('la migración no reasigna una CI conflictiva', () => {
  const source = read('apps-script/MigracionCuentas.gs');
  assert.match(source, /reservation && String\(reservation\.uid \|\| ''\) !== uid/);
  assert.match(source, /La CI aparece vinculada a más de un UID; no se reasignó/);
  assert.match(source, /ciReservations\//);
});

test('cada pedido legado obtiene snapshot histórico sin consultar precios actuales', () => {
  const source = read('apps-script/MigracionCuentas.gs');
  assert.match(source, /if \(!data\.checkoutSnapshot\)/);
  assert.match(source, /nameAtCheckout/);
  assert.match(source, /unitPriceAtCheckout/);
  assert.match(source, /quantityAtCheckout/);
  assert.match(source, /variantAtCheckout/);
  assert.match(source, /source: 'migration-existing-order'/);
  assert.match(source, /snapshotVersion/);
});

test('el espejo de pedidos publica el snapshot y conserva changeId', () => {
  const source = read('apps-script/SyncCuentas.gs');
  assert.match(source, /data\.checkoutSnapshot \|\| data\.immutableSnapshot \|\| data\.items/);
  assert.match(source, /'itemsSnapshot'/);
  assert.match(source, /'lastChangeId'/);
  assert.match(source, /tintinSyncChangeId_\('SHEET_ORDER'\)/);
});
