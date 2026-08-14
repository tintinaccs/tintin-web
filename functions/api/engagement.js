import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  addCustomerReply, createReview, editOwnReview, getOwnReview, getReviewInteractions,
  toggleFavorite, toggleReviewLike, engagementOwnReviewView,
} from '../../cloudflare/participacion-clientes.js';
import {
  encodeFirestoreFields, firestoreAdminCommit, firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import { syncEngagementToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';

const MAX_BODY_BYTES = 8 * 1024;
const REPLY_COOLDOWN_MS = 5000;

async function hashKey(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

async function reserveReplyWindow(env, user, input) {
  const reviewId = String(input.reviewId || '').trim();
  if (!reviewId) return;
  const guardId = await hashKey(`reply:${user.uid}:${reviewId}`);
  const path = `socialRateLimits/${guardId}`;
  const existing = await firestoreAdminGet(env, path);
  const lastAt = existing?.fields?.lastAt?.timestampValue
    ? new Date(existing.fields.lastAt.timestampValue).getTime()
    : 0;
  const now = Date.now();
  if (Number.isFinite(lastAt) && lastAt > 0 && now - lastAt < REPLY_COOLDOWN_MS) {
    throw new Error('Esperá unos segundos antes de enviar otra respuesta.');
  }

  await firestoreAdminCommit(env, [{
    path,
    fields: encodeFirestoreFields({
      kind: 'review_reply',
      uid: user.uid,
      reviewId,
      lastAt: new Date(now),
    }),
    currentDocument: existing ? { updateTime: existing.updateTime } : { exists: false },
  }]);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  try {
    const user = await requireFirebaseUser(request);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const action = url.searchParams.get('action');
      const productId = url.searchParams.get('productId');
      if (action === 'ownReview') {
        return jsonResponse({ ok: true, review: await getOwnReview(env, user, productId) }, 200, origin, request.url);
      }
      if (action === 'reviewInteractions') {
        return jsonResponse({ ok: true, interactions: await getReviewInteractions(env, user, productId) }, 200, origin, request.url);
      }
      throw new Error('Acción no permitida');
    }
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);
    let result;
    let privateReview = null;
    if (input.action === 'createReview') privateReview = await createReview(env, user, input);
    else if (input.action === 'editReview') privateReview = await editOwnReview(env, user, input);
    else if (input.action === 'replyReview') {
      await reserveReplyWindow(env, user, input);
      privateReview = await addCustomerReply(env, user, input);
    }
    else if (input.action === 'toggleFavorite') result = await toggleFavorite(env, user, input);
    else if (input.action === 'toggleReviewLike') result = await toggleReviewLike(env, user, input);
    else throw new Error('Acción no permitida');
    if (privateReview) result = { review: engagementOwnReviewView(privateReview) };

    if (input.action !== 'toggleReviewLike') {
      const syncEvent = input.action === 'toggleFavorite'
        ? { type: 'like', operation: result.selected ? 'upsert' : 'delete', record: result.record }
        : { type: 'review', operation: 'upsert', record: privateReview };
      context.waitUntil?.(syncEngagementToSheets(env, user.idToken, syncEvent));
    }
    return jsonResponse({ ok: true, ...result }, 200, origin, request.url);
  } catch (error) {
    const conflict = error?.code === 'version_conflict';
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) }, conflict ? 409 : 400, origin, request.url);
  }
}
