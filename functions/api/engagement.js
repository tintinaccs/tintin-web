import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  addCustomerReply,
  createReview,
  editOwnReview,
  engagementOwnReviewView,
  engagementReviewPublic,
  getOwnFavorite,
  getOwnReview,
  getProductLikeStats,
  getProductReviewStats,
  getReviewInteractions,
  likeReply,
  toggleFavorite,
  toggleReviewLike,
  engagementIsSuperAdmin,
  engagementUpdateReviewStats,
} from '../../cloudflare/participacion-clientes.js';
import {
  encodeFirestoreFields, firestoreAdminCommit, firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import { syncEngagementToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';
import { dispatchSocialPushEvent, recordPushFailure } from '../../cloudflare/servicio-push.js';

const MAX_BODY_BYTES = 8 * 1024;
const REPLY_COOLDOWN_MS = 5000;

async function hashKey(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

async function reserveReplyWindow(env, user, input) {
  if (engagementIsSuperAdmin(user)) return;
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
    const error = new Error('Esperá unos segundos antes de enviar otra respuesta.');
    error.status = 429;
    error.code = 'social/reply-rate-limit';
    error.retryAfterMs = REPLY_COOLDOWN_MS - (now - lastAt);
    throw error;
  }

  try {
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
  } catch (error) {
    if (error?.code === 'version_conflict') {
      const limited = new Error('Esperá unos segundos antes de enviar otra respuesta.');
      limited.status = 429;
      limited.code = 'social/reply-rate-limit';
      limited.retryAfterMs = REPLY_COOLDOWN_MS;
      throw limited;
    }
    throw error;
  }
}

function pushDetails(action, result, privateReview) {
  if (action === 'createReview') {
    return {
      type: 'social.review.created',
      title: `${privateReview.realName} publicó una reseña`,
      body: `${privateReview.rating} estrellas · ${privateReview.productName}: ${privateReview.comment}`,
      url: `/product?id=${encodeURIComponent(privateReview.productId)}#review-${encodeURIComponent(privateReview.reviewId)}`,
    };
  }
  if (action === 'replyReview') {
    const reply = result?.reply || {};
    const review = result?.review || {};
    return {
      type: 'social.review.reply',
      title: `${reply.actorRealName || 'Una clienta'} respondió en ${review.productName || 'un producto'}`,
      body: String(reply.text || 'Nueva respuesta.'),
      url: `/product?id=${encodeURIComponent(review.productId || '')}#reply-${encodeURIComponent(reply.replyId || '')}`,
    };
  }
  if (action === 'toggleFavorite') {
    const record = result?.record || {};
    return {
      type: 'social.like.product',
      title: `${record.realName || 'Una clienta'} dio Me gusta`,
      body: record.productName ? `Le gustó ${record.productName}.` : 'Nuevo Me gusta en un producto.',
      url: `/product?id=${encodeURIComponent(record.productId || '')}`,
    };
  }
  if (action === 'toggleReviewLike') {
    const record = result?.record || {};
    return {
      type: 'social.like.review',
      title: `${record.realName || 'Una clienta'} dio Me gusta a una reseña`,
      body: record.targetOwnerName ? `Le gustó el comentario de ${record.targetOwnerName}.` : 'Nuevo Me gusta en una reseña.',
      url: `/product?id=${encodeURIComponent(record.productId || '')}#review-${encodeURIComponent(record.reviewId || '')}`,
    };
  }
  if (action === 'likeReply') {
    const record = result?.record || {};
    return {
      type: 'social.like.reply',
      title: `${record.realName || 'Una clienta'} dio Me gusta a una respuesta`,
      body: record.targetOwnerName ? `Le gustó la respuesta de ${record.targetOwnerName}.` : 'Nuevo Me gusta en una respuesta.',
      url: `/product?id=${encodeURIComponent(record.productId || '')}#reply-${encodeURIComponent(record.replyId || '')}`,
    };
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const action = url.searchParams.get('action');
      const productId = url.searchParams.get('productId');
      if (action === 'productLikes') {
        return jsonResponse({ ok: true, ...(await getProductLikeStats(env, productId)) }, 200, origin, request.url);
      }
      if (action === 'reviewStats') {
        return jsonResponse({ ok: true, stats: await getProductReviewStats(env, productId) }, 200, origin, request.url);
      }
    }

    const user = await requireFirebaseUser(request);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const action = url.searchParams.get('action');
      const productId = url.searchParams.get('productId');
      if (action === 'ownReview') {
        return jsonResponse({ ok: true, review: await getOwnReview(env, user, productId) }, 200, origin, request.url);
      }
      if (action === 'ownFavorite') {
        return jsonResponse({ ok: true, favorite: await getOwnFavorite(env, user, productId) }, 200, origin, request.url);
      }
      if (action === 'reviewInteractions') {
        return jsonResponse({ ok: true, interactions: await getReviewInteractions(env, user, productId) }, 200, origin, request.url);
      }
      throw Object.assign(new Error('Acción no permitida'), { status: 400 });
    }

    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);
    let result = {};
    let privateReview = null;

    if (input.action === 'createReview') {
      privateReview = await createReview(env, user, input);
      result = {
        review: engagementOwnReviewView(privateReview),
        publicReview: engagementReviewPublic(privateReview),
        rateLimit: privateReview.rateLimit || null,
      };
    } else if (input.action === 'editReview') {
      privateReview = await editOwnReview(env, user, input);
      result = { review: engagementOwnReviewView(privateReview) };
    } else if (input.action === 'replyReview') {
      await reserveReplyWindow(env, user, input);
      const replyResult = await addCustomerReply(env, user, input);
      result = {
        review: engagementReviewPublic(replyResult.review),
        reply: {
          replyId: replyResult.reply.replyId,
          authorType: replyResult.reply.authorType,
          publicName: replyResult.reply.actorPublicName,
          publicPhotoUrl: replyResult.reply.actorPhotoUrl,
          text: replyResult.reply.text,
          likeCount: replyResult.reply.likeCount,
          createdAt: replyResult.reply.createdAt,
        },
      };
    } else if (input.action === 'toggleFavorite') {
      result = await toggleFavorite(env, user, input);
    } else if (input.action === 'toggleReviewLike') {
      result = await toggleReviewLike(env, user, input);
    } else if (input.action === 'likeReply') {
      result = await likeReply(env, user, input);
    } else {
      throw Object.assign(new Error('Acción no permitida'), { status: 400 });
    }

    let syncEvent = null;
    if (input.action === 'createReview') syncEvent = { type: 'review', operation: 'upsert', record: privateReview };
    if (input.action === 'replyReview') syncEvent = { type: 'review', operation: 'upsert', record: result.review };
    if (input.action === 'toggleFavorite' && !result.alreadyLiked) syncEvent = { type: 'like', operation: 'upsert', record: result.record };
    if ((input.action === 'toggleReviewLike' || input.action === 'likeReply') && !result.alreadyLiked) {
      syncEvent = { type: 'like', operation: 'upsert', record: result.record };
    }
    if (syncEvent) context.waitUntil?.(syncEngagementToSheets(env, user.idToken, syncEvent));
    if (input.action === 'createReview') {
      const refreshStats = engagementUpdateReviewStats(env, privateReview.productId).catch(error => {
        console.warn('[engagement] No se pudieron actualizar las estadísticas de reseñas:', error);
      });
      context.waitUntil?.(refreshStats);
    }

    const push = pushDetails(input.action, result, privateReview);
    const isNewEvent = input.action === 'createReview' || input.action === 'replyReview' || result.alreadyLiked !== true;
    if (push && isNewEvent && !engagementIsSuperAdmin(user)) {
      // En Pages normalmente existe waitUntil, pero no se debe perder el
      // aviso si el handler se ejecuta en un runtime/test que no lo expone.
      // El pedido tiene webhook dedicado; los eventos sociales deben tener la
      // misma garantía de que el intento de envío ocurra antes de terminar la
      // solicitud cuando no hay background execution disponible.
      const pushEventId = `${push.type}:${user.uid}:${result?.record?.likeId || result?.reply?.replyId || privateReview?.reviewId || Date.now()}`;
      const socialPush = dispatchSocialPushEvent(env, {
        type: push.type,
        eventId: pushEventId,
        title: push.title,
        body: push.body,
        url: push.url,
      }).catch(error => {
        console.warn('[engagement] No se pudo enviar el push social:', error);
        return recordPushFailure(env, { eventId: pushEventId, type: push.type, error })
          .catch(() => {})
          .then(() => ({ ok: false, error: String(error?.message || 'social_push_failed').slice(0, 180) }));
      });
      if (typeof context.waitUntil === 'function') context.waitUntil(socialPush);
      else await socialPush;
    }

    return jsonResponse({ ok: true, ...result }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status);
    const resolvedStatus = error?.code === 'version_conflict'
      ? 409
      : (Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400);
    return jsonResponse(
      {
        ok: false,
        error: String(error?.message || 'No se pudo completar la acción').slice(0, 300),
        code: String(error?.code || '').slice(0, 120),
        retryAfterMs: Math.max(0, Number(error?.retryAfterMs) || 0),
      },
      resolvedStatus,
      origin,
      request.url
    );
  }
}
