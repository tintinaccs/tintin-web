import {
  corsHeaders,
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import { fetchAppsScript } from '../../cloudflare/apps-script-fetch.js';

// Apps Script sigue ejecutando únicamente la transacción privilegiada heredada
// de creación de pedidos y las rutas de correo antiguas que aún puedan invocarse
// durante la transición. El navegador nunca debe conectarse directamente a este
// deployment: todas las solicitudes pasan primero por Cloudflare.
const APPS_SCRIPT_ORDER_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyh9I5aPp9d3lMSnYRNfrHcSCCobCoDOif9CqtXmMe4FgwSjzlKf4kjQZqvKDRmEY6S/exec';
const MAX_BODY_BYTES = 96 * 1024;
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

export async function onRequest(context) {
  const { request } = context;
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

    const upstream = await fetchAppsScript(APPS_SCRIPT_ORDER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: rawBody,
      redirect: 'follow'
    });
    const body = await upstream.text();
    const headers = corsHeaders(origin, requestUrl);
    headers['content-type'] = 'application/json; charset=utf-8';
    headers['x-tintin-upstream'] = 'apps-script-bridge';

    return new Response(body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: 'upstream_unavailable',
      detail: clean(error?.message || error, 240)
    }, 502, origin, requestUrl);
  }
}
