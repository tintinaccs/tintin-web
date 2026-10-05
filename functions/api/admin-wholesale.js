// Respuesta del Super Admin a una cotización mayorista: guardar precios,
// aprobar (la cuenta queda mayorista aprobada) o rechazar.
import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { respondWholesaleQuote } from '../../cloudflare/mayoristas.js';
import { afterWholesaleQuoteResponded } from '../../cloudflare/mayoristas-avisos.js';

const PUBLIC_CODES = new Set([
  'invalid_quote', 'invalid_decision', 'quote_not_found', 'quote_closed', 'stale_quote',
  'prices_mismatch', 'price_required', 'price_invalid',
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
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 32 * 1024) {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400, origin, requestUrl);
    }
    const result = await respondWholesaleQuote(env, JSON.parse(raw), { uid: actor.uid, email: actor.email });
    context.waitUntil?.(afterWholesaleQuoteResponded(env, result));
    return jsonResponse({ ok: true, quoteId: result.quoteId, decision: result.decision, quote: result.quote }, 200, origin, requestUrl);
  } catch (error) {
    const code = String(error?.code || '');
    const status = statusFromError(error, Number(error?.status) || 400);
    if (status === 401 || status === 403) {
      return jsonResponse({ ok: false, error: 'superadmin_required' }, status, origin, requestUrl);
    }
    console.error('[admin-wholesale]', code, error?.message || error);
    return jsonResponse({
      ok: false,
      error: PUBLIC_CODES.has(code) ? code : 'wholesale_update_failed',
      ...(Number.isInteger(error?.line) ? { line: error.line } : {}),
    }, PUBLIC_CODES.has(code) ? status : 500, origin, requestUrl);
  }
}
