// El acuse de sincronización con Sheets sólo puede salir de una operación
// real que terminó: una edición de la hoja que Firestore confirmó, o un
// registro que Apps Script aceptó. Estas pruebas ejecutan el código real del
// webhook y de los envíos, con Firestore y Apps Script reemplazados por dobles.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  SHEETS_EVIDENCE_PATH,
  getSheetsFlowEvidence,
  recordSheetsEvidence,
} from '../../cloudflare/evidencia-sync-sheets.js';
import { decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';
import { drainEngagementSheetSyncQueueScheduled, syncEngagementEventOrQueue } from '../../cloudflare/resiliencia-sync-participacion.js';
import { runSystemHealth } from '../../cloudflare/system-health.js';
import { ADMIN_RUNTIME_CHECK_IDS } from '../../cloudflare/admin-runtime-health.js';
import { onRequestPost, PRODUCTS_WEBHOOK_REVISION } from '../../functions/api/sheets-products-webhook.js';

const SECRET = 'test-only-shared-secret';

function memoryDocument() {
  const merges = [];
  let fields = null;
  let version = 0;
  return {
    merges,
    firestoreAdminCommit: async (_env, writes) => {
      const write = writes[0];
      if ((write.currentDocument.exists === false && fields) ||
        (write.currentDocument.updateTime && write.currentDocument.updateTime !== `v${version}`)) {
        throw Object.assign(new Error('conflict'), { code: 'version_conflict' });
      }
      merges.push({ path: write.path, keys: Object.keys(write.fields) });
      fields = { ...(fields || {}), ...write.fields };
      version += 1;
      return {};
    },
    firestoreAdminGet: async (_env, path) => (fields && path === SHEETS_EVIDENCE_PATH ? { name: path, fields: { ...fields }, updateTime: `v${version}` } : null),
    read: () => (fields ? decodeFirestoreFields(fields) : null),
  };
}

function recorder({ fail = false } = {}) {
  const calls = [];
  const record = async (_env, channel, outcome) => {
    const { startedAt, operationId, ...result } = outcome;
    assert.ok(Number.isFinite(Date.parse(startedAt)), "fecha de inicio del intento");
    assert.ok(operationId, "identidad del intento");
    calls.push({ channel, ...result, error: outcome.error ? String(outcome.error?.message || outcome.error) : '' });
    if (fail) throw new Error('acuse no disponible');
    return true;
  };
  return { calls, record };
}

test('un éxito guarda fecha, tipo y revisión; un fallo posterior no borra el último éxito', async () => {
  const doc = memoryDocument();
  assert.equal(await recordSheetsEvidence({}, 'inbound', { ok: true, kind: 'saveProduct', revision: 'rev-1' }, doc), true);
  assert.equal(await recordSheetsEvidence({}, 'inbound', { ok: false, kind: 'saveProduct', error: new Error('Firestore COMMIT falló (502).') }, doc), true);
  assert.equal(await recordSheetsEvidence({}, 'mirror', { ok: true, kind: 'order' }, doc), true);

  assert.deepEqual(doc.merges.map(item => item.path), [SHEETS_EVIDENCE_PATH, SHEETS_EVIDENCE_PATH, SHEETS_EVIDENCE_PATH]);
  assert.deepEqual(doc.merges[0].keys.filter(key => /LastSuccess|Revision$/.test(key) && !key.endsWith('DeploymentRevision')), ['inboundLastSuccessAt', 'inboundLastSuccessKind', 'inboundRevision']);
  assert.deepEqual(doc.merges[1].keys.filter(key => /LastError/.test(key)), ['inboundLastErrorAt', 'inboundLastErrorKind', 'inboundLastError']);

  const evidence = await getSheetsFlowEvidence({}, doc);
  assert.equal(evidence.available, true);
  assert.equal(evidence.inbound.lastSuccessKind, 'saveProduct');
  assert.equal(evidence.inbound.revision, 'rev-1');
  assert.ok(Number.isFinite(Date.parse(evidence.inbound.lastSuccessAt)));
  assert.equal(evidence.inbound.lastError, 'upstream_http_502');
  assert.ok(Number.isFinite(Date.parse(evidence.inbound.lastErrorAt)));
  assert.equal(evidence.mirror.lastSuccessKind, 'order');
  assert.equal(evidence.mirror.lastErrorAt, '');
});

test('el acuse nunca lanza y no acepta canales desconocidos', async () => {
  const doc = memoryDocument();
  assert.equal(await recordSheetsEvidence({}, 'otro-canal', { ok: true }, doc), false);
  assert.equal(doc.merges.length, 0);
  const broken = { firestoreAdminGet: async () => null, firestoreAdminCommit: async () => { throw new Error('Firestore PATCH falló (503)'); } };
  assert.equal(await recordSheetsEvidence({}, 'mirror', { ok: true, kind: 'order' }, broken), false);
  // Sin credenciales (entorno de pruebas) tampoco lanza ni sale a la red.
  assert.equal(await recordSheetsEvidence({}, 'mirror', { ok: true, kind: 'order' }), false);
});

test('sin documento no hay evidencia; un fallo de lectura se informa como no disponible', async () => {
  const empty = await getSheetsFlowEvidence({}, memoryDocument());
  assert.equal(empty.available, true);
  assert.equal(empty.inbound.lastSuccessAt, '');
  assert.equal(empty.mirror.lastSuccessAt, '');
  const unreadable = await getSheetsFlowEvidence({}, { firestoreAdminGet: async () => { throw new Error('Firestore GET falló (500)'); } });
  assert.equal(unreadable.available, false);
});

// ---------- Webhook de productos (Sheets → Firestore) ----------

function webhookRequest(body, secret) {
  return new Request('https://tintinaccesorios.pages.dev/api/sheets-products-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'X-Tintin-Sheets-Secret': secret } : {}) },
    body: JSON.stringify(body),
  });
}

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const WEBHOOK_ENV = {
  SHEETS_ENGAGEMENT_SECRET: SECRET,
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'test-project',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    private_key: privateKey,
  }),
};

