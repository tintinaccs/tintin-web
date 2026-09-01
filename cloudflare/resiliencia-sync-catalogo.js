import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminListAll,
  firestoreAdminMerge,
  fsInteger,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { notifyAdminIfAbsent } from './notificaciones-sociales.js';

const PRODUCT_SYNC_CHUNK = 100;
const MAX_ATTEMPTS = 4;
const QUEUE_COLLECTION = 'catalogSheetSyncQueue';
const MAX_PENDING = 200;
const MAX_QUEUE_ATTEMPTS = 8;
const QUEUE_BACKOFF_MS = 5 * 60 * 1000;
const CLAIM_STALE_MS = 10 * 60 * 1000;
const SYNC_META_PATH = 'syncMeta/catalogSheetSyncQueue';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 180)).filter(Boolean))];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isStale = claimedAt => {
  const at = Date.parse(claimedAt || '');
  return !Number.isFinite(at) || (Date.now() - at) > CLAIM_STALE_MS;
};

function decoded(document) {
  return document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
}

// Dependencias reales del worker programado. Se inyectan explícitamente (en
// vez de importarse directo en cada función) solo en el camino nuevo
// drainCatalogSheetSyncQueueScheduled/claimQueueItem/releaseClaim/
// transitionDeadLetter, para poder probar duplicados, timeout y recuperación
// con un Firestore/Apps Script en memoria sin tocar red real. retryPendingCatalogSheets
// (camino manual preexistente) sigue llamando los imports directamente.
const REAL_QUEUE_DEPS = {
  firestoreAdminGet,
  firestoreAdminCommit,
  firestoreAdminListAll,
  firestoreAdminMerge,
  notifyAdminIfAbsent,
  fetchImpl: fetch,
};

async function syncProductsOnce(idToken, productIds) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, batches: 0 };
  let batches = 0;
  for (let i = 0; i < ids.length; i += PRODUCT_SYNC_CHUNK) {
    const response = await fetch(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: 'syncProducts',
        sheetName: 'Productos',
        schemaVersion: 2,
        productIds: ids.slice(i, i + PRODUCT_SYNC_CHUNK),
        idToken,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      throw new Error(clean(data.error || `Sheets Productos respondió ${response.status}`));
    }
    batches += 1;
  }
  return { ok: true, batches };
}

export async function syncProductsWithRetry(idToken, productIds, { attempts = MAX_ATTEMPTS } = {}) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, attempts: 0, batches: 0 };
  let lastError = null;
  const limit = Math.max(1, Math.min(MAX_ATTEMPTS, Number(attempts) || MAX_ATTEMPTS));
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    try {
      const result = await syncProductsOnce(idToken, ids);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < limit) await sleep(250 * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error('No se pudo sincronizar Productos con Google Sheets.');
}

/**
 * Prueba no destructiva inmediatamente antes de borrar: re-sincroniza un
 * producto que todavía existe. Esto valida token, Apps Script, permisos del
 * spreadsheet y acceso a la hoja Productos antes de tocar Firestore.
 */
export async function preflightProductsSheet(idToken, productIds) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, skipped: true };
  const result = await syncProductsWithRetry(idToken, [ids[0]], { attempts: 2 });
  return { ok: true, sampleProductId: ids[0], attempts: result.attempts };
}

async function queuePendingSync(env, productIds, error, actor = null) {
  const ids = unique(productIds);
  if (!ids.length) return null;
  const id = `catalog_sync_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${id}`,
    fields: encodeFirestoreFields({
      schemaVersion: 2,
      status: 'pending',
      productIds: ids,
      lastError: clean(error?.message || error),
      actorEmail: clean(actor?.email, 254),
      attempts: 0,
      nextAttemptAt: new Date(),
      claimedAt: null,
      claimedBy: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  }]);
  return id;
}

/**
 * Cierre posterior a Firestore. Hace cuatro intentos. Si Google está caído,
 * conserva una tarea persistente de reconciliación en vez de fingir éxito.
 */
export async function finalizeProductsSheet(env, idToken, productIds, actor = null) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, attempts: 0, queued: false };
  try {
    const result = await syncProductsWithRetry(idToken, ids, { attempts: MAX_ATTEMPTS });
    return { ok: true, attempts: result.attempts, queued: false };
  } catch (error) {
    const queueId = await queuePendingSync(env, ids, error, actor);
    return { ok: false, attempts: MAX_ATTEMPTS, queued: true, queueId, error: clean(error?.message || error) };
  }
}

/**
 * Reclama una tarea de la cola con bloqueo optimista (precondición sobre
 * updateTime, el mismo primitivo que ya usa notificaciones-sociales.js para
 * evitar duplicados). Si otro proceso la reclamó primero, el commit falla
 * con version_conflict y esta función devuelve null: quien pierde la carrera
 * simplemente no reprocesa la tarea, así el drenaje programado y el reintento
 * manual del panel nunca sincronizan el mismo producto dos veces.
 */
