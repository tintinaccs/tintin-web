import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

const stableFirebase = read('js/core/firebase/firebase-admin-estable.js');
const bootstrap = read('js/admin/admin-bootstrap.js');
const admin = read('js/admin/admin-app.js');
const welcome = read('js/admin/content/control-bienvenida-admin.js');
const engagement = read('js/admin/participacion/gestion-participacion-admin-v2.js');
const html = read('admin.html');
const css = read('css/admin/admin.css');

test('admin inicia Firebase estable antes de permitir imports legacy del loader', () => {
  assert.match(bootstrap, /firebase-admin-estable\.js/);
  assert.match(bootstrap, /tintin-20260924-admin-auth-stable-1/);
  assert.match(bootstrap, /document\.createElement\('script'\)/);
  assert.ok(
    bootstrap.indexOf('firebase-admin-estable.js') < bootstrap.indexOf('cargador-pagina.js'),
    'Firebase estable debe evaluarse antes de inyectar el loader clásico'
  );
  assert.match(html, /admin-bootstrap\.js\?v=tintin-20260924-admin-bootstrap-1/);
  assert.doesNotMatch(html, /<script src="js\/cargador-pagina\.js/);
});

test('bootstrap protegido no migra persistencia de una sesión activa', () => {
  const executable = stableFirebase.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(stableFirebase, /persistence:\s*\[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence\]/);
  assert.doesNotMatch(executable, /\bsetPersistence\s*\(/);
  assert.match(stableFirebase, /waitForAppCheckToken/);
});

test('admin no abre Firestore privado hasta confirmar App Check', () => {
  assert.match(admin, /const appCheckAvailable = await waitForAppCheckToken\(12000\)/);
  assert.ok(
    admin.indexOf('await waitForAppCheckToken(12000)') < admin.indexOf('const role = await getUserRole'),
    'App Check debe resolverse antes de leer rol/datos privados'
  );
  assert.match(welcome, /if \(!await waitForAppCheckToken\(12000\)\)/);
  assert.match(engagement, /if \(!await waitForAppCheckToken\(12000\)\) return/);
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
