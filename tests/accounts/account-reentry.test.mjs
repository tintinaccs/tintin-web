import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('un nuevo registro reclama solo el historial comercial por ID token y hash del correo', () => {
  const profile = read('js/core/store/perfil-usuario.js');
  const endpoint = read('functions/api/claim-commerce-history.js');
  assert.match(profile, /claimHistoricalCommerce\(user\)/);
  assert.match(endpoint, /requireFirebaseUser\(request\)/);
  assert.match(endpoint, /deletedEmailHash/);
  assert.match(endpoint, /commerceHistoryClaimedByUid/);
  assert.match(endpoint, /customerId: source\.customerId/);
  assert.doesNotMatch(endpoint, /name: source\./);
  assert.doesNotMatch(endpoint, /phone: source\./);
});

test('el panel sólo bloquea/desbloquea: no existe eliminar cuentas', () => {
  const admin = read('js/admin/admin-app.js');
  assert.doesNotMatch(admin, /window\.deleteUser|bulkDeleteUsers|deleteUserByEmail|\/api\/admin-delete-user/);
  assert.match(admin, /window\.blockUser = async/);
  assert.match(admin, /window\.restoreUser = async/);
  const login = read('login.html');
  assert.match(login, /code === "auth\/user-disabled"\)[\s\S]*?Verificar por correo/);
  assert.match(login, /data-login-email-recovery/);
  assert.match(login, /sendOtp\(email\);/);
  assert.match(admin, /toggleSelectAllUsers/);
});

test('la barra lateral compacta se conserva, se expande en hover y no mueve el contenido', () => {
  const html = read('admin.html');
  const css = read('css/admin/admin.css');
  const runtime = read('js/admin/sidebar-expandible-admin.js');
  assert.match(html, /id="adm-sidebar-toggle"/);
  assert.match(runtime, /localStorage\.setItem/);
  assert.match(css, /adm-sidebar-is-collapsed/);
  assert.match(css, /\.adm-sidebar:hover/);
  assert.match(css, /--sidebar-w: 76px/);
  assert.match(css, /@media \(min-width: 541px\) and \(max-width: 900px\)[\s\S]*?\.adm-sidebar-toggle\s*\{\s*display:\s*grid;/);
  assert.match(css, /html:not\(\.adm-sidebar-is-collapsed\) body:has\(\.adm-main\) \.adm-sidebar \{[\s\S]*?width: 260px/);
  assert.match(runtime, /hover: hover.*pointer: fine/);
  assert.match(runtime, /adm-sidebar-peek/);
  assert.match(runtime, /pinned = !pinned/);
  assert.match(read('css/admin/sidebar-interaccion.css'), /html\.adm-sidebar-auto.*\.adm-main \{ margin-left: 74px/);
});
