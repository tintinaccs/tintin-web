import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync('js/admin/admin-app.js', 'utf8');
const html = fs.readFileSync('admin.html', 'utf8');

test('Usuarios separa activos, bloqueados y eliminados', () => {
  assert.match(html, /data-user-tab="active"/);
  assert.match(html, /data-user-tab="blocked"/);
  assert.match(html, /data-user-tab="deleted"/);
  assert.match(admin, /userStatusFilter === 'deleted'/);
  assert.match(admin, /u\.blocked && u\.deleted !== true/);
  assert.match(admin, /u\.deleted === true \|\| u\.profileStatus === 'deleted'/);
});
