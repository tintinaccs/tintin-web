import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

const firebase = read('js/core/firebase/firebase.js');
const appCheckGate = read('js/admin/auth/app-check-admin.js');
const admin = read('js/admin/admin-app.js');
const welcome = read('js/admin/content/control-bienvenida-admin.js');
const engagement = read('js/admin/participacion/gestion-participacion-admin-v2.js');
const notifications = read('js/admin/notifications/notificaciones-admin.js');
const html = read('admin.html');
const css = read('css/admin/admin.css');

test('Admin usa el inicializador Firebase canónico y no crea un segundo runtime', () => {
  assert.match(html, /js\/core\/firebase\/firebase\.js\?v=tintin-20260924-auth-persistence-init-1/);
  assert.doesNotMatch(html, /firebase-admin-estable|admin-bootstrap/);
  for (const source of [admin, welcome, engagement, notifications, appCheckGate]) {
    assert.match(source, /core\/firebase\/firebase\.js\?v=tintin-20260924-auth-persistence-init-1/);
    assert.doesNotMatch(source, /firebase-admin-estable/);
  }
  assert.match(firebase, /initializeAuth\(app, \{ persistence: browserLocalPersistence \}\)/);
  assert.doesNotMatch(appCheckGate, /initializeApp\(|initializeAuth\(|initializeAppCheck\(/);
});

test('Admin no abre Firestore privado hasta confirmar App Check', () => {
  assert.match(appCheckGate, /export async function waitForAdminAppCheck/);
  assert.match(admin, /const appCheckAvailable = await waitForAdminAppCheck\(12000\)/);
  assert.ok(
    admin.indexOf('await waitForAdminAppCheck(12000)') < admin.indexOf('const role = await getUserRole'),
    'App Check debe resolverse antes de leer rol/datos privados'
  );
  assert.match(welcome, /if \(!await waitForAdminAppCheck\(12000\)\)/);
  assert.match(engagement, /if \(!await waitForAdminAppCheck\(12000\)\) return/);
  assert.equal((notifications.match(/await waitForAdminAppCheck\(12000\)/g) || []).length, 2);
});

test('App Check lento o caído no se interpreta como logout', () => {
  assert.match(appCheckGate, /return false/);
  assert.doesNotMatch(appCheckGate, /signOut\s*\(/);
  assert.doesNotMatch(appCheckGate, /location\.(?:assign|replace)/);
  assert.match(admin, /showAdminAppCheckUnavailable\(\)/);
});

test('pérdida real de sesión desmonta también catálogo e inventario', () => {
  const teardown = admin.match(/function teardownAdminRealtimeOnSessionLoss\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(teardown, /_productosUnsub/);
  assert.match(teardown, /_productInventoryUnsub/);
  assert.match(teardown, /_productosSlowTimer/);
});

test('listeners de participación manejan errores en vez de dejarlos sin callback', () => {
  assert.match(engagement, /function engagementRealtimeError/);
  for (const label of ['usuarios', 'reseñas', 'favoritos', 'respuestas rápidas', 'configuración de participación']) {
    assert.ok(engagement.includes(`engagementRealtimeError('${label}')`), `falta handler de ${label}`);
  }
});

test('shell responsive usa un contenedor de acciones y el título no es absoluto', () => {
  assert.match(html, /class="adm-topbar-actions"/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.adm-topbar-title\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /html\.adm-sidebar-is-collapsed\s*\{\s*--sidebar-w:\s*84px/);
  assert.match(css, /\.adm-sidebar-is-collapsed \.adm-sidebar:hover[\s\S]*?width:\s*84px/);
});
