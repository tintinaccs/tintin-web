import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drainCatalogSheetSyncQueueScheduled,
  getCatalogSheetSyncQueueStatus,
} from '../../cloudflare/resiliencia-sync-catalogo.js';
import { encodeFirestoreFields, decodeFirestoreFields, fsTimestamp } from '../../cloudflare/firebase-admin-ligero.js';

const QUEUE_COLLECTION = 'catalogSheetSyncQueue';
const MAX_QUEUE_ATTEMPTS = 8;

/**
 * Firestore Admin en memoria, con la misma semántica de bloqueo optimista
 * (currentDocument.updateTime) y merge parcial (mergeFields) que
 * cloudflare/firebase-admin-ligero.js. El pequeño delay en listAll fuerza un
 * cruce de tareas real entre corridas concurrentes, igual que ocurriría con
 * dos invocaciones del worker programado superpuestas contra la red real.
 */
function makeFakeFirestore() {
  const store = new Map();
  let clock = 0;

  function put(path, plainFields) {
    clock += 1;
    store.set(path, { fields: encodeFirestoreFields(plainFields), updateTime: `t${clock}` });
  }

  async function firestoreAdminGet(env, path) {
    const doc = store.get(path);
    return doc ? { name: path, fields: doc.fields, updateTime: doc.updateTime } : null;
  }

  async function firestoreAdminListAll(env, collectionPath) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const prefix = `${collectionPath}/`;
    return [...store.entries()]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, doc]) => ({ name: path, fields: doc.fields, updateTime: doc.updateTime }));
  }

  async function firestoreAdminCommit(env, writes) {
    for (const write of writes) {
      if (write.currentDocument && 'updateTime' in write.currentDocument) {
        const existing = store.get(write.path);
        if ((existing?.updateTime || null) !== write.currentDocument.updateTime) {
          throw Object.assign(new Error('Conflicto de versión en Firestore.'), { status: 409, code: 'version_conflict' });
        }
      }
    }
    for (const write of writes) {
      clock += 1;
      if (write.delete) {
        store.delete(write.path);
        continue;
      }
      const existing = store.get(write.path);
      if (Array.isArray(write.mergeFields) && write.mergeFields.length) {
        const fields = { ...(existing?.fields || {}) };
        for (const key of write.mergeFields) fields[key] = write.fields[key];
        store.set(write.path, { fields, updateTime: `t${clock}` });
      } else {
        store.set(write.path, { fields: write.fields || {}, updateTime: `t${clock}` });
      }
    }
    return {};
  }

  async function firestoreAdminMerge(env, path, fields) {
    clock += 1;
    const existing = store.get(path);
    store.set(path, { fields: { ...(existing?.fields || {}), ...fields }, updateTime: `t${clock}` });
    return {};
  }

  function readDecoded(path) {
    const doc = store.get(path);
    return doc ? decodeFirestoreFields(doc.fields) : null;
  }

  return { store, put, readDecoded, firestoreAdminGet, firestoreAdminListAll, firestoreAdminCommit, firestoreAdminMerge };
}

function makeFakeNotify() {
  const calls = [];
  async function notifyAdminIfAbsent(env, event, dedupeKey) {
    calls.push(dedupeKey);
  }
  return { notifyAdminIfAbsent, calls };
}

function makeSuccessFetch() {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({ ok: true, sheetName: 'Productos', synced: 1 }) };
  };
  return { fetchImpl, callCount: () => calls };
}

function makeFailingFetch(message = 'La operación superó el tiempo de espera') {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error(message);
  };
  return { fetchImpl, callCount: () => calls };
}