async function withFirestore(commitStatus, run) {
  const commits = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-only-access-token', expires_in: 3600 }), { status: 200 });
    }
    if (url.endsWith('/documents:commit')) {
      commits.push(JSON.parse(init.body));
      return new Response('{}', { status: commitStatus });
    }
    throw new Error(`Unexpected network request: ${url}`);
  };
  try {
    return await run(commits);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const PRODUCT = { action: 'saveProduct', productId: 'PROD-1', name: 'Aros', category: 'aros', price: 50000, stock: 3, active: true };

test('una edición real de la hoja deja el acuse sólo después de que Firestore confirmó el commit', async () => {
  await withFirestore(200, async commits => {
    const spy = recorder();
    const order = [];
    const record = async (...args) => { order.push(`acuse:${commits.length}`); return spy.record(...args); };
    const response = await onRequestPost({ request: webhookRequest(PRODUCT, SECRET), env: WEBHOOK_ENV }, record);
    assert.equal(response.status, 200);
    assert.equal(commits.length, 1);
    assert.deepEqual(order, ['acuse:1'], 'el acuse se anota con el commit ya hecho');
    assert.deepEqual(spy.calls, [{ channel: 'inbound', ok: true, kind: 'saveProduct', revision: PRODUCTS_WEBHOOK_REVISION, error: '' }]);

    const removal = recorder();
    const deleted = await onRequestPost({ request: webhookRequest({ action: 'deleteProduct', productId: 'PROD-1' }, SECRET), env: WEBHOOK_ENV }, removal.record);
    assert.equal(deleted.status, 200);
    assert.deepEqual(removal.calls.map(call => [call.ok, call.kind]), [[true, 'deleteProduct']]);
  });
});

test('una petición rechazada, de diagnóstico o con datos inválidos no deja acuse', async () => {
  await withFirestore(200, async commits => {
    const spy = recorder();
    const run = (body, secret) => onRequestPost({ request: webhookRequest(body, secret), env: WEBHOOK_ENV }, spy.record);
    assert.equal((await run(PRODUCT, '')).status, 401);
    assert.equal((await run(PRODUCT, 'secreto-incorrecto')).status, 401);
    assert.equal((await run({ action: 'diagnose' }, SECRET)).status, 200);
    assert.equal((await run({ ...PRODUCT, name: '' }, SECRET)).status, 400);
    assert.equal((await run({ action: 'otraAccion', productId: 'PROD-1' }, SECRET)).status, 400);
    assert.equal(commits.length, 0);
    assert.deepEqual(spy.calls, []);
  });
});

test('si Firestore rechaza el commit queda anotado el fallo, nunca un éxito', async () => {
  await withFirestore(500, async commits => {
    const spy = recorder();
    const response = await onRequestPost({ request: webhookRequest(PRODUCT, SECRET), env: WEBHOOK_ENV }, spy.record);
    assert.equal(response.status, 502);
    assert.equal(commits.length, 1);
    assert.equal(spy.calls.length, 1);
    assert.equal(spy.calls[0].ok, false);
    assert.equal(spy.calls[0].kind, 'saveProduct');
    assert.match(spy.calls[0].error, /Firestore COMMIT falló \(500\)/);
  });
});

test('un acuse que falla no cambia la respuesta del webhook, y con waitUntil no la demora', async () => {
  await withFirestore(200, async () => {
    const broken = recorder({ fail: true });
    const response = await onRequestPost({ request: webhookRequest(PRODUCT, SECRET), env: WEBHOOK_ENV }, broken.record);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);

    const deferred = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const slow = async () => { await gate; return true; };
    const background = await onRequestPost({
      request: webhookRequest(PRODUCT, SECRET), env: WEBHOOK_ENV, waitUntil: promise => deferred.push(promise),
    }, slow);
    assert.equal(background.status, 200, 'responde sin esperar el acuse');
    assert.equal(deferred.length, 1);
    release();
    assert.equal(await deferred[0], true);
  });
});

