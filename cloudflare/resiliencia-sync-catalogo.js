import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminListAll,
  firestoreAdminMerge,
} from './firebase-admin-ligero.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';

const PRODUCT_SYNC_CHUNK = 100;
const MAX_ATTEMPTS = 4;
const QUEUE_COLLECTION = 'catalogSheetSyncQueue';
const MAX_PENDING = 200;
const MAX_QUEUE_ATTEMPTS = 8;
const RETRY_DELAYS_MS = Object.freeze([
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  48 * 60 * 60_000,
]);

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 180)).filter(Boolean))];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decoded(document) {
  return document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
}

function asTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function catalogQueueRetryDelayMs(attemptCount) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Number(attemptCount || 1) - 1));
  return RETRY_DELAYS_MS[index];
}

export async function catalogQueueTaskId(productIds) {
  const ids = unique(productIds).sort();
  const bytes = new TextEncoder().encode(ids.join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  return `catalog_sync_${hex.slice(0, 32)}`;
}

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

/**
 * La tarea usa un id determinista derivado de los productos. Repetir la misma
 * operación fallida no crea filas infinitas: actualiza la misma reconciliación.
 */
async function queuePendingSync(env, productIds, error, actor = null) {
  const ids = unique(productIds).sort();
  if (!ids.length) return null;
  const id = await catalogQueueTaskId(ids);
  const path = `${QUEUE_COLLECTION}/${id}`;
  const previous = decoded(await firestoreAdminGet(env, path));
  const now = new Date();
  const previousAttempts = Math.max(0, Number(previous?.attemptCount || 0));
  const createdAt = previous?.createdAt || now;

  await firestoreAdminCommit(env, [{
    path,
    fields: encodeFirestoreFields({
      schemaVersion: 2,
      status: 'pending',
      productIds: ids,
      lastError: clean(error?.message || error),
      actorEmail: clean(actor?.email, 254),
      attemptCount: previousAttempts,
      createdAt,
      updatedAt: now,
      nextAttemptAt: new Date(now.getTime() + catalogQueueRetryDelayMs(Math.max(1, previousAttempts + 1))),
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

export async function getCatalogSyncQueueStats(env, { now = Date.now() } = {}) {
  const items = (await firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING))
    .map(decoded)
    .filter(item => item && Array.isArray(item.productIds) && item.productIds.length && item.status !== 'done');
  const active = items.filter(item => item.status !== 'dead');
  const due = active.filter(item => !asTime(item.nextAttemptAt) || asTime(item.nextAttemptAt) <= now);
  const oldest = active
    .map(item => asTime(item.createdAt))
    .filter(Boolean)
    .sort((a, b) => a - b)[0] || 0;
  return {
    total: items.length,
    pending: active.length,
    due: due.length,
    deferred: Math.max(0, active.length - due.length),
    dead: items.filter(item => item.status === 'dead').length,
    oldestPendingAt: oldest ? new Date(oldest).toISOString() : '',
    capped: items.length >= MAX_PENDING,
  };
}

/**
 * Reintenta tareas vencidas con backoff exponencial y dead-letter. `force`
 * permite al Super Admin solicitar un reintento inmediato sin esperar el reloj,
 * pero una tarea agotada permanece en dead-letter para no generar un loop.
 */
export async function retryPendingCatalogSheets(env, idToken, { force = false, now = Date.now() } = {}) {
  const pending = (await firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING))
    .map(decoded)
    .filter(item => item && item.status !== 'done' && Array.isArray(item.productIds) && item.productIds.length);
  if (!pending.length) {
    return { pending: 0, attempted: 0, resolved: 0, failed: 0, deferred: 0, dead: 0, remaining: 0 };
  }

  let attempted = 0;
  let resolved = 0;
  let failed = 0;
  let deferred = 0;
  let dead = 0;
  const deleteWrites = [];

  for (const item of pending) {
    if (item.status === 'dead') {
      dead += 1;
      continue;
    }
    const dueAt = asTime(item.nextAttemptAt);
    if (!force && dueAt && dueAt > now) {
      deferred += 1;
      continue;
    }

    attempted += 1;
    try {
      await syncProductsWithRetry(idToken, item.productIds, { attempts: 2 });
      deleteWrites.push({ path: `${QUEUE_COLLECTION}/${item.id}`, delete: true });
      resolved += 1;
    } catch (error) {
      failed += 1;
      const attemptCount = Math.max(0, Number(item.attemptCount || 0)) + 1;
      const exhausted = attemptCount >= MAX_QUEUE_ATTEMPTS;
      if (exhausted) dead += 1;
      const update = {
        status: exhausted ? 'dead' : 'pending',
        attemptCount,
        lastError: clean(error?.message || error),
        lastAttemptAt: new Date(now),
        updatedAt: new Date(now),
      };
      if (!exhausted) {
        update.nextAttemptAt = new Date(now + catalogQueueRetryDelayMs(attemptCount));
      }
      await firestoreAdminMerge(env, `${QUEUE_COLLECTION}/${item.id}`, encodeFirestoreFields(update));
    }
  }

  for (let i = 0; i < deleteWrites.length; i += 20) {
    await firestoreAdminCommit(env, deleteWrites.slice(i, i + 20));
  }

  return {
    pending: pending.length,
    attempted,
    resolved,
    failed,
    deferred,
    dead,
    remaining: pending.length - resolved,
  };
}
