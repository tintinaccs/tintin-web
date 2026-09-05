import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileLoyaltyTierNotification } from '../../cloudflare/fidelidad-notificaciones.js';

function firestoreOrder(id, fields) {
  const encoded = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: String(value) }]));
  return { name: `projects/test/databases/(default)/documents/orders/${id}`, fields: encoded };
}

function harness(rows) {
  const calls = { user: [], admin: [] };
  const get = async () => null;
  const query = async () => rows;
  const notifyUser = async (...args) => { calls.user.push(args); return { created: true }; };
  const notifyAdmin = async (...args) => { calls.admin.push(args); return { created: true }; };
  return { calls, get, query, notifyUser, notifyAdmin };
}

test('notifica el ascenso al superar el umbral y usa una clave estable', async () => {
  const rows = [1, 2, 3, 4].map(id => firestoreOrder(`old-${id}`, { userId: 'u-1', userEmail: 'u@example.com', status: 'entregado' }));
  const h = harness(rows);
  const result = await reconcileLoyaltyTierNotification({}, {
    orderId: 'new-1',
    afterOrder: { userId: 'u-1', userEmail: 'u@example.com', userName: 'Ana', status: 'entregado', lastChangeId: 'change-1' },
    ...h,
  });
  assert.equal(result.changed, true);
  assert.equal(result.nextTier.id, 'fiel');
  assert.equal(h.calls.user.length, 1);
  assert.equal(h.calls.admin.length, 1);
  assert.equal(h.calls.user[0][3], 'loyalty-tier:u-1:none:fiel:change-1');
  assert.equal(h.calls.admin[0][2], 'admin:loyalty-tier:u-1:none:fiel:change-1');
});

test('notifica la pérdida del nivel cuando una compra deja de ser válida', async () => {
  const rows = [1, 2, 3, 4].map(id => firestoreOrder(`old-${id}`, { userId: 'u-2', userEmail: 'u2@example.com', status: 'entregado' }));
  const h = harness(rows);
  const result = await reconcileLoyaltyTierNotification({}, {
    orderId: 'order-2',
    beforeOrder: { userId: 'u-2', userEmail: 'u2@example.com', userName: 'Bea', status: 'entregado' },
    afterOrder: { userId: 'u-2', userEmail: 'u2@example.com', userName: 'Bea', status: 'cancelado', lastChangeId: 'change-2' },
    ...h,
  });
  assert.equal(result.changed, true);
  assert.equal(result.nextTier, null);
  assert.match(h.calls.user[0][2].title, /actualizado/i);
});

test('no vuelve a notificar cuando el nivel no cambia', async () => {
  const rows = [1, 2, 3, 4, 5].map(id => firestoreOrder(`old-${id}`, { userId: 'u-3', userEmail: 'u3@example.com', status: 'entregado' }));
  const h = harness(rows);
  const result = await reconcileLoyaltyTierNotification({}, {
    orderId: 'new-3',
    beforeOrder: { userId: 'u-3', userEmail: 'u3@example.com', status: 'entregado' },
    afterOrder: { userId: 'u-3', userEmail: 'u3@example.com', status: 'entregado', lastChangeId: 'change-3' },
    ...h,
  });
  assert.equal(result.changed, false);
  assert.equal(h.calls.user.length, 0);
  assert.equal(h.calls.admin.length, 0);
});