// ---------- Espejo de pedidos y participación (Firestore → Sheets) ----------

const ORDER = { orderId: 'manual_test_123', order: { orderNumber: 'TINPED99', total: 120000, items: [] } };
const ORDER_ENV = { SHEETS_ENGAGEMENT_SECRET: SECRET };

test('un pedido deja acuse de espejo sólo cuando Apps Script confirma la fila', async () => {
  const accepted = recorder();
  const ok = await syncOrderToSheetsBestEffort(ORDER_ENV, ORDER, async () => ({ ok: true, status: 200, json: async () => ({ ok: true, row: 8 }) }), accepted.record);
  assert.equal(ok.ok, true);
  assert.deepEqual(accepted.calls, [{ channel: 'mirror', ok: true, kind: 'order', error: '' }]);

  const rejected = recorder();
  const refused = await syncOrderToSheetsBestEffort(ORDER_ENV, ORDER, async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: 'No autorizado' }) }), rejected.record);
  assert.equal(refused.ok, false);
  assert.deepEqual(rejected.calls.map(call => [call.channel, call.ok, call.error]), [['mirror', false, 'No autorizado']]);

  const down = recorder();
  const failed = await syncOrderToSheetsBestEffort(ORDER_ENV, ORDER, async () => { throw new Error('Google temporalmente no disponible'); }, down.record);
  assert.equal(failed.deferred, true);
  assert.deepEqual(down.calls.map(call => call.ok), [false]);

  const skipped = recorder();
  await syncOrderToSheetsBestEffort({}, ORDER, async () => { throw new Error('no debe ejecutarse'); }, skipped.record);
  await syncOrderToSheetsBestEffort(ORDER_ENV, { orderId: ORDER.orderId }, async () => { throw new Error('no debe ejecutarse'); }, skipped.record);
  assert.deepEqual(skipped.calls, [], 'sin intento real no hay acuse');

  const broken = recorder({ fail: true });
  const still = await syncOrderToSheetsBestEffort(ORDER_ENV, ORDER, async () => ({ ok: true, status: 200, json: async () => ({ ok: true, row: 9 }) }), broken.record);
  assert.deepEqual(still, { ok: true, deferred: false, row: 9 }, 'un acuse caído no cambia el resultado del pedido');
});

function engagementDeps(fetchImpl, record) {
  const store = new Map();
  let clock = 0;
  const view = (path, doc) => ({ name: path, fields: doc.fields, updateTime: doc.updateTime });
  return {
    store,
    firestoreAdminGet: async (_env, path) => (store.has(path) ? view(path, store.get(path)) : null),
    firestoreAdminListAll: async (_env, collection) => [...store.entries()].filter(([path]) => path.startsWith(`${collection}/`)).map(([path, doc]) => view(path, doc)),
    firestoreAdminCommit: async (_env, writes) => {
      for (const write of writes) {
        if (write.currentDocument && 'updateTime' in write.currentDocument && (store.get(write.path)?.updateTime || null) !== write.currentDocument.updateTime) {
          throw Object.assign(new Error('Conflicto de versión en Firestore.'), { status: 409, code: 'version_conflict' });
        }
      }
      const writeResults = [];
      for (const write of writes) {
        clock += 1;
        if (write.delete) { store.delete(write.path); writeResults.push({}); continue; }
        const existing = store.get(write.path);
        const fields = Array.isArray(write.mergeFields) && write.mergeFields.length
          ? { ...(existing?.fields || {}), ...Object.fromEntries(write.mergeFields.map(key => [key, write.fields[key]])) }
          : (write.fields || {});
        store.set(write.path, { fields, updateTime: `t${clock}` });
        writeResults.push({ updateTime: `t${clock}` });
      }
      return { writeResults };
    },
    firestoreAdminMerge: async () => ({}),
    notifyAdminIfAbsent: async () => {},
    fetchImpl,
    recordSheetsEvidence: record,
  };
}

