import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('la experiencia de comercio pagina todos los listados en bloques de 30', () => {
  const source = read('js/admin/shopify-commerce-admin.js');
  assert.match(source, /const ADMIN_PAGE_SIZE = 30/);
  assert.match(source, /const ORDER_PAGE_SIZE = ADMIN_PAGE_SIZE/);
  assert.match(source, /pageSlice\(list, state\.productPage\)/);
  assert.match(source, /pageSlice\(list, state\.collectionPage\)/);
  assert.match(source, /pageSlice\(list, state\.orderPage\)/);
  assert.match(source, /products-page-next/);
  assert.match(source, /collections-page-next/);
  assert.match(source, /orders-page-next/);
});

test('la capa de comercio y los flujos legacy limitan acciones masivas a 30', () => {
  const commerce = read('js/admin/shopify-commerce-admin.js');
  const legacy = read('js/admin/admin-app.js');
  assert.match(commerce, /const MAX_BULK_SELECTION = 30/);
  assert.match(commerce, /set\.size >= MAX_BULK_SELECTION/);
  assert.match(legacy, /const MAX_ADMIN_BULK_SELECTION = 30/);
  assert.match(legacy, /rejectOversizedAdminBulkSelection\(ids1, 'productos'\)/);
  assert.match(legacy, /rejectOversizedAdminBulkSelection\(_selectedUsers, 'usuarios'\)/);
  assert.match(legacy, /rejectOversizedAdminBulkSelection\(_selectedOrders, 'pedidos'\)/);
});

test('usuarios legacy también muestra solo 30 filas por página', () => {
  const html = read('admin.html');
  const source = read('js/admin/admin-app.js');
  assert.match(html, /id="users-pagination"/);
  assert.match(source, /pageUsers = users\.slice\(usersPage \* ADMIN_PAGE_SIZE/);
  assert.match(source, /window\.setUsersPage/);
});

