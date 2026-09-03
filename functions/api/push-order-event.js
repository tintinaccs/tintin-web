// =============================================================
// TINTIN — Webhook interno de eventos de pedido (firmado)
// =============================================================
// Único disparador confiable del aviso "pedido creado": lo llama
// apps-script/CrearPedido.gs DESPUÉS de que el commit del pedido
// haya sido exitoso, firmando `<timestamp>.<rawBody>` con HMAC-SHA256.
//
// Nada del cuerpo del webhook se usa para armar notificaciones ni espejos: el
// pedido se vuelve a leer desde Firestore con credenciales de servidor. El
// webhook sólo dice "mirá este pedido", nunca cuánto salió ni de quién es.

import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';
import {
  WEBHOOK_MAX_BODY_BYTES,
  cleanText,
  parseWebhookEvent,
  sanitizeError,
  verifyWebhookSignature
} from '../../cloudflare/nucleo-push.js';
import { dispatchOrderPushEvent, pushEnabled } from '../../cloudflare/servicio-push.js';
import { decodeFirestoreFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';
import { syncProductIdsToSheetsBestEffort } from '../../cloudflare/product-mirror-sheets-sync.js';

function productIds(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return [...new Set(items.map(item => String(item?.id || '').trim()).filter(Boolean))];
}

async function syncCommittedOrderDependencies(env, orderId) {
  const document = await firestoreAdminGet(env, `orders/${encodeURIComponent(orderId)}`);
  if (!document) return { ok: false, error: 'order_not_found' };
  const order = decodeFirestoreFields(document.fields || {});
  const products = await syncProductIdsToSheetsBestEffort(env, productIds(order), {
    email: order.userEmail || '',
    source: 'checkout-order-created',
  });
  return { ok: true, products };
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = request.url;
  // Este endpoint no lo llama ningún navegador: no hay CORS que conceder.
  const origin = '';

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, requestUrl);
  }

  const secret = cleanText(env.TINTIN_PUSH_WEBHOOK_SECRET, 200);
  if (!secret) {
    return jsonResponse({ success: false, error: 'Webhook no configurado' }, 503, origin, requestUrl);
  }

  const rawBody = await request.text();
  if (rawBody.length > WEBHOOK_MAX_BODY_BYTES) {
    return jsonResponse({ success: false, error: 'Solicitud demasiado grande' }, 413, origin, requestUrl);
  }

  const verified = await verifyWebhookSignature({
    secret,
    timestamp: request.headers.get('x-tintin-timestamp'),
    signature: request.headers.get('x-tintin-signature'),
    rawBody
  });
  if (!verified.ok) {
    const status = verified.error === 'timestamp_expired' ? 408 : 401;
    return jsonResponse({ success: false, error: 'Firma inválida' }, status, origin, requestUrl);
  }

  const parsed = parseWebhookEvent(rawBody);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: 'Evento inválido' }, 400, origin, requestUrl);
  }

  try {
    const { eventId, type, orderId } = parsed.event;

    // Este webhook ocurre después del commit del checkout. La réplica del stock
    // no depende de que las notificaciones Web Push estén habilitadas: primero
    // se actualizan los productos afectados y recién después se decide si hay
    // que mandar la notificación social.
    const mirrors = type === 'order.created'
      ? await syncCommittedOrderDependencies(env, orderId)
      : { ok: true, skipped: true };
    if (mirrors.error === 'order_not_found') {
      return jsonResponse({ success: false, error: 'Pedido inexistente' }, 404, origin, requestUrl);
    }

    if (!pushEnabled(env)) {
      return jsonResponse({ success: true, skipped: 'disabled', mirrors }, 200, origin, requestUrl);
    }

    const result = await dispatchOrderPushEvent(env, type, orderId, eventId);
    if (result.error === 'order_not_found') {
      return jsonResponse({ success: false, error: 'Pedido inexistente', mirrors }, 404, origin, requestUrl);
    }
    if (result.duplicate) {
      return jsonResponse({ success: true, duplicate: true, mirrors }, 200, origin, requestUrl);
    }
    if (result.skipped) {
      return jsonResponse({ success: true, skipped: result.skipped, mirrors }, 202, origin, requestUrl);
    }

    return jsonResponse({
      success: Boolean(result.ok),
      status: result.status,
      attempted: result.attempted,
      successCount: result.successCount,
      failureCount: result.failureCount,
      disabledCount: result.disabledCount,
      lastError: result.lastError || '',
      mirrors,
    }, result.ok ? 200 : 502, origin, requestUrl);
  } catch (error) {
    // 500 para que Apps Script pueda reintentar; el pedido ya está creado y
    // no se toca por esto. Producto usa además su cola persistente de rescate.
    return jsonResponse({ success: false, error: sanitizeError(error, 160) }, 500, origin, requestUrl);
  }
}
