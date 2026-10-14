import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function withConnectionDeadline('), source.indexOf('async function probeClientFirestoreRules('));
function fixture() {
  const context = vm.createContext({ AbortSignal, Promise, readAdminFirestore: read => read() });
  vm.runInContext(helper, context);
  return context;
}

test('cancelar libera una lectura que nunca respondió y conserva el motivo', async () => {
  const f = fixture(); const controller = new AbortController();
  const run = f.withConnectionDeadline(() => new Promise(() => {}), controller.signal);
  const error = new Error('vista cerrada'); controller.abort(error);
  await assert.rejects(run, value => value === error);
});

test('una lectura cancelada antes de comenzar no inicia solicitudes', async () => {
  const f = fixture(); const controller = new AbortController(); let calls = 0;
  controller.abort();
  await assert.rejects(f.withConnectionDeadline(() => { calls++; }, controller.signal));
  assert.equal(calls, 0);
});

test('un fallo o demora puntual queda sin confirmar y no frena las demás lecturas', async () => {
  const f = fixture(); const controller = new AbortController();
  const slow = f.probeClientFirestoreRead('Productos', () => new Promise(() => {}), controller.signal);
  const fast = f.probeClientFirestoreRead('Pedidos', async () => ({ size: 3 }));
  controller.abort();
  const [products, orders] = await Promise.all([slow, fast]);
  assert.equal(products.ok, false); assert.equal(products.status, 0);
  assert.equal(orders.ok, true); assert.equal(orders.count, 3);
});
