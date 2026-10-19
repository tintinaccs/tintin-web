import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
function functionSource(name, next) { return source.slice(source.indexOf(`function ${name}(`), source.indexOf(next, source.indexOf(`function ${name}(`))); }

function dashboard(orders, ready = true, permissions = true) {
  const card = { style: {} };
  const fields = new Map();
  const field = id => { if (!fields.has(id)) fields.set(id, { textContent: '', innerHTML: '', closest: () => card }); return fields.get(id); };
  const context = {
    document: { getElementById: field }, currentRole: 'superadmin', can: () => permissions,
    adminRealtimeReady: { users: ready, orders: ready }, adminRealtimeErrors: {},
    allUsers: [{ uid: 'one' }], allOrders: orders, roleCanDo: () => permissions,
    formatPrice: String, formatDate: () => 'Fecha', escapeHtmlAdmin: String, orderStatusBadgeHtml: String,
  };
  vm.createContext(context);
  vm.runInContext(functionSource('activityTimestampMillis', '\nfunction activityLocationLabel') + '\n' + functionSource('renderDashboardData', '\nfunction loadDashboard') + '\nrenderDashboardData();', context);
  return { field, card };
}

test('Últimos pedidos mezcla fechas ISO y Timestamp, ordena del más nuevo y limita a cinco', () => {
  const orders = [
    { userName: 'antiguo', createdAt: { toDate: () => new Date('2026-01-01') } },
    ...Array.from({ length: 6 }, (_, index) => ({ userName: `pedido-${index + 1}`, createdAt: `2026-02-${String(index + 1).padStart(2, '0')}T12:00:00Z` })),
  ];
  const { field } = dashboard(orders);
  const html = field('dash-recent-orders').innerHTML;
  assert.ok(html.indexOf('pedido-6') < html.indexOf('pedido-5'));
  assert.ok(html.indexOf('pedido-5') < html.indexOf('pedido-2'));
  assert.ok(!html.includes('pedido-1') && !html.includes('antiguo'));
  assert.equal((html.match(/<tr>/g) || []).length, 5);
});

test('Dashboard conserva estado desconocido ante datos no confirmados y respeta permisos', () => {
  for (const [ready, permissions] of [[false, true], [true, false]]) {
    const { field, card } = dashboard([{ total: 1000 }], ready, permissions);
    for (const id of ['stat-users', 'stat-orders-total', 'stat-orders-today', 'stat-sales-month']) assert.equal(field(id).textContent, '—');
    if (!permissions) assert.equal(card.style.display, 'none');
    else assert.match(field('dash-recent-orders').innerHTML, /Sincronizando/);
  }
});

test('el paginador real de Usuarios ofrece los registros de la segunda página', () => {
  const fields = new Map(['users-tbody', 'users-pagination'].map(id => [id, { innerHTML: '' }]));
  const size = Number(source.match(/const ADMIN_PAGE_SIZE\s*=\s*(\d+)/)[1]);
  const users = Array.from({ length: size + 5 }, (_, i) => ({ uid: `u${i}`, name: `Cuenta ${i}`, email: `u${i}@example.test`, role: 'client' }));
  const context = {
    document: { getElementById: id => fields.get(id) }, usersPage: 0, ADMIN_PAGE_SIZE: size,
    SUPER_ADMIN: 'owner@example.test', currentRole: 'viewer', ROLE_LABELS: { client: 'Cliente' }, can: () => false,
    escapeHtmlAdmin: String, inlineArgumentAdmin: JSON.stringify, sanitizeImageUrl: () => '', formatPrice: String, _selectedUsers: new Set(), users,
  };
  vm.createContext(context);
  vm.runInContext(functionSource('renderUsersTable', '\nwindow.setUsersPage') + '\nrenderUsersTable(users);', context);
  assert.equal((fields.get('users-tbody').innerHTML.match(/<tr>/g) || []).length, size);
  assert.match(fields.get('users-pagination').innerHTML, /Página 1 de 2/);
  vm.runInContext('usersPage=1; renderUsersTable(users);', context);
  assert.equal((fields.get('users-tbody').innerHTML.match(/<tr>/g) || []).length, 5);
  assert.match(fields.get('users-tbody').innerHTML, new RegExp(`Cuenta ${size}`));
  assert.match(fields.get('users-pagination').innerHTML, /Página 2 de 2/);
});
