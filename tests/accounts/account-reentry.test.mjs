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

test('el perfil eliminado no se reactiva desde el panel: vuelve por un registro nuevo', () => {
  const admin = read('js/admin/admin-app.js');
  assert.match(admin, /debe registrarse nuevamente/);
  assert.match(admin, /userStatusFilter === 'deleted'[\s\S]*?no se reactivan/);
  assert.match(read('login.html'), /Si figura como Eliminada, registrate nuevamente con el mismo correo/);
  assert.doesNotMatch(admin, /onclick="window\.restoreUser\(\$\{uidArg\}\)">Reactivar/);
  assert.match(admin, /bulkDeleteUsers/);
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
});
