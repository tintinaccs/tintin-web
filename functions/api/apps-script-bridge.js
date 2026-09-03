import {
  corsHeaders,
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import { verifyFirebaseIdToken } from '../../cloudflare/firebase-id-token.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from '../../cloudflare/firestore-admin-batch.js';
import { fetchAppsScript } from '../../cloudflare/apps-script-fetch.js';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';

// Apps Script sigue ejecutando únicamente la transacción privilegiada heredada
// de creación de pedidos y las rutas de correo antiguas que aún puedan invocarse
// durante la transición. El navegador nunca debe conectarse directamente a este
// deployment: todas las solicitudes pasan primero por Cloudflare.
const APPS_SCRIPT_ORDER_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyh9I5aPp9d3lMSnYRNfrHcSCCobCoDOif9CqtXmMe4FgwSjzlKf4kjQZqvKDRmEY6S/exec';
const MAX_BODY_BYTES = 96 * 1024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,220}$/;
const ALLOWED_ACTIONS = new Set([
  'createOrder',
  'sendOrderEmail',
  'resendOrderEmail',
  'sendTestCustomerEmail',
  'sendPromoEmail',
  'sendBulkPromoEmail'
]);

function clean(value, maxLength = 500) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function authFailure(error) {
  const status = Number(error?.status) || 401;
  if (status === 403 || error?.code === 'auth/email-not-verified') {
    return { status: 403, error: 'email_not_verified' };
  }
  if (status >= 500) {
    return { status, error: 'token_verify_failed' };
  }
  return { status: 401, error: 'invalid_id_token' };
}

function versionPrecondition(document) {
  return document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
}

async function enforceCanonicalOrderIdentity(env, orderId, authenticatedUser) {
  const safeOrderId = clean(orderId, 220);
  const uid = clean(authenticatedUser?.uid, 128);
  if (!ORDER_ID_PATTERN.test(safeOrderId) || !uid) {
    throw Object.assign(new Error('El pedido confirmado no devolvió una identidad válida.'), {
      status: 502,
      code: 'order_identity_invalid',
    });
  }

  const customerId = `CUS_${uid}`;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const orderDocument = await firestoreAdminGet(env, `orders/${safeOrderId}`);
    if (!orderDocument) {
      throw Object.assign(new Error('El pedido confirmado no existe en Firestore.'), {
        status: 502,
        code: 'order_missing_after_commit',
      });
    }

    const order = decodeFirestoreFields(orderDocument.fields || {});
    if (clean(order.userId, 128) !== uid) {
      throw Object.assign(new Error('La identidad del pedido no coincide con la sesión autenticada.'), {
        status: 502,
        code: 'order_identity_mismatch',
      });
    }

    const existingCustomerId = clean(order.customerId, 180);
    if (existingCustomerId === customerId) {
      return { customerId, repaired: false, order };
    }
    if (existingCustomerId && existingCustomerId !== customerId) {
      throw Object.assign(new Error('El pedido contiene un Customer ID incompatible.'), {
        status: 502,
        code: 'customer_identity_mismatch',
      });
    }

    try {
      await firestoreAdminBatchCommit(env, [{
        path: `orders/${safeOrderId}`,
        fields: encodeFirestoreFields({ customerId }),
        mergeFields: ['customerId'],
        currentDocument: versionPrecondition(orderDocument),
      }]);
      return { customerId, repaired: true, order: { ...order, customerId } };
    } catch (error) {
      if (Number(error?.status) === 409 && attempt < 2) continue;
      throw error;
    }
  }

  throw Object.assign(new Error('No se pudo fijar la identidad canónica del pedido.'), {
    status: 502,
    code: 'order_identity_commit_failed',
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = request.url;
  const origin = request.headers.get('origin') || '';

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, requestUrl);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, origin, requestUrl);
  }

  try {
    const rawBody = await request.text();
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, origin, requestUrl);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400, origin, requestUrl);
    }

    const action = clean(payload?.action, 60);
    const idToken = clean(payload?.idToken, 5000);
    if (!ALLOWED_ACTIONS.has(action)) {
      return jsonResponse({ ok: false, error: 'action_not_allowed' }, 400, origin, requestUrl);
    }
    if (!idToken) {
      return jsonResponse({ ok: false, error: 'missing_id_token' }, 401, origin, requestUrl);
    }

    // La creación de un pedido es una operación comercial: Cloudflare valida
    // el mismo token que Apps Script volverá a comprobar. Ningún userId,
    // customerId ni userEmail enviado por el navegador atraviesa esta frontera;
    // Apps Script deriva esos datos del UID/correo autenticados.
    const forwardedPayload = { ...payload };
    let authenticatedUser = null;
    if (action === 'createOrder') {
      try {
        authenticatedUser = await verifyFirebaseIdToken(idToken);
      } catch (error) {
        const failure = authFailure(error);
        return jsonResponse({ ok: false, error: failure.error }, failure.status, origin, requestUrl);
      }
      delete forwardedPayload.userId;
      delete forwardedPayload.customerId;
      delete forwardedPayload.userEmail;
      forwardedPayload.idToken = idToken;
    }

    const upstream = await fetchAppsScript(APPS_SCRIPT_ORDER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(forwardedPayload),
      redirect: 'follow'
    });
    const body = await upstream.text();
    const headers = corsHeaders(origin, requestUrl);
    headers['content-type'] = 'application/json; charset=utf-8';
    headers['x-tintin-upstream'] = 'apps-script-bridge';

    if (action === 'createOrder' && upstream.ok) {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch {}
      if (parsed?.ok === true) {
        const identity = await enforceCanonicalOrderIdentity(env, parsed.orderId, authenticatedUser);
        const sheetsSync = await syncOrderToSheetsBestEffort(env, {
          orderId: parsed.orderId,
          order: identity.order,
        });
        parsed.customerId = identity.customerId;
        parsed.sheetsSync = sheetsSync;
        if (parsed.order && typeof parsed.order === 'object') {
          parsed.order.customerId = identity.customerId;
        }
        return new Response(JSON.stringify(parsed), {
          status: upstream.status,
          headers
        });
      }
    }

    return new Response(body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    console.error('[apps-script-bridge]', error?.code || '', error?.message || error);
    return jsonResponse({
      ok: false,
      error: clean(error?.code, 120) || 'upstream_unavailable',
      detail: clean(error?.message || error, 240)
    }, Number(error?.status) || 502, origin, requestUrl);
  }
}