const LIKE_EVENT = { type: 'like', operation: 'upsert', record: { likeId: 'like_1', productId: 'p1' } };
const sheetsOk = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const sheetsDown = async () => new Response(JSON.stringify({ ok: false, error: 'Acción no permitida' }), { status: 200 });

test('un "me gusta" real deja acuse de espejo según lo que respondió Apps Script, y el reintento lo recupera', async () => {
  const accepted = recorder();
  assert.equal(await syncEngagementEventOrQueue(ORDER_ENV, LIKE_EVENT, engagementDeps(sheetsOk, accepted.record)), true);
  assert.deepEqual(accepted.calls, [{ channel: 'mirror', ok: true, kind: 'engagement:like', error: '' }]);

  const rejected = recorder();
  const deps = engagementDeps(sheetsDown, rejected.record);
  assert.equal(await syncEngagementEventOrQueue(ORDER_ENV, LIKE_EVENT, deps), false);
  assert.deepEqual(rejected.calls.map(call => [call.ok, call.kind, call.error]), [[false, 'engagement:like', 'Acción no permitida']]);
  assert.equal([...deps.store.keys()].filter(path => path.startsWith('engagementSheetSyncQueue/')).length, 1, 'el evento queda en la cola');

  // Sheets vuelve: el drenaje programado lo entrega y el último resultado real pasa a ser un éxito.
  deps.fetchImpl = sheetsOk;
  const drained = await drainEngagementSheetSyncQueueScheduled(ORDER_ENV, { deps });
  assert.equal(drained.drained, 1);
  assert.deepEqual(rejected.calls.at(-1), { channel: 'mirror', ok: true, kind: 'engagement:like:retry', error: '' });

  // Dependencias sin acuse (pruebas anteriores) y un acuse que lanza no cambian el resultado.
  const legacy = engagementDeps(sheetsOk, undefined);
  delete legacy.recordSheetsEvidence;
  assert.equal(await syncEngagementEventOrQueue(ORDER_ENV, LIKE_EVENT, legacy), true);
  assert.equal(await syncEngagementEventOrQueue(ORDER_ENV, LIKE_EVENT, engagementDeps(sheetsOk, recorder({ fail: true }).record)), true);
});

// ---------- /api/system-health ----------

const HEALTH_ENV = {
  FIREBASE_SERVICE_ACCOUNT_KEY: '{}', RESEND_API_KEY: 'x', CLOUDINARY_CLOUD_NAME: 'x', CLOUDINARY_API_KEY: 'x',
  CLOUDINARY_API_SECRET: 'x', SHEETS_ENGAGEMENT_SECRET: 'x',
};
const healthDeps = extra => ({
  runtimeRunner: async () => ({ ok: true, checks: Object.fromEntries(ADMIN_RUNTIME_CHECK_IDS.map(id => [id, { id, ok: true, ms: 1, code: '' }])), failed: [] }),
  sheetsProbe: async () => ({ reachable: true, httpStatus: 200, protocolOk: true }),
  paypalConfigResolver: async () => ({ enabled: true, mode: 'live', missing: [] }),
  catalogSheetQueueStatus: async () => null,
  orderEmailQueueStatus: async () => null,
  engagementSheetQueueStatus: async () => null,
  checkoutInspector: async () => ({ ok: true, sampledOrders: 0, paidOrders: 0, paidWithoutEmail: 0, paidAtRiskSheets: 0, alerts: [], truncated: false }),
  ...extra,
});

test('system-health entrega el acuse leído y no lo inventa cuando no se puede leer', async () => {
  const doc = memoryDocument();
  await recordSheetsEvidence({}, 'inbound', { ok: true, kind: 'saveProduct', revision: PRODUCTS_WEBHOOK_REVISION }, doc);
  const withEvidence = await runSystemHealth(HEALTH_ENV, healthDeps({ sheetsEvidenceReader: env => getSheetsFlowEvidence(env, doc) }));
  assert.equal(withEvidence.integrations.sheetsEvidence.inbound.revision, PRODUCTS_WEBHOOK_REVISION);
  assert.equal(withEvidence.integrations.sheetsEvidence.mirror.lastSuccessAt, '');
  assert.equal(withEvidence.ok, true);

  const unavailable = await runSystemHealth(HEALTH_ENV, healthDeps({ sheetsEvidenceReader: async () => ({ available: false }) }));
  assert.equal(unavailable.integrations.sheetsEvidence, null);
  const throwing = await runSystemHealth(HEALTH_ENV, healthDeps({ sheetsEvidenceReader: async () => { throw new Error('caído'); } }));
  assert.equal(throwing.integrations.sheetsEvidence, null);
  assert.equal(throwing.ok, true, 'el acuse es informativo: no cambia el estado integral');
});


