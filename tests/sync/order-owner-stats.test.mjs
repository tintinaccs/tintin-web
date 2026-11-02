import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOrderOwnerStats } from '../../cloudflare/sincronizacion-estadisticas-pedido.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const identity = { userId: 'customer', userEmail: 'customer@example.test' };
const order = (id, total, extra = {}) => ({ name: `projects/demo/databases/(default)/documents/orders/${id}`, fields: encodeFirestoreFields({ ...identity, total, status: 'pendiente', createdAt: '2026-11-02T10:00:00Z', ...extra }) });
const snapshot = '2026-11-02T12:00:00.000000Z';
const page = (documents, after = '', readTime = snapshot) => ({ documents, after, readTime });
const account = async () => ({ updateTime: 'revision-1' });

test('resumen consulta sólo identidades propias, pagina y deduplica el puente histórico', async () => {
  const queries = [], writes = [];
  const first = order('one', 10), second = order('two', 20), historical = order('legacy', 5, { userId: '', userEmail: '', customerEmail: identity.userEmail });
  const result = await syncOrderOwnerStats({}, identity, {
    get: account,
    queryPage: async (_, collection, field, value, options) => {
      queries.push({ collection, field, value, options });
      if (field === 'userId') return options.after ? page([second]) : page([first], first.name);
      if (field === 'userEmail') return page([first, second]);
      return page(field === 'customerEmail' ? [historical] : []);
    },
    commit: async (_, batch) => writes.push(...batch),
  });
  assert.equal(result.updated, true);
  assert(queries.every(q => q.collection === 'orders' && [identity.userId, identity.userEmail].includes(q.value)));
  assert(queries.slice(1).every(q => q.options.readTime === snapshot));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].currentDocument, { updateTime: 'revision-1' });
  const stats = decodeFirestoreFields(writes[0].fields);
  assert.equal(stats.totalOrders, 3);
  assert.equal(stats.totalSpent, 35);
  assert(writes[0].mergeFields.includes('orderStats'));
});

test('un cálculo atrasado encuentra conflicto CAS y recalcula antes de publicar', async () => {
  let version = 1, releaseOld, first = true;
  const writes = [];
  const io = {
    get: async () => ({ updateTime: `revision-${version}` }),
    queryPage: async (_, collection, field) => {
      assert.equal(collection, 'orders');
      if (first) { first = false; return new Promise(resolve => { releaseOld = () => resolve(page([order('one', 10)])); }); }
      return page(field === 'userId' ? [order('one', 10), order('two', 20)] : []);
    },
    commit: async (_, [write]) => {
      if (write.currentDocument.updateTime !== `revision-${version}`) throw Object.assign(new Error('conflict'), { code: 'version_conflict' });
      writes.push(decodeFirestoreFields(write.fields).totalSpent);
      version++;
    },
  };
  const older = syncOrderOwnerStats({}, identity, io);
  while (!releaseOld) await new Promise(resolve => setImmediate(resolve));
  await syncOrderOwnerStats({}, identity, io);
  releaseOld();
  await older;
  assert.deepEqual(writes, [30, 30]);
});

test('un error o snapshot inconsistente no publica un resumen parcial', async () => {
  for (const broken of ['network', 'snapshot', 'cursor']) {
    let calls = 0, commits = 0;
    await assert.rejects(syncOrderOwnerStats({}, identity, {
      get: account,
      queryPage: async () => {
        calls++;
        if (broken === 'network' && calls === 2) throw new Error('offline');
        if (broken === 'snapshot' && calls === 2) return page([], '', 'different');
        return page([order('one', 10)], broken === 'cursor' ? 'repeated' : calls === 1 ? 'next' : '');
      },
      commit: async () => { commits++; },
    }));
    assert.equal(commits, 0);
  }
});

test('no recrea una cuenta eliminada y resuelve la identidad histórica por email', async () => {
  let committed = false;
  const missing = await syncOrderOwnerStats({}, identity, { get: async () => null, queryPage: async () => page([]), commit: async () => { committed = true; } });
  assert.equal(missing.updated, false);
  assert.equal(committed, false);
  let write;
  await syncOrderOwnerStats({}, { userEmail: identity.userEmail }, {
    get: account,
    queryPage: async (_, collection, field) => collection === 'users'
      ? page([{ name: 'users/historical', fields: encodeFirestoreFields({ email: identity.userEmail }) }])
      : page(field === 'userEmail' ? [order('old', 50)] : []),
    commit: async (_, batch) => { write = batch[0]; },
  });
  assert.equal(write.path, 'users/historical');
  assert.equal(decodeFirestoreFields(write.fields).totalSpent, 50);
});

test('presupuesto y conflictos persistentes fallan sin publicar datos parciales', async () => {
  let commits = 0;
  await assert.rejects(syncOrderOwnerStats({}, identity, {
    get: account,
    queryPage: async () => page(Array.from({ length: 10001 }, (_, i) => order(String(i), 1))),
    commit: async () => { commits++; },
  }), /presupuesto/);
  assert.equal(commits, 0);
  await assert.rejects(syncOrderOwnerStats({}, identity, {
    get: account, queryPage: async () => page([]),
    commit: async () => { commits++; throw Object.assign(new Error('conflict'), { code: 'version_conflict' }); },
  }), /conflict/);
  assert.equal(commits, 3);
});
