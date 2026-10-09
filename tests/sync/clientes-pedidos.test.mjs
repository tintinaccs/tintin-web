import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('compradores dentro de Pedidos usan el mismo espejo y se actualizan al llegar nuevas compras', async () => {
  const listeners = new Map(), roots = new Map();
  for (const id of ['local-ledger', 'local-buyers', 'local-order-buyers', 'local-mirror-map']) roots.set(id, { innerHTML: '' });
  roots.set('section-pedidos', { classList: { contains: () => true } });
  let customers = [{ id: 'CUS_LOCAL_fixture', name: 'Cliente <local>', orderCount: 2, totalPurchased: 150000, totalPaid: 150000, lastPurchase: '2026-01-03', hasWebAccount: false }];
  const requests = [];
  const context = vm.createContext({
    Date, console, queueMicrotask, setInterval: () => {},
    MutationObserver: class { observe() {} },
    window: { addEventListener: (name, fn) => listeners.set(name, fn) },
    document: {
      documentElement: {}, hidden: false,
      getElementById: id => roots.get(id),
      addEventListener: () => {},
      querySelectorAll: selector => selector === '#local-buyers, #local-order-buyers' ? [roots.get('local-buyers'), roots.get('local-order-buyers')] : [],
    },
    authenticatedFetch: async (url, options) => {
      requests.push({ url, method: options.method });
      return { ok: true, json: async () => ({ ok: true, checkedAt: new Date().toISOString(), entries: [], contacts: [], customers }) };
    },
  });
  const source = readFileSync(new URL('../../js/admin/comercio-local-admin.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '');
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  assert.equal(roots.get('local-order-buyers').innerHTML, roots.get('local-buyers').innerHTML);
  assert.match(roots.get('local-order-buyers').innerHTML, /Cliente &lt;local&gt;/);
  assert.match(roots.get('local-order-buyers').innerHTML, /2 pedidos/);
  customers = [...customers, { id: 'web_fixture', name: 'Comprador web', hasWebAccount: true, orderCount: 1, totalPurchased: 50000, totalPaid: 50000, lastPurchase: '2026-10-09' }];
  listeners.get('tintin:orders-updated')();
  await new Promise(setImmediate);
  assert.match(roots.get('local-order-buyers').innerHTML, /2 clientes que hicieron pedidos/);
  assert.match(roots.get('local-order-buyers').innerHTML, /Comprador web/);
  assert.ok(requests.every(request => request.url === '/api/local-commerce' && request.method === 'GET'));
});
