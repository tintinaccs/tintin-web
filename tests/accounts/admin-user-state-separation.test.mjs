import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync('js/admin/admin-app.js', 'utf8');
const html = fs.readFileSync('admin.html', 'utf8');

test('Usuarios tiene sólo dos pestañas: activos y bloqueados (sin Eliminados)', () => {
  assert.match(html, /data-user-tab="active"/);
  assert.match(html, /data-user-tab="blocked"/);
  assert.doesNotMatch(html, /data-user-tab="deleted"/);
  assert.doesNotMatch(admin, /userStatusFilter === 'deleted'/);
  // Un resto histórico eliminado nunca se mezcla con activos ni bloqueados.
  assert.match(admin, /u\.blocked && u\.deleted !== true && u\.profileStatus !== 'deleted'/);
  assert.match(admin, /!u\.blocked && u\.deleted !== true && u\.profileStatus !== 'deleted'/);
  assert.doesNotMatch(html, /users-delete-by-email-btn|users-bulk-delete-btn/);
});
