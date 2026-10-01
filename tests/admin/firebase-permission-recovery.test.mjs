import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Admin notifications stop retrying permanent Firestore denials', () => {
  const source = read('js/admin/notifications/notificaciones-admin.js');
  assert.match(source, /function shouldRetryFirestoreListener\(error\)/);
  assert.match(source, /permission-denied/);
  assert.match(source, /unauthenticated/);
  assert.match(source, /user && shouldRetryFirestoreListener\(error\).*subscribeNotifications/);
  assert.match(source, /user && shouldRetryFirestoreListener\(error\).*subscribeOrderStatusChanges/);
});

test('Private Admin Firestore consumers use the strict App Check gate', () => {
  const paths = [
    'js/admin/settings/cupones-admin.js',
    'js/admin/settings/esquema-color-admin.js',
    'js/admin/settings/control-tienda-admin.js',
    'js/admin/settings/metodos-pago-admin.js',
    'js/admin/settings/sincronizacion-correo-admin.js',
    'js/admin/content/gestion-contenido-admin.js',
  ];
  for (const path of paths) {
    const source = read(path);
    assert.match(source, /waitForAdminAppCheck/);
    assert.doesNotMatch(source, /await appCheckReady/);
  }
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
  assert.match(flow, /getIdTokenResult\(true\)/);
  assert.match(flow, /projectClaim === 'tintin-accesorios'/);
  assert.match(flow, /firestoreError/);
  assert.match(flow, /waitForAdminAppCheck\(12000\)/);
  assert.match(live, /email=\$\{sessionProbe\.emailClaim/);
  assert.match(live, /proyecto=\$\{sessionProbe\.projectClaim/);
});
