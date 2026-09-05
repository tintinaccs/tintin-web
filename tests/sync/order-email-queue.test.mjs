import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drainOrderEmailQueueScheduled,
  getOrderEmailQueueStatus,
  queuePendingOrderEmail,
} from '../../cloudflare/resiliencia-correo-pedido.js';
import { encodeFirestoreFields, decodeFirestoreFields, fsTimestamp } from '../../cloudflare/firebase-admin-ligero.js';

const QUEUE_COLLECTION = 'orderEmailQueue';
const MAX_QUEUE_ATTEMPTS = 8;

/**
 * Firestore Admin en memoria, con la misma semántica de bloqueo optimista
 * (currentDocument.updateTime) y merge parcial (mergeFields) que
 * cloudflare/firebase-admin-ligero.js, siguiendo el mismo fake que
 * tests/sync/catalog-sheet-sync-queue.test.mjs.
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

function makeSuccessSend() {
  const calls = [];
  const sendOrderEmailsImpl = async (args) => {
    calls.push(args);
    return { success: true, adminSent: args.sendAdmin ? true : null, customerSent: args.sendCustomer ? true : null };
  };
  return { sendOrderEmailsImpl, calls };
}

function makeFailingSend(message = 'Resend no respondió') {
  const calls = [];
  const sendOrderEmailsImpl = async (args) => {
    calls.push(args);
    throw new Error(message);
  };
  return { sendOrderEmailsImpl, calls };
}

function buildDeps(fs, send, notify) {
  return {
    firestoreAdminGet: fs.firestoreAdminGet,
    firestoreAdminCommit: fs.firestoreAdminCommit,
    firestoreAdminListAll: fs.firestoreAdminListAll,
    firestoreAdminMerge: fs.firestoreAdminMerge,
    notifyAdminIfAbsent: notify.notifyAdminIfAbsent,
    sendOrderEmailsImpl: send.sendOrderEmailsImpl,
  };
}

function seedPendingItem(fs, id, overrides = {}) {
  fs.put(`${QUEUE_COLLECTION}/${id}`, {
    schemaVersion: 1,
    status: 'pending',
    orderId: id,
    retryAdmin: true,
    retryCustomer: true,
    lastError: '',
    attempts: 0,
    nextAttemptAt: new Date(),
    claimedAt: null,
    claimedBy: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  fs.put(`orders/${id}`, { orderId: id, total: 100 });
}

const env = { RESEND_API_KEY: 'clave-de-prueba' };

test('queuePendingOrderEmail no encola cuando ningún canal falló', async () => {
  const id = await queuePendingOrderEmail({}, { orderId: 'sin-fallos', retryAdmin: false, retryCustomer: false });
  assert.equal(id, null, 'sin canales fallidos, no debe escribir en la cola ni requerir Firestore');
});

test('duplicados: dos corridas concurrentes del worker no reenvían el mismo pedido dos veces', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const send = makeSuccessSend();
  seedPendingItem(fs, 'dup1');
  const deps = buildDeps(fs, send, notify);

  const [r1, r2] = await Promise.all([
    drainOrderEmailQueueScheduled(env, { deps }),
    drainOrderEmailQueueScheduled(env, { deps }),
  ]);

  assert.equal(r1.drained + r2.drained, 1, 'la tarea debe drenarse exactamente una vez entre ambas corridas');
  assert.equal(send.calls.length, 1, 'Resend solo debe recibir un reintento, sin duplicados');
  assert.equal(send.calls[0].isResend, false, 'reutiliza el sufijo de idempotencia del intento original');
  assert.equal(fs.store.has(`${QUEUE_COLLECTION}/dup1`), false, 'la tarea completada se elimina de la cola');
});

test('timeout: un fallo de Resend reintenta con backoff sin reprocesar de inmediato', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const failing = makeFailingSend();
  seedPendingItem(fs, 'timeout1');
  const deps = buildDeps(fs, failing, notify);

  const first = await drainOrderEmailQueueScheduled(env, { deps });
  assert.equal(first.checked, 1);
  assert.equal(first.drained, 0);
  assert.equal(first.deadLettered, 0);

  const afterFirst = fs.readDecoded(`${QUEUE_COLLECTION}/timeout1`);
  assert.equal(afterFirst.status, 'pending');
  assert.equal(afterFirst.attempts, 1);
  assert.equal(afterFirst.claimedBy, '', 'la tarea se libera tras el fallo (releaseClaim)');
  assert.ok(Date.parse(afterFirst.nextAttemptAt) > Date.now(), 'el próximo intento queda diferido por backoff');

  const second = await drainOrderEmailQueueScheduled(env, { deps });
  assert.equal(second.checked, 0, 'no reintenta antes de que venza el backoff');
  assert.equal(failing.calls.length, 1, 'no se reintenta antes de que venza el backoff');
});

test('recuperación: agotar los reintentos pasa a dead-letter, alerta una vez y deja de reprocesarse', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const failing = makeFailingSend();
  seedPendingItem(fs, 'deadletter1', { attempts: MAX_QUEUE_ATTEMPTS - 1, nextAttemptAt: new Date() });
  const deps = buildDeps(fs, failing, notify);

  const result = await drainOrderEmailQueueScheduled(env, { deps });
  assert.equal(result.deadLettered, 1);

  const item = fs.readDecoded(`${QUEUE_COLLECTION}/deadletter1`);
  assert.equal(item.status, 'dead_letter');
  assert.equal(item.attempts, MAX_QUEUE_ATTEMPTS);
  assert.deepEqual(notify.calls, ['order-email-dead-letter:deadletter1'], 'la alerta se dispara exactamente una vez');

  const again = await drainOrderEmailQueueScheduled(env, { deps });
  assert.equal(again.checked, 0, 'una tarea en dead-letter no vuelve a quedar elegible para el drenaje');
  assert.equal(failing.calls.length, 1, 'no se reintenta contra Resend tras el dead-letter');
});

test('sin RESEND_API_KEY configurada, la tarea reintenta con backoff en lugar de quedar en limbo', async () => {
  const fs = makeFakeFirestore();
  const notify = makeFakeNotify();
  const send = makeSuccessSend();
  seedPendingItem(fs, 'sinclave');
  const deps = buildDeps(fs, send, notify);

  const result = await drainOrderEmailQueueScheduled({}, { deps });
  assert.equal(result.drained, 0);
  assert.equal(send.calls.length, 0, 'nunca llama a Resend sin credenciales');
  const item = fs.readDecoded(`${QUEUE_COLLECTION}/sinclave`);
  assert.equal(item.attempts, 1);
  assert.match(item.lastError, /RESEND_API_KEY/);
});

test('diagnóstico: getOrderEmailQueueStatus reporta pendientes, dead-letter, edad y último éxito', async () => {
  const fs = makeFakeFirestore();
  const olderCreatedAt = new Date(Date.now() - 60 * 60 * 1000);
  seedPendingItem(fs, 'older', { createdAt: olderCreatedAt, nextAttemptAt: olderCreatedAt });
  seedPendingItem(fs, 'newer');
  seedPendingItem(fs, 'stuck', { status: 'dead_letter', attempts: MAX_QUEUE_ATTEMPTS });
  const lastSuccessAt = new Date();
  await fs.firestoreAdminMerge(env, 'syncMeta/orderEmailQueue', { lastSuccessAt: fsTimestamp(lastSuccessAt) });
  const deps = { firestoreAdminGet: fs.firestoreAdminGet, firestoreAdminListAll: fs.firestoreAdminListAll };

  const status = await getOrderEmailQueueStatus(env, deps);

  assert.equal(status.pendingCount, 2);
  assert.equal(status.deadLetterCount, 1);
  assert.ok(status.oldestPendingAgeMs >= 59 * 60 * 1000, 'toma la tarea pendiente más antigua, no la más reciente');
  assert.equal(status.lastSuccessAt, lastSuccessAt.toISOString());
});
