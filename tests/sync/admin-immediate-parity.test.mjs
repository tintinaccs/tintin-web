import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildUserSheetRecord } from '../../cloudflare/admin-mirror-sheets-sync.js';

function source(path) {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('el espejo de usuario conserva identidad, ubicación y facturación completas', () => {
  const record = buildUserSheetRecord('uid_123456', {
    name: 'Barbi Ruiz', firstName: 'Barbi', lastName: 'Ruiz', username: 'barbi', customerId: 'CUS_1',
    email: 'barbi@example.com', phone: '+595981123456', ci: '4123456', dob: '1997-05-02T00:00:00.000Z',
    savedLocation: { name: 'Mi casa', address: 'San Lorenzo', lat: -25.34, lng: -57.51 },
    departamento: 'Central', city: 'San Lorenzo', reference: 'Casa rosa',
    invoice: { wanted: true, razonSocial: 'Barbi Ruiz', ruc: '80012345-6' },
    updatedAt: '2026-09-03T13:00:00.000Z',
  });
  assert.equal(record.firstName, 'Barbi');
  assert.equal(record.lastName, 'Ruiz');
  assert.equal(record.dob, '1997-05-02T00:00:00.000Z');
  assert.equal(record.locationName, 'Mi casa');
  assert.equal(record.addressLat, -25.34);
  assert.equal(record.addressLng, -57.51);
  assert.equal(record.departamento, 'Central');
  assert.equal(record.city, 'San Lorenzo');
  assert.equal(record.reference, 'Casa rosa');
  assert.equal(record.invoiceWanted, true);
  assert.equal(record.razonSocial, 'Barbi Ruiz');
  assert.equal(record.ruc, '80012345-6');
});

test('SuperAdmin puede pedir push de un UID objetivo, una cuenta normal no', () => {
  const userPush = source('functions/api/user-sync-push.js');
  assert.match(userPush, /targetUid/);
  assert.match(userPush, /targetUid !== user\.uid && !isSuperAdmin/);
  assert.match(userPush, /syncUserToSheetsBestEffort\(env, targetUid\)/);
});

test('lifecycle sincroniza usuario y auditoría después del commit canónico', () => {
  const lifecycle = source('cloudflare/user-lifecycle-domain.js');
  assert.match(lifecycle, /syncUserToSheetsBestEffort\(env, uid\)/);
  assert.match(lifecycle, /syncAuditToSheetsBestEffort\(env, eventId\)/);
  assert.match(lifecycle, /user\?\.dob \|\| user\?\.birthDate/);
});

test('pedidos administrativos propagan pedido, auditoría y todos los productos antes/después', () => {
  const endpoint = source('functions/api/admin-order-mutation.js');
  assert.match(endpoint, /\.\.\.itemIds\(beforeOrder\), \.\.\.itemIds\(result\?\.order\)/);
  assert.match(endpoint, /syncOrderToSheetsBestEffort/);
  assert.match(endpoint, /syncAuditToSheetsBestEffort/);
  assert.match(endpoint, /syncProductIdsToSheetsBestEffort/);
});

test('checkout confirmado propaga stock aunque Web Push esté desactivado', () => {
  const webhook = source('functions/api/push-order-event.js');
  const mirrorIndex = webhook.indexOf('syncCommittedOrderDependencies');
  const pushGateIndex = webhook.indexOf('if (!pushEnabled(env))');
  assert.ok(mirrorIndex >= 0 && pushGateIndex > mirrorIndex);
  assert.match(webhook, /syncProductIdsToSheetsBestEffort/);
});

test('SuperAdmin observa escrituras directas de usuarios y auditoría solo tras confirmación del servidor', () => {
  const observer = source('js/admin/sincronizacion-paridad-admin.js');
  assert.match(observer, /includeMetadataChanges:\s*true/);
  assert.match(observer, /metadata\.hasPendingWrites/);
  assert.match(observer, /\/api\/user-sync-push/);
  assert.match(observer, /\/api\/audit-sync-push/);
});