async function claimQueueItem(env, document, deps = REAL_QUEUE_DEPS) {
  const item = decoded(document);
  if (!item || item.status === 'dead_letter') return null;
  const claimId = crypto.randomUUID();
  try {
    await deps.firestoreAdminCommit(env, [{
      path: `${QUEUE_COLLECTION}/${item.id}`,
      fields: encodeFirestoreFields({ claimedAt: new Date(), claimedBy: claimId, updatedAt: new Date() }),
      mergeFields: ['claimedAt', 'claimedBy', 'updatedAt'],
      currentDocument: { updateTime: document.updateTime },
    }]);
    return { ...item, claimedBy: claimId };
  } catch (error) {
    if (error?.code === 'version_conflict') return null;
    throw error;
  }
}

async function releaseClaim(env, item, patch = {}, deps = REAL_QUEUE_DEPS) {
  const fields = { ...patch, claimedAt: null, claimedBy: '', updatedAt: new Date() };
  await deps.firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${item.id}`,
    fields: encodeFirestoreFields(fields),
    mergeFields: Object.keys(fields),
  }]);
}

async function transitionDeadLetter(env, item, error, deps = REAL_QUEUE_DEPS) {
  const fields = {
    status: 'dead_letter',
    attempts: item.attempts,
    lastError: clean(error?.message || error),
    claimedAt: null,
    claimedBy: '',
    updatedAt: new Date(),
  };
  await deps.firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${item.id}`,
    fields: encodeFirestoreFields(fields),
    mergeFields: Object.keys(fields),
  }]);
  await deps.notifyAdminIfAbsent(env, {
    kind: 'catalog_sheet_sync_dead_letter',
    actorType: 'system',
    title: 'Cola de sincronización con Sheets bloqueada',
    body: `La tarea ${item.id} no pudo sincronizar ${item.productIds.length} producto(s) tras ${item.attempts} intentos: ${clean(error?.message || error, 200)}`,
    targetUrl: '/admin.html#section-diagnostico',
    sourceType: 'catalogSheetSyncQueue',
    sourceId: item.id,
  }, `catalog-sheet-sync-dead-letter:${item.id}`);
}

/**
 * Cada nueva operación administrativa intenta cerrar primero reconciliaciones
 * pendientes. Así una caída temporal de Google no puede quedar olvidada.
 */
export async function retryPendingCatalogSheets(env, idToken) {
  const pending = (await firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING))
    .filter(document => {
      const item = decoded(document);
      return item && item.status !== 'done' && item.status !== 'dead_letter'
        && Array.isArray(item.productIds) && item.productIds.length;
    });
  if (!pending.length) return { pending: 0, resolved: 0, remaining: 0 };

  let resolved = 0;
  const deleteWrites = [];
  for (const document of pending) {
    const claimed = await claimQueueItem(env, document);
    if (!claimed) continue;
    try {
      await syncProductsWithRetry(idToken, claimed.productIds, { attempts: 2 });
      deleteWrites.push({ path: `${QUEUE_COLLECTION}/${claimed.id}`, delete: true });
      resolved += 1;
    } catch {
      await releaseClaim(env, claimed).catch(() => {});
    }
  }
  for (let i = 0; i < deleteWrites.length; i += 20) {
    await firestoreAdminCommit(env, deleteWrites.slice(i, i + 20));
  }
  return { pending: pending.length, resolved, remaining: pending.length - resolved };
}

async function fetchProductPayloadItem(env, id, deps = REAL_QUEUE_DEPS) {
  const [productDoc, inventoryDoc] = await Promise.all([
    deps.firestoreAdminGet(env, `products/${encodeURIComponent(id)}`),
    deps.firestoreAdminGet(env, `productInventory/${encodeURIComponent(id)}`),
  ]);
  return {
    id,
    exists: Boolean(productDoc),
    product: productDoc ? decodeFirestoreFields(productDoc.fields || {}) : null,
    inventory: inventoryDoc ? decodeFirestoreFields(inventoryDoc.fields || {}) : null,
  };
}

async function syncProductsPayloadOnce(env, productIds, deps = REAL_QUEUE_DEPS) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, batches: 0 };
  const secret = clean(env?.SHEETS_ENGAGEMENT_SECRET, 500);
  if (!secret) throw new Error('SHEETS_ENGAGEMENT_SECRET no está configurado.');
  let batches = 0;
  for (let i = 0; i < ids.length; i += PRODUCT_SYNC_CHUNK) {
    const chunk = ids.slice(i, i + PRODUCT_SYNC_CHUNK);
    const items = await Promise.all(chunk.map(id => fetchProductPayloadItem(env, id, deps)));
    const response = await deps.fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: 'syncProductsPayload',
        sheetName: 'Productos',
        schemaVersion: 2,
        secret,
        items,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      throw new Error(clean(data.error || `Sheets Productos (payload) respondió ${response.status}`));
    }
    batches += 1;
  }
  return { ok: true, batches };
}

