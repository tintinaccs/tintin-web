import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  drainEngagementSheetSyncQueueScheduled,
  getEngagementSheetSyncQueueStatus,
  queueEngagementSheetSync,
  supersedeQueuedEngagementEvents,
  syncEngagementEventOrQueue,
} from '../../cloudflare/resiliencia-sync-participacion.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const QUEUE_COLLECTION = 'engagementSheetSyncQueue';
const META_PATH = 'syncMeta/engagementSheetSyncQueue';
const ENV = { SHEETS_ENGAGEMENT_SECRET: 'secreto-de-prueba' };
const MINUTE = 60 * 1000;

/**
 * Firestore Admin en memoria con la semántica de firebase-admin-ligero.js:
 * precondición currentDocument.updateTime, merge parcial por mergeFields y
 * writeResults[].updateTime en la respuesta del commit.
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
    const writeResults = [];
    for (const write of writes) {
      clock += 1;
      if (write.delete) {
        store.delete(write.path);
        writeResults.push({});
        continue;
      }
      const existing = store.get(write.path);
      const fields = Array.isArray(write.mergeFields) && write.mergeFields.length
        ? { ...(existing?.fields || {}), ...Object.fromEntries(write.mergeFields.map(key => [key, write.fields[key]])) }
        : (write.fields || {});
      store.set(write.path, { fields, updateTime: `t${clock}` });
      writeResults.push({ updateTime: `t${clock}` });
    }
    return { writeResults };
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

  function queueEntries() {
    return [...store.keys()]
      .filter(path => path.startsWith(`${QUEUE_COLLECTION}/`))
      .map(path => ({ path, ...readDecoded(path) }));
  }

  return { store, put, readDecoded, queueEntries, firestoreAdminGet, firestoreAdminListAll, firestoreAdminCommit, firestoreAdminMerge };
}

function makeDeps(fetchImpl) {
  const fs = makeFakeFirestore();
  const notifications = [];
  const deps = {
    firestoreAdminGet: fs.firestoreAdminGet,
    firestoreAdminCommit: fs.firestoreAdminCommit,
    firestoreAdminListAll: fs.firestoreAdminListAll,
    firestoreAdminMerge: fs.firestoreAdminMerge,
    notifyAdminIfAbsent: async (env, event, dedupeKey) => { notifications.push({ event, dedupeKey }); },
    fetchImpl,
  };
  return { fs, deps, notifications };
}

function successFetch(bodies = []) {
  return async (url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

function failingFetch(counter = { calls: 0 }, message = 'Acción no permitida') {
  return async () => {
    counter.calls += 1;
    return { ok: true, status: 200, json: async () => ({ ok: false, error: message }) };
  };
}

const reviewEvent = (comment = 'Muy lindo') => ({
  type: 'review',
  operation: 'upsert',
  record: { reviewId: 'r-1', productId: 'p-1', email: 'cliente@example.com', comment },
});
const likeEvent = (operation = 'upsert', likeId = 'l-1') => ({
  type: 'like',
  operation,
  record: { likeId, productId: 'p-1', uid: 'u-1' },
});

function seedQueued(fs, id, event, overrides = {}) {
  fs.put(`${QUEUE_COLLECTION}/${id}`, {
    schemaVersion: 1,
    status: 'pending',
    type: event.type,
    operation: event.operation,
    eventJson: JSON.stringify(event),
    lastError: 'falló antes',
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - MINUTE),
    claimedAt: null,
    claimedBy: '',
    createdAt: new Date(Date.now() - 30 * MINUTE),
    updatedAt: new Date(Date.now() - 30 * MINUTE),
    ...overrides,
  });
}

function rewrite(fs, entry, overrides) {
  const { path, ...fields } = entry;
  fs.put(path, { ...fields, ...overrides });
}

test('un envío exitoso no deja nada en la cola', async () => {
  const bodies = [];
  const { fs, deps } = makeDeps(successFetch(bodies));
  assert.equal(await syncEngagementEventOrQueue(ENV, reviewEvent(), deps), true);
  assert.equal(fs.queueEntries().length, 0);
  assert.equal(bodies[0].action, 'syncEngagement');
  assert.equal(bodies[0].syncSecret, ENV.SHEETS_ENGAGEMENT_SECRET);
});

test('un fallo de Sheets encola el evento sin guardar el secreto', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  assert.equal(await syncEngagementEventOrQueue(ENV, reviewEvent(), deps), false);
  const [item] = fs.queueEntries();
  assert.ok(item, 'el evento debe quedar en la cola');
  assert.match(item.path, /^engagementSheetSyncQueue\/review_[0-9a-f]{40}$/);
  assert.equal(item.status, 'pending');
  assert.equal(item.attempts, 0);
  assert.equal(item.lastError, 'Acción no permitida');
  assert.deepEqual(JSON.parse(item.eventJson), reviewEvent());
  assert.doesNotMatch(JSON.stringify(fs.store.get(item.path)), /secreto-de-prueba|syncSecret/);
});

test('sin secreto configurado el evento se encola en lugar de perderse', async () => {
  const counter = { calls: 0 };
  const { fs, deps } = makeDeps(failingFetch(counter));
  assert.equal(await syncEngagementEventOrQueue({}, likeEvent(), deps), false);
  assert.equal(counter.calls, 0);
  assert.equal(fs.queueEntries().length, 1);
});

test('fallos repetidos del mismo registro dejan una sola tarea con la última versión', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  await syncEngagementEventOrQueue(ENV, likeEvent('upsert'), deps);
  await syncEngagementEventOrQueue(ENV, likeEvent('trash'), deps);
  const entries = fs.queueEntries();
  assert.equal(entries.length, 1);
  assert.equal(JSON.parse(entries[0].eventJson).operation, 'trash');
  await syncEngagementEventOrQueue(ENV, likeEvent('upsert', 'l-2'), deps);
  assert.equal(fs.queueEntries().length, 2);
});

test('eventos inválidos o sin ID no se encolan', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  assert.equal(await syncEngagementEventOrQueue(ENV, null, deps), false);
  assert.equal(await syncEngagementEventOrQueue(ENV, { type: 'otro', record: { id: 'x' } }, deps), false);
  assert.equal(await syncEngagementEventOrQueue(ENV, { type: 'review', operation: 'upsert', record: { comment: 'sin id' } }, deps), false);
  assert.equal(await queueEngagementSheetSync(ENV, { type: 'like', record: {} }, new Error('x'), deps), '');
  assert.equal(fs.queueEntries().length, 0);
});

test('un envío exitoso descarta la instantánea encolada antes y conserva una más nueva', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  await syncEngagementEventOrQueue(ENV, likeEvent('upsert'), deps);
  const [older] = fs.queueEntries();
  rewrite(fs, older, { createdAt: new Date(Date.now() - 10 * MINUTE) });

  deps.fetchImpl = successFetch();
  await syncEngagementEventOrQueue(ENV, likeEvent('trash'), deps);
  assert.equal(fs.queueEntries().length, 0, 'la instantánea vieja no debe reenviarse después');

  deps.fetchImpl = failingFetch();
  await syncEngagementEventOrQueue(ENV, likeEvent('upsert'), deps);
  const [newer] = fs.queueEntries();
  rewrite(fs, newer, { createdAt: new Date(Date.now() + 10 * MINUTE) });
  deps.fetchImpl = successFetch();
  await syncEngagementEventOrQueue(ENV, likeEvent('trash'), deps);
  assert.equal(fs.queueEntries().length, 1, 'una instantánea encolada durante el envío se conserva');
});

test('el drenaje reenvía la tarea y la borra', async () => {
  const bodies = [];
  const { fs, deps } = makeDeps(successFetch(bodies));
  seedQueued(fs, 'review_a', reviewEvent());
  const result = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.deepEqual(result, { checked: 1, drained: 1, deadLettered: 0, remaining: 0 });
  assert.equal(fs.queueEntries().length, 0);
  assert.deepEqual(bodies[0].event, reviewEvent());
  assert.equal(bodies[0].syncSecret, ENV.SHEETS_ENGAGEMENT_SECRET);
  const meta = fs.readDecoded(META_PATH);
  assert.ok(meta.lastSuccessAt);
  assert.equal(meta.lastDrained, 1);
});

test('un fallo aplica backoff, libera el reclamo y corta la corrida', async () => {
  const counter = { calls: 0 };
  const { fs, deps } = makeDeps(failingFetch(counter, 'Sheets caído'));
  seedQueued(fs, 'review_a', reviewEvent(), { createdAt: new Date(Date.now() - 60 * MINUTE) });
  seedQueued(fs, 'like_b', likeEvent());
  const before = Date.now();
  const result = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(counter.calls, 1, 'no debe insistir con el resto si Sheets no responde');
  assert.deepEqual(result, { checked: 1, drained: 0, deadLettered: 0, remaining: 2 });
  const failed = fs.readDecoded(`${QUEUE_COLLECTION}/review_a`);
  assert.equal(failed.status, 'pending');
  assert.equal(failed.attempts, 1);
  assert.equal(failed.lastError, 'Sheets caído');
  assert.equal(failed.claimedAt, null);
  assert.ok(Date.parse(failed.nextAttemptAt) >= before + 5 * MINUTE);
  assert.equal(fs.readDecoded(`${QUEUE_COLLECTION}/like_b`).attempts, 0);
  assert.equal(fs.readDecoded(META_PATH).lastError, 'Sheets caído');
});

test('tras 8 intentos pasa a dead_letter, avisa una vez por día y se sigue reintentando', async () => {
  const { fs, deps, notifications } = makeDeps(failingFetch());
  seedQueued(fs, 'review_a', reviewEvent(), { attempts: 7 });
  const before = Date.now();
  const first = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(first.deadLettered, 1);
  const blocked = fs.readDecoded(`${QUEUE_COLLECTION}/review_a`);
  assert.equal(blocked.status, 'dead_letter');
  assert.equal(blocked.attempts, 8);
  assert.ok(Date.parse(blocked.nextAttemptAt) >= before + 6 * 60 * MINUTE);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].dedupeKey, `engagement-sheet-sync-dead-letter:${new Date().toISOString().slice(0, 10)}`);
  assert.equal(notifications[0].event.targetUrl, '/admin.html#section-diagnostico');
  assert.doesNotMatch(JSON.stringify(notifications[0].event), /cliente@example\.com/);

  // Antes del intervalo largo no se reintenta.
  const idle = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(idle.checked, 0);

  // Vencido el intervalo, un nuevo fallo no repite el aviso.
  fs.put(`${QUEUE_COLLECTION}/review_a`, { ...blocked, nextAttemptAt: new Date(Date.now() - MINUTE) });
  const again = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(again.checked, 1);
  assert.equal(again.deadLettered, 0);
  assert.equal(notifications.length, 1);

  // Cuando Sheets vuelve, la tarea bloqueada se entrega y desaparece.
  fs.put(`${QUEUE_COLLECTION}/review_a`, { ...fs.readDecoded(`${QUEUE_COLLECTION}/review_a`), nextAttemptAt: new Date(Date.now() - MINUTE) });
  deps.fetchImpl = successFetch();
  const recovered = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(recovered.drained, 1);
  assert.equal(fs.queueEntries().length, 0);
});

test('una instantánea que llega durante el drenaje no se borra ni se pisa', async () => {
  const bodies = [];
  const { fs, deps } = makeDeps(null);
  let newerId = '';
  deps.fetchImpl = async (url, options) => {
    newerId = await queueEngagementSheetSync(ENV, likeEvent('trash'), new Error('fallo en vivo'), deps);
    return successFetch(bodies)(url, options);
  };
  await queueEngagementSheetSync(ENV, likeEvent('upsert'), new Error('fallo inicial'), deps);
  const [queued] = fs.queueEntries();
  rewrite(fs, queued, { createdAt: new Date(Date.now() - MINUTE) });

  const success = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(success.drained, 0);
  assert.equal(queued.path, `${QUEUE_COLLECTION}/${newerId}`);
  assert.equal(JSON.parse(fs.readDecoded(queued.path).eventJson).operation, 'trash');

  deps.fetchImpl = async () => {
    await queueEngagementSheetSync(ENV, likeEvent('upsert'), new Error('fallo en vivo'), deps);
    return failingFetch()();
  };
  await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  const kept = fs.readDecoded(queued.path);
  assert.equal(JSON.parse(kept.eventJson).operation, 'upsert');
  assert.equal(kept.attempts, 0, 'el fallo del drenaje no debe pisar la instantánea nueva');
});

test('un reclamo vigente se respeta y uno vencido se retoma', async () => {
  const { fs, deps } = makeDeps(successFetch());
  seedQueued(fs, 'review_a', reviewEvent(), { claimedAt: new Date(), claimedBy: 'otra-corrida' });
  assert.equal((await drainEngagementSheetSyncQueueScheduled(ENV, { deps })).checked, 0);
  seedQueued(fs, 'review_a', reviewEvent(), { claimedAt: new Date(Date.now() - 11 * MINUTE), claimedBy: 'otra-corrida' });
  assert.equal((await drainEngagementSheetSyncQueueScheduled(ENV, { deps })).drained, 1);
});

test('un evento guardado ilegible cuenta como intento fallido sin romper la corrida', async () => {
  const counter = { calls: 0 };
  const { fs, deps } = makeDeps(failingFetch(counter));
  seedQueued(fs, 'review_a', reviewEvent(), { eventJson: '{roto' });
  const result = await drainEngagementSheetSyncQueueScheduled(ENV, { deps });
  assert.equal(result.checked, 1);
  assert.equal(counter.calls, 0);
  const item = fs.readDecoded(`${QUEUE_COLLECTION}/review_a`);
  assert.equal(item.attempts, 1);
  assert.equal(item.lastError, 'Evento guardado ilegible.');
});

test('el estado de la cola informa pendientes, bloqueadas y antigüedad', async () => {
  const { fs, deps } = makeDeps(successFetch());
  assert.deepEqual(await getEngagementSheetSyncQueueStatus(ENV, deps), {
    pendingCount: 0,
    deadLetterCount: 0,
    oldestPendingAgeMs: null,
    lastRunAt: '',
    lastSuccessAt: '',
    lastError: '',
  });
  seedQueued(fs, 'review_a', reviewEvent(), { createdAt: new Date(Date.now() - 90 * MINUTE) });
  seedQueued(fs, 'like_b', likeEvent(), { status: 'dead_letter', createdAt: new Date(Date.now() - 3 * 60 * MINUTE) });
  const status = await getEngagementSheetSyncQueueStatus(ENV, deps);
  assert.equal(status.pendingCount, 1);
  assert.equal(status.deadLetterCount, 1);
  assert.ok(status.oldestPendingAgeMs >= 3 * 60 * MINUTE);
});

test('una purga confirmada descarta las instantáneas viejas de esos registros', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  await syncEngagementEventOrQueue(ENV, reviewEvent(), deps);
  await syncEngagementEventOrQueue(ENV, likeEvent('upsert', 'l-otro'), deps);
  const tombstones = [
    { type: 'review', operation: 'upsert', record: { reviewId: 'r-1', deleted: true, email: '' } },
    { type: 'like', operation: 'delete', record: { likeId: 'l-sin-cola' } },
  ];
  assert.equal(await supersedeQueuedEngagementEvents(ENV, tombstones, { delivered: true }, deps), 1);
  const entries = fs.queueEntries();
  assert.equal(entries.length, 1, 'solo queda el registro ajeno a la purga');
  assert.equal(JSON.parse(entries[0].eventJson).record.likeId, 'l-otro');
});

test('una purga no confirmada reemplaza la instantánea vieja por el tombstone', async () => {
  const { fs, deps } = makeDeps(failingFetch());
  await syncEngagementEventOrQueue(ENV, reviewEvent(), deps);
  const [before] = fs.queueEntries();
  rewrite(fs, before, { status: 'dead_letter', attempts: 8 });
  const tombstone = { type: 'review', operation: 'upsert', record: { reviewId: 'r-1', deleted: true, email: '' } };
  const likeTombstone = { type: 'like', operation: 'delete', record: { likeId: 'l-sin-cola' } };
  assert.equal(await supersedeQueuedEngagementEvents(ENV, [tombstone, likeTombstone], { delivered: false }, deps), 1);
  const entries = fs.queueEntries();
  assert.equal(entries.length, 1, 'no agrega a la cola registros que no estaban');
  assert.equal(entries[0].status, 'pending');
  assert.equal(entries[0].attempts, 0);
  assert.deepEqual(JSON.parse(entries[0].eventJson), tombstone);
  assert.doesNotMatch(entries[0].eventJson, /cliente@example\.com/);
});

test('con la cola vacía la reconciliación de una purga solo lee', async () => {
  const { deps } = makeDeps(failingFetch());
  let commits = 0;
  const commit = deps.firestoreAdminCommit;
  deps.firestoreAdminCommit = async (...args) => { commits += 1; return commit(...args); };
  assert.equal(await supersedeQueuedEngagementEvents(ENV, [likeEvent('delete')], { delivered: false }, deps), 0);
  assert.equal(commits, 0);
});

test('el camino en vivo y el drenaje programado usan la cola', () => {
  const live = readFileSync(new URL('../../cloudflare/sincronizacion-participacion-sheets.js', import.meta.url), 'utf8');
  const drain = readFileSync(new URL('../../functions/api/catalog-sheet-sync-drain.js', import.meta.url), 'utf8');
  const health = readFileSync(new URL('../../cloudflare/system-health.js', import.meta.url), 'utf8');
  assert.match(live, /return syncEngagementEventOrQueue\(env, event\)/);
  assert.match(live, /supersedeQueuedEngagementEvents\(env, batch, \{ delivered: ok \}\)/);
  assert.match(drain, /await drainEngagementSheetSyncQueueScheduled\(env,/);
  assert.match(health, /engagementSheetQueue/);
});
