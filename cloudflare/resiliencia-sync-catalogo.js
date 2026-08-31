import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminListAll,
} from './firebase-admin-ligero.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';

const PRODUCT_SYNC_CHUNK = 100;
const MAX_ATTEMPTS = 4;
const QUEUE_COLLECTION = 'catalogSheetSyncQueue';
const MAX_PENDING = 200;

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 180)).filter(Boolean))];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decoded(document) {
  return document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
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

async function queuePendingSync(env, productIds, error, actor = null) {
  const ids = unique(productIds);
  if (!ids.length) return null;
  const id = `catalog_sync_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${id}`,
    fields: encodeFirestoreFields({
      schemaVersion: 1,
      status: 'pending',
      productIds: ids,
      lastError: clean(error?.message || error),
      actorEmail: clean(actor?.email, 254),
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
 * Cada nueva operación administrativa intenta cerrar primero reconciliaciones
 * pendientes. Así una caída temporal de Google no puede quedar olvidada.
 */
export async function retryPendingCatalogSheets(env, idToken) {
  const pending = (await firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING))
    .map(decoded)
    .filter(item => item && item.status !== 'done' && Array.isArray(item.productIds) && item.productIds.length);
  if (!pending.length) return { pending: 0, resolved: 0, remaining: 0 };

  let resolved = 0;
  const deleteWrites = [];
  for (const item of pending) {
    try {
      await syncProductsWithRetry(idToken, item.productIds, { attempts: 2 });
      deleteWrites.push({ path: `${QUEUE_COLLECTION}/${item.id}`, delete: true });
      resolved += 1;
    } catch {
      // Sigue pendiente. No se borra ni se marca como éxito.
    }
  }
  for (let i = 0; i < deleteWrites.length; i += 20) {
    await firestoreAdminCommit(env, deleteWrites.slice(i, i + 20));
  }
  return { pending: pending.length, resolved, remaining: pending.length - resolved };
}
