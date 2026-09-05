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
import { notifyAdminIfAbsent } from './notificaciones-sociales.js';
import { sendOrderEmails } from '../functions/api/order-email.js';

const QUEUE_COLLECTION = 'orderEmailQueue';
const MAX_PENDING = 200;
const MAX_QUEUE_ATTEMPTS = 8;
const QUEUE_BACKOFF_MS = 5 * 60 * 1000;
const CLAIM_STALE_MS = 10 * 60 * 1000;
const QUEUE_META_PATH = 'syncMeta/orderEmailQueue';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const isStale = claimedAt => {
  const at = Date.parse(claimedAt || '');
  return !Number.isFinite(at) || (Date.now() - at) > CLAIM_STALE_MS;
};

function decoded(document) {
  return document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
}

// Igual que en resiliencia-sync-catalogo.js: las dependencias reales se
// inyectan explícitamente para poder probar reclamos, backoff y dead-letter
// con un Firestore/envío de correo en memoria, sin tocar Resend real.
const REAL_QUEUE_DEPS = {
  firestoreAdminGet,
  firestoreAdminCommit,
  firestoreAdminListAll,
  firestoreAdminMerge,
  notifyAdminIfAbsent,
  sendOrderEmailsImpl: sendOrderEmails,
};

/**
 * Registra (o reemplaza) el reintento pendiente de un pedido cuyo envío
 * inmediato falló. El ID del documento es el propio orderId: fallos
 * repetidos del mismo pedido antes de que el drenaje corra se consolidan en
 * un único registro en vez de duplicarse.
 */
export async function queuePendingOrderEmail(env, { orderId, retryAdmin, retryCustomer, lastError }) {
  const id = clean(orderId, 220);
  if (!id || (!retryAdmin && !retryCustomer)) return null;
  await firestoreAdminCommit(env, [{
    path: `${QUEUE_COLLECTION}/${id}`,
    fields: encodeFirestoreFields({
      schemaVersion: 1,
      status: 'pending',
      orderId: id,
      retryAdmin: Boolean(retryAdmin),
      retryCustomer: Boolean(retryCustomer),
      lastError: clean(lastError),
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
 * Reclama una tarea de la cola con bloqueo optimista (precondición sobre
 * updateTime). Si otro proceso la reclamó primero, el commit falla con
 * version_conflict y esta función devuelve null: el drenaje programado
 * nunca reenvía el correo del mismo pedido dos veces en paralelo.
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
    kind: 'order_email_queue_dead_letter',
    actorType: 'system',
    title: 'Cola de reintento de correos de pedido bloqueada',
    body: `El pedido ${item.orderId} no pudo enviar su correo tras ${item.attempts} intentos: ${clean(error?.message || error, 200)}`,
    targetUrl: '/admin.html#section-diagnostico',
    sourceType: 'orderEmailQueue',
    sourceId: item.id,
  }, `order-email-dead-letter:${item.id}`);
}

async function fetchOrderForRetry(env, orderId, deps = REAL_QUEUE_DEPS) {
  const document = await deps.firestoreAdminGet(env, `orders/${encodeURIComponent(orderId)}`);
  return document ? decodeFirestoreFields(document.fields || {}) : null;
}

/**
 * Worker programado: vacía orderEmailQueue sin sesión humana. Cada tarea se
 * reclama con bloqueo optimista, se reintenta con backoff creciente entre
 * corridas y, al superar MAX_QUEUE_ATTEMPTS, pasa a dead_letter con una
 * alerta idempotente en vez de reintentar para siempre en silencio. Llama a
 * sendOrderEmails con isResend:false para reutilizar el mismo sufijo de
 * idempotencia ('new-v1') del intento original: si Resend ya había recibido
 * el envío, lo devuelve sin duplicarlo.
 */
export async function drainOrderEmailQueueScheduled(env, { limit = 25, deps = REAL_QUEUE_DEPS } = {}) {
  const now = Date.now();
  const apiKey = clean(env?.RESEND_API_KEY, 500);
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const eligible = documents.filter(document => {
    const item = decoded(document);
    if (!item || item.status !== 'pending' || (!item.retryAdmin && !item.retryCustomer)) return false;
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
      if (!apiKey) throw new Error('RESEND_API_KEY no está configurada');
      const order = await fetchOrderForRetry(env, claimed.orderId, deps);
      if (!order) throw new Error('El pedido ya no existe.');
      const result = await deps.sendOrderEmailsImpl({
        apiKey,
        orderId: claimed.orderId,
        order,
        isResend: false,
        sendAdmin: claimed.retryAdmin,
        sendCustomer: claimed.retryCustomer,
      });
      if (!result.success) throw new Error(result.error || 'Reintento de correo falló.');
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
    await deps.firestoreAdminMerge(env, QUEUE_META_PATH, metaFields);
  } catch (error) {
    console.error('[resiliencia-correo-pedido] No se pudo actualizar syncMeta:', error?.message || error);
  }

  return { checked: eligible.length, drained, deadLettered, remaining: eligible.length - drained - deadLettered };
}

/** Métrica de solo lectura para el panel de Diagnóstico (Estado del ecosistema). */
export async function getOrderEmailQueueStatus(env, deps = REAL_QUEUE_DEPS) {
  const documents = await deps.firestoreAdminListAll(env, QUEUE_COLLECTION, MAX_PENDING);
  const items = documents.map(decoded).filter(Boolean);
  const pending = items.filter(item => item.status === 'pending');
  const deadLetter = items.filter(item => item.status === 'dead_letter');
  const oldestPendingAt = pending.reduce((oldest, item) => {
    const at = Date.parse(item.createdAt || '');
    if (!Number.isFinite(at)) return oldest;
    return oldest === null ? at : Math.min(oldest, at);
  }, null);
  const metaDoc = await deps.firestoreAdminGet(env, QUEUE_META_PATH).catch(() => null);
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