function seedPendingItem(fs, id, overrides = {}) {
  fs.put(`${QUEUE_COLLECTION}/${id}`, {
    schemaVersion: 2,
    status: 'pending',
    productIds: ['p1'],
    lastError: '',
    actorEmail: '',
    attempts: 0,
    nextAttemptAt: new Date(),
    claimedAt: null,
    claimedBy: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  fs.put('products/p1', { name: 'Producto de prueba' });
  fs.put('productInventory/p1', { stock: 5 });
}

function buildDeps(fs, fetchImpl, notify) {
  return {
    firestoreAdminGet: fs.firestoreAdminGet,
    firestoreAdminCommit: fs.firestoreAdminCommit,
    firestoreAdminListAll: fs.firestoreAdminListAll,
    firestoreAdminMerge: fs.firestoreAdminMerge,
    notifyAdminIfAbsent: notify.notifyAdminIfAbsent,
    fetchImpl,
  };
}

const env = { SHEETS_ENGAGEMENT_SECRET: 'secreto-de-prueba' };

test('duplicados: dos corridas concurrentes del worker no procesan la misma tarea dos veces', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const fetch1 = makeSuccessFetch();
  seedPendingItem(fs, 'dup1');
  const deps = buildDeps(fs, fetch1.fetchImpl, notify);

  const [r1, r2] = await Promise.all([
    drainCatalogSheetSyncQueueScheduled(env, { deps }),
    drainCatalogSheetSyncQueueScheduled(env, { deps }),
  ]);

  assert.equal(r1.drained + r2.drained, 1, 'la tarea debe drenarse exactamente una vez entre ambas corridas');
  assert.equal(fetch1.callCount(), 1, 'Apps Script solo debe recibir una sincronización, sin duplicados');
  assert.equal(fs.store.has(`${QUEUE_COLLECTION}/dup1`), false, 'la tarea completada se elimina de la cola');
});

test('timeout: un fallo de Apps Script reintenta con backoff sin reprocesar de inmediato', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const failing = makeFailingFetch();
  seedPendingItem(fs, 'timeout1');
  const deps = buildDeps(fs, failing.fetchImpl, notify);

  const first = await drainCatalogSheetSyncQueueScheduled(env, { deps });
  assert.equal(first.checked, 1);
  assert.equal(first.drained, 0);
  assert.equal(first.deadLettered, 0);

  const afterFirst = fs.readDecoded(`${QUEUE_COLLECTION}/timeout1`);
  assert.equal(afterFirst.status, 'pending');
  assert.equal(afterFirst.attempts, 1);
  assert.equal(afterFirst.claimedBy, '', 'la tarea se libera tras el fallo (releaseClaim)');
  assert.ok(Date.parse(afterFirst.nextAttemptAt) > Date.now(), 'el próximo intento queda diferido por backoff');

  const second = await drainCatalogSheetSyncQueueScheduled(env, { deps });
  assert.equal(second.checked, 0, 'no reintenta antes de que venza el backoff');
  assert.equal(failing.callCount(), 2, 'syncProductsPayloadWithRetry ya reintentó 2 veces dentro del propio drenaje');
});

test('recuperación: agotar los reintentos pasa a dead-letter, alerta una vez y deja de reprocesarse', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const failing = makeFailingFetch();
  seedPendingItem(fs, 'deadletter1', { attempts: MAX_QUEUE_ATTEMPTS - 1, nextAttemptAt: new Date() });
  const deps = buildDeps(fs, failing.fetchImpl, notify);

  const result = await drainCatalogSheetSyncQueueScheduled(env, { deps });
  assert.equal(result.deadLettered, 1);

  const item = fs.readDecoded(`${QUEUE_COLLECTION}/deadletter1`);
  assert.equal(item.status, 'dead_letter');
  assert.equal(item.attempts, MAX_QUEUE_ATTEMPTS);
  assert.deepEqual(notify.calls, ['catalog-sheet-sync-dead-letter:deadletter1'], 'la alerta se dispara exactamente una vez');

  const again = await drainCatalogSheetSyncQueueScheduled(env, { deps });
  assert.equal(again.checked, 0, 'una tarea en dead-letter no vuelve a quedar elegible para el drenaje');
  assert.equal(failing.callCount(), 2, 'no se reintenta contra Apps Script tras el dead-letter');
});

test('diagnóstico: getCatalogSheetSyncQueueStatus reporta pendientes, dead-letter, edad y último éxito', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const olderCreatedAt = new Date(Date.now() - 60 * 60 * 1000);
  seedPendingItem(fs, 'older', { createdAt: olderCreatedAt, nextAttemptAt: olderCreatedAt });
  seedPendingItem(fs, 'newer');
  seedPendingItem(fs, 'stuck', { status: 'dead_letter', attempts: MAX_QUEUE_ATTEMPTS });
  const lastSuccessAt = new Date();
  await fs.firestoreAdminMerge(env, 'syncMeta/catalogSheetSyncQueue', { lastSuccessAt: fsTimestamp(lastSuccessAt) });
  const deps = buildDeps(fs, makeSuccessFetch().fetchImpl, notify);

  const status = await getCatalogSheetSyncQueueStatus(env, deps);

  assert.equal(status.pendingCount, 2);
  assert.equal(status.deadLetterCount, 1);
  assert.ok(status.oldestPendingAgeMs >= 59 * 60 * 1000, 'toma la tarea pendiente más antigua, no la más reciente');
  assert.equal(status.lastSuccessAt, lastSuccessAt.toISOString());
});