test('un reintento real fallido registra fallo; un evento ilegible no altera el acuse', async () => {
  const spy = recorder();
  const deps = engagementDeps(sheetsDown, spy.record);
  await syncEngagementEventOrQueue(ORDER_ENV, LIKE_EVENT, deps);
  await drainEngagementSheetSyncQueueScheduled(ORDER_ENV, { deps });
  assert.equal(spy.calls.at(-1).ok, false);
  assert.equal(spy.calls.at(-1).kind, 'engagement:like:retry');
  const invalid = recorder();
  assert.equal(await syncEngagementEventOrQueue(ORDER_ENV, { type: 'bad' }, engagementDeps(sheetsDown, invalid.record)), false);
  assert.equal(invalid.calls.length, 0);
});

test('la operación antigua que termina tarde no sobrescribe la más nueva', async () => {
  const doc = memoryDocument();
  const newer = { startedAt: '2026-10-06T14:00:01Z', operationId: 'B', ok: false, kind: 'order', error: 'failure' };
  const older = { startedAt: '2026-10-06T14:00:00Z', operationId: 'A', ok: true, kind: 'order' };
  assert.equal(await recordSheetsEvidence({}, 'mirror', newer, doc), true);
  assert.equal(await recordSheetsEvidence({}, 'mirror', older, doc), false);
  assert.equal(doc.read().mirrorResult, 'failed');
  assert.equal(doc.read().mirrorOperationId, 'B');
});

test('dos primeras operaciones concurrentes resuelven CAS sin perder el resultado nuevo', async () => {
  const doc = memoryDocument();
  await Promise.all([
    recordSheetsEvidence({}, 'mirror', { startedAt: '2026-10-06T14:00:00Z', operationId: 'A', ok: true }, doc),
    recordSheetsEvidence({}, 'mirror', { startedAt: '2026-10-06T14:00:01Z', operationId: 'B', ok: false }, doc),
  ]);
  assert.equal(doc.read().mirrorOperationId, 'B');
  assert.equal(doc.read().mirrorResult, 'failed');
});

test('el acuse no almacena URLs, credenciales ni datos personales del error', async () => {
  const doc = memoryDocument();
  await recordSheetsEvidence({}, 'mirror', { ok: false, error: new Error('secret=private-token email=cliente@example.com https://signed.example/?token=abc') }, doc);
  const evidence = JSON.stringify(await getSheetsFlowEvidence({}, doc));
  assert.doesNotMatch(evidence, /private-token|cliente@|signed.example|token=abc/);
  assert.equal(doc.read().mirrorLastError, 'sync_failed');
});

test('purga agrupada: registra rechazo, timeout y éxito sin inventar evidencia para lote vacío o sin secreto', async () => {
  const { syncEngagementBatchToSheets } = await import('../../cloudflare/sincronizacion-participacion-sheets.js');
  const spy = recorder();
  const deps = {
    recordSheetsEvidence: spy.record,
    supersedeQueuedEngagementEvents: async () => {},
    fetchImpl: async () => new Response(JSON.stringify({ ok: false }), { status: 200 }),
  };
  const event = { type: 'like', record: { likeId: 'test-only', deleted: true } };
  assert.equal(await syncEngagementBatchToSheets({ SHEETS_ENGAGEMENT_SECRET: SECRET }, [event], deps), false);
  deps.fetchImpl = async () => { throw new DOMException('Timeout', 'TimeoutError'); };
  assert.equal(await syncEngagementBatchToSheets({ SHEETS_ENGAGEMENT_SECRET: SECRET }, [event], deps), false);
  deps.fetchImpl = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  assert.equal(await syncEngagementBatchToSheets({ SHEETS_ENGAGEMENT_SECRET: SECRET }, [event], deps), true);
  await syncEngagementBatchToSheets({}, [event], deps);
  await syncEngagementBatchToSheets({ SHEETS_ENGAGEMENT_SECRET: SECRET }, [], deps);
  assert.deepEqual(spy.calls.map(c => [c.channel, c.ok, c.kind]), [['mirror', false, 'engagementBatch'], ['mirror', false, 'engagementBatch'], ['mirror', true, 'engagementBatch']]);
});
