// Cotizaciones mayoristas: la clienta autenticada envía productos y
// cantidades. El servidor arma la cotización con datos del catálogo; el
// navegador nunca fija precios ni el estado mayorista de la cuenta.
import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { createWholesaleQuote } from '../../cloudflare/mayoristas.js';
import { afterWholesaleQuoteCreated } from '../../cloudflare/mayoristas-avisos.js';

// Códigos que la página sabe explicar; cualquier otro error sale genérico.
const PUBLIC_CODES = new Set([
  'invalid_request_id', 'empty_quote', 'too_many_lines', 'invalid_line', 'business_name_required',
  'whatsapp_invalid', 'product_not_found', 'product_inactive', 'profile_required', 'account_blocked',
]);

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 32 * 1024) {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400, origin, requestUrl);
    }
    const result = await createWholesaleQuote(env, JSON.parse(raw), user);
    context.waitUntil?.(afterWholesaleQuoteCreated(env, result));
    return jsonResponse({
      ok: true,
      quoteId: result.quoteId,
      quoteNumber: result.quote?.quoteNumber || result.quoteNumber,
      duplicate: result.duplicate === true,
    }, 200, origin, requestUrl);
  } catch (error) {
    const code = String(error?.code || '');
    const status = statusFromError(error, Number(error?.status) || 400);
    if (status === 401 || (status === 403 && code.startsWith('auth/'))) {
      return jsonResponse({ ok: false, error: 'authentication_required' }, status, origin, requestUrl);
    }
    console.error('[wholesale-quote]', code, error?.message || error);
    return jsonResponse({
      ok: false,
      error: PUBLIC_CODES.has(code) ? code : 'quote_failed',
      ...(error?.productId ? { productId: String(error.productId).slice(0, 180) } : {}),
    }, PUBLIC_CODES.has(code) ? status : 500, origin, requestUrl);
  }
}
