import { encodeFirestoreFields, firestoreAdminCommit } from './firebase-admin-ligero.js';
import { syncProductsPayloadWithRetry } from './resiliencia-sync-catalogo.js';

const QUEUE_COLLECTION = 'catalogSheetSyncQueue';

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => clean(value, 180))
    .filter(Boolean))];
}

async function queueFallback(env, productIds, error, actor = {}) {
  const ids = uniqueIds(productIds);
  if (!ids.length) return null;
  const queueId = `catalog_sync_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date();
  await firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${queueId}`,
    fields: encodeFirestoreFields({
      schemaVersion: 2,
      status: 'pending',
      productIds: ids,
      lastError: clean(error?.message || error, 500),
      actorEmail: clean(actor?.email, 254),
      attempts: 0,
      nextAttemptAt: now,
      claimedAt: null,
      claimedBy: '',
      createdAt: now,
      updatedAt: now,
      source: clean(actor?.source || actor?.origin || 'server-mutation', 120),
    }),
  }]);
  return queueId;
}

/**
 * Refleja inmediatamente en la hoja Productos cualquier producto cuyo estado
 * canónico cambió de forma server-side (por ejemplo, stock reservado/liberado
 * por un pedido). Si Apps Script no responde, deja una tarea persistente para
 * el drenador catalog-sheet-sync-drain; la mutación comercial nunca se revierte.
 */
export async function syncProductIdsToSheetsBestEffort(env, productIds, actor = {}) {
  const ids = uniqueIds(productIds);
  if (!ids.length) return { ok: true, deferred: false, skipped: true, productIds: [] };
  try {
    const result = await syncProductsPayloadWithRetry(env, ids, { attempts: 2 });
    return { ok: true, deferred: false, queued: false, productIds: ids, ...result };
  } catch (error) {
    try {
      const queueId = await queueFallback(env, ids, error, actor);
      console.warn('[Tintin Products] Push inmediato a Sheets diferido y encolado.', error);
      return {
        ok: false,
        deferred: true,
        queued: Boolean(queueId),
        queueId,
        productIds: ids,
        error: clean(error?.message || error, 500),
      };
    } catch (queueError) {
      console.error('[Tintin Products] Falló el push y también la cola de recuperación.', queueError);
      return {
        ok: false,
        deferred: true,
        queued: false,
        productIds: ids,
        error: clean(error?.message || error, 500),
        queueError: clean(queueError?.message || queueError, 500),
      };
    }
  }
}