/**
 * Variante de syncProductsWithRetry para llamadas sin sesión humana (worker
 * programado). En vez de reenviar el idToken de un admin logueado, Cloudflare
 * lee Firestore con sus propias credenciales de servicio y empuja el
 * documento completo a Apps Script autenticado con el secreto compartido ya
 * usado por syncOrder — Apps Script nunca necesita tirar de Firestore aquí.
 */
export async function syncProductsPayloadWithRetry(env, productIds, { attempts = 2 } = {}, deps = REAL_QUEUE_DEPS) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, attempts: 0, batches: 0 };
  let lastError = null;
  const limit = Math.max(1, Math.min(MAX_ATTEMPTS, Number(attempts) || 2));
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    try {
      const result = await syncProductsPayloadOnce(env, ids, deps);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < limit) await sleep(250 * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error('No se pudo sincronizar Productos (payload) con Google Sheets.');
}

/**
 * Worker programado: vacía catalogSheetSyncQueue sin que nadie tenga el panel
 * abierto. Cada tarea se reclama con bloqueo optimista (ver claimQueueItem),
 * se reintenta con backoff creciente entre corridas y, al superar
 * MAX_QUEUE_ATTEMPTS, pasa a dead_letter y dispara una alerta idempotente en
 * vez de reintentar para siempre en silencio.
 */
export async function drainCatalogSheetSyncQueueScheduled(env, { limit = 25, deps = REAL_QUEUE_DEPS } = {}) {
  const now = Date.now();
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const eligible = documents.filter(document => {
    const item = decoded(document);
    if (!item || item.status !== 'pending' || !Array.isArray(item.productIds) || !item.productIds.length) return false;
    if (item.claimedAt && !isStale(item.claimedAt)) return false;
    const nextAt = Date.parse(item.nextAttemptAt || '');
    if (Number.isFinite(nextAt) && nextAt > now) return false;
    return true;
  }).slice(0, Math.max(1, Math.min(MAX_PENDING, Number(limit) || 25)));

  let drained = 0;
  let deadLettered = 0;
  let lastError = '';
  for (const document of eligible) {
    const claimed = await claimQueueItem(env, document, deps);
    if (!claimed) continue;
    try {
      await syncProductsPayloadWithRetry(env, claimed.productIds, { attempts: 2 }, deps);
      await deps.firestoreAdminCommit(env, [{ path: `${QUEUE_COLLECTION}/${claimed.id}`, delete: true }]);
      drained += 1;
    } catch (error) {
      const attempts = Number(claimed.attempts || 0) + 1;
      lastError = clean(error?.message || error);
      if (attempts >= MAX_QUEUE_ATTEMPTS) {
        await transitionDeadLetter(env, { ...claimed, attempts }, error, deps);
        deadLettered += 1;
      } else {
        await releaseClaim(env, claimed, {
          attempts,
          lastError,
          nextAttemptAt: new Date(now + QUEUE_BACKOFF_MS * Math.min(attempts, 6)),
        }, deps);
      }
    }
  }

  const finishedAt = new Date();
  const metaFields = {
    lastRunAt: fsTimestamp(finishedAt),
    lastDrained: fsInteger(drained),
    lastDeadLettered: fsInteger(deadLettered),
  };
  if (drained > 0) metaFields.lastSuccessAt = fsTimestamp(finishedAt);
  if (lastError) metaFields.lastError = fsString(lastError);
  try {
    await deps.firestoreAdminMerge(env, SYNC_META_PATH, metaFields);
  } catch (error) {
    console.error('[resiliencia-sync-catalogo] No se pudo actualizar syncMeta:', error?.message || error);
  }

  return { checked: eligible.length, drained, deadLettered, remaining: eligible.length - drained - deadLettered };
}

/** Métrica de solo lectura para el panel de Diagnóstico (Estado del ecosistema). */
export async function getCatalogSheetSyncQueueStatus(env, deps = REAL_QUEUE_DEPS) {
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const items = documents.map(decoded).filter(Boolean);
  const pending = items.filter(item => item.status === 'pending');
  const deadLetter = items.filter(item => item.status === 'dead_letter');
  const oldestPendingAt = pending.reduce((oldest, item) => {
    const at = Date.parse(item.createdAt || '');
    if (!Number.isFinite(at)) return oldest;
    return oldest === null ? at : Math.min(oldest, at);
  }, null);
  const metaDoc = await deps.firestoreAdminGet(env, SYNC_META_PATH).catch(() => null);
  const meta = metaDoc ? decodeFirestoreFields(metaDoc.fields || {}) : {};
  return {
    pendingCount: pending.length,
    deadLetterCount: deadLetter.length,
    oldestPendingAgeMs: oldestPendingAt === null ? null : Math.max(0, Date.now() - oldestPendingAt),
    lastRunAt: meta.lastRunAt || '',
    lastSuccessAt: meta.lastSuccessAt || '',
    lastError: meta.lastError || '',
  };
}
