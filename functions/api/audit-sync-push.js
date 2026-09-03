import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import { syncAuditToSheetsBestEffort } from '../../cloudflare/admin-mirror-sheets-sync.js';

const EVENT_ID_PATTERN = /^[A-Za-z0-9:_-]{6,220}$/;

function clean(value, max = 220) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * Replica un evento de auditLog a Auditoría web. Solo SuperAdmin puede pedir
 * un eventId arbitrario; el endpoint relee el documento canónico y nunca
 * acepta el contenido de auditoría desde el navegador.
 */
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
    await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 2048) {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400, origin, requestUrl);
    }
    const body = JSON.parse(raw);
    const eventId = clean(body?.eventId);
    if (!EVENT_ID_PATTERN.test(eventId)) {
      return jsonResponse({ ok: false, error: 'invalid_event_id' }, 400, origin, requestUrl);
    }
    const result = await syncAuditToSheetsBestEffort(env, eventId);
    return jsonResponse({
      ok: true,
      eventId,
      synced: result.ok === true,
      deferred: result.deferred === true,
    }, 200, origin, requestUrl);
  } catch (error) {
    const message = clean(error?.message || 'No se pudo sincronizar la auditoría.');
    return jsonResponse({ ok: false, error: message }, /sesión|super admin/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
