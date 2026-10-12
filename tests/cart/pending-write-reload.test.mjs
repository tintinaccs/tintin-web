import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../js/components/cart/sincronizacion-carrito.js', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`  ${name}`), source.indexOf(`  ${next}`, source.indexOf(`  ${name}`)));
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const metadata of [{ fromCache: true }, { hasPendingWrites: true }]) {
  test(`a non-authoritative snapshot cannot acknowledge or erase local edits: ${JSON.stringify(metadata)}`, () => {
    let writes = 0, removed = 0;
    const context = vm.createContext({ currentUser: { uid: 'qa' }, authGeneration: 1,
      remoteItemFromSnapshot: item => item, projection: JSON.stringify,
      pendingRemoteWrite: true, desiredProjection: '[]', lastRemoteProjection: '[]',
      enrichRemote: items => items, currentLocalCart: () => [],
      writeLocal: () => writes++, rawRemove: () => removed++, dirtyKey: () => 'dirty',
      setStatus: () => {}, navigator: { onLine: true } });
    vm.runInContext(extract('function handleLaterRemote(', 'function subscribeToRemote('), context);
    context.handleLaterRemote({ docs: [], metadata }, 1);
    assert.equal(context.pendingRemoteWrite, true);
    assert.equal(writes, 0);
    assert.equal(removed, 0);
  });
}

test('older commit acknowledgement cannot clear a newer local cart edit before navigation', async () => {
  let release;
  const storage = new Map([['dirty-qa', '1']]);
  const context = vm.createContext({ currentUser: { uid: 'qa' }, remoteInitialized: true, authGeneration: 1,
    normalizeCart: items => items, projection: JSON.stringify, writeChain: Promise.resolve(),
    replaceRemoteCart: () => new Promise(resolve => { release = resolve; }),
    desiredProjection: '[]', pendingRemoteWrite: true, guestAtLogin: [],
    dirtyKey: uid => 'dirty-' + uid, migratedKey: uid => 'migrated-' + uid,
    rawRemove: key => storage.delete(key), rawStringSet: (key, value) => storage.set(key, value),
    setStatus: () => {}, navigator: { onLine: true }, console });
  vm.runInContext(extract('function queueRemoteReplace(', 'function flushDebouncedSync('), context);
  const pending = context.queueRemoteReplace([]); await tick();
  context.desiredProjection = JSON.stringify([{ id: 'product', qty: 1 }]);
  release(); await pending;
  assert.equal(storage.get('dirty-qa'), '1');
  assert.equal(context.pendingRemoteWrite, true);
});

for (const local of [[], [{ id: 'product', lineId: 'product', qty: 1 }]]) {
  test(`reload preserves unsynced ${local.length ? 'quantity decrease' : 'removal'} against older remote state`, async () => {
    let prepared, committed;
    const remote = [{ id: 'product', lineId: 'product', qty: 2, _remoteDocId: 'product' }];
    const context = vm.createContext({ currentUser: { uid: 'qa' }, authGeneration: 1, activeCartKey: 'cart',
      dirtyKey: () => 'dirty', migratedKey: () => 'migrated', rawString: () => '1', rawGet: () => local,
      normalizeCart: items => items, remoteItemFromSnapshot: item => item,
      mergeMax: () => remote, enrichRemote: () => remote, addGuestQuantities: items => items,
      guestAtLogin: [], writeLocal: items => { prepared = items; }, projection: JSON.stringify,
      queueRemoteReplace: items => { committed = items; }, setStatus: () => {}, navigator: { onLine: true },
      readyResolve: () => {}, rawStringSet: () => {}, rawSet: () => {}, rawRemove: () => {} });
    vm.runInContext(extract('async function handleInitialRemote(', 'function handleLaterRemote('), context);
    await context.handleInitialRemote({ docs: remote }, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(prepared)), local);
    assert.deepEqual(JSON.parse(JSON.stringify(committed)), local);
  });
}
