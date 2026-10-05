import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet, firestoreAdminCommit } from './firebase-admin-ligero.js';

const CLAIM_MS = 10 * 60 * 1000;
// Leave a margin before the provider's 24-hour idempotency window expires.
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const REAL_DEPS = { get: firestoreAdminGet, commit: firestoreAdminCommit, now: Date.now };

/** Server-only receipt shared by checkout, customer retries and the queue. */
export async function sendInitialOrderEmailOnce(env, { orderId, channel, send }, deps = REAL_DEPS) {
  if (!/^[A-Za-z0-9_-]{1,220}$/.test(orderId) || !['admin', 'customer'].includes(channel)) {
    throw new Error('Identidad de correo inválida.');
  }
  const path = `syncMeta/orderEmailReceipt_${orderId}_${channel}`;
  const document = await deps.get(env, path);
  const previous = document ? decodeFirestoreFields(document.fields || {}) : {};
  if (previous.status === 'sent') return { duplicate: true };
  const now = deps.now();
  const firstAttemptAt = previous.firstAttemptAt || new Date(now).toISOString();
  const firstAt = Date.parse(firstAttemptAt);
  if (!Number.isFinite(firstAt) || now - firstAt >= RETRY_WINDOW_MS) {
    throw new Error('Entrega pendiente de revisión: venció la ventana segura de reintento.');
  }
  if (previous.status === 'sending' && now - Date.parse(previous.claimedAt) < CLAIM_MS) {
    throw new Error('El correo ya se está enviando; reintentá más tarde.');
  }
  const claimId = crypto.randomUUID();
  await deps.commit(env, [{
    path,
    fields: encodeFirestoreFields({ status: 'sending', firstAttemptAt, claimedAt: new Date(now), claimId }),
    currentDocument: document ? { updateTime: document.updateTime } : { exists: false },
  }]);
  // Capture the claimed version before calling the provider. Never send if
  // persistence fails, and never let an old attempt overwrite a newer claim.
  const claimed = await deps.get(env, path);
  if (!claimed?.updateTime || decodeFirestoreFields(claimed.fields || {}).claimId !== claimId) {
    throw new Error('No se pudo confirmar el envío reservado.');
  }
  const result = await send();
  await deps.commit(env, [{
    path,
    fields: encodeFirestoreFields({ status: 'sent', sentAt: new Date(deps.now()) }),
    mergeFields: ['status', 'sentAt'],
    currentDocument: { updateTime: claimed.updateTime },
  }]);
  return result;
}
