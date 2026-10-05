import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Admin notifications stop retrying permanent Firestore denials', () => {
  const source = read('js/admin/notifications/notificaciones-admin.js');
  // Permisos/auth: un único refresh de identidad + App Check, nunca un timer fijo.
  assert.match(source, /code === 'permission-denied' \|\| code === 'unauthenticated'/);
  assert.match(source, /recoverAdminSecurity\(targetUser.uid\)/);
  assert.match(source, /scheduleAdminListenerRecovery\('notifications', error, \(\) => subscribeNotifications\(\)\)/);
  assert.match(source, /scheduleAdminListenerRecovery\('orders', error, \(\) => subscribeOrderStatusChanges\(\)\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => subscribe(Notifications|OrderStatusChanges)\(\), 1400\)/);
});

test('Coupons use the strict Admin App Check gate before Firestore', () => {
  const source = read('js/admin/settings/cupones-admin.js');
  assert.match(source, /waitForAdminAppCheck/);
  assert.doesNotMatch(source, /await appCheckReady/);
});

test('Profile orders never start Firestore after App Check resolves unavailable', () => {
  const source = read('js/pages/profile/pedidos-perfil.js');
  assert.match(source, /profileAppCheckReady/);
  assert.match(source, /TintinAppCheckStatus === 'enabled'/);
  assert.match(source, /tintin:app-check-ready/);
  assert.match(source, /if\(user&&!secure\)/);
});

test('Commerce distinguishes load errors from legitimate empty data', () => {
  const source = read('js/admin/shopify-commerce-admin.js');
  assert.match(source, /productsError: ''/);
  assert.match(source, /collectionsError: ''/);
  assert.match(source, /No se pudieron cargar los productos\. El total no está disponible\./);
  assert.match(source, /No se pudieron cargar las colecciones\. El total no está disponible\./);
  assert.match(source, /data-action="products-retry"/);
  assert.match(source, /data-action="collections-retry"/);
  assert.match(source, /state\.ordersError \? "—" : sourceTotal/);
});

test('Connections diagnostics distinguish ID token claims from Firestore authorization', () => {
  const flow = read('js/admin/flujo-conexiones/flujo-conexiones-admin.js');
  const live = read('js/admin/flujo-conexiones/live-checks.js');
  assert.match(flow, /getIdTokenResult\(\)/);
  assert.match(flow, /projectClaim === 'tintin-accesorios'/);
  assert.match(flow, /firestoreError/);
  assert.match(flow, /waitForAdminAppCheck\(12000\)/);
  assert.match(live, /email=\$\{sessionProbe\.emailClaim/);
  assert.match(live, /proyecto=\$\{sessionProbe\.projectClaim/);
});
