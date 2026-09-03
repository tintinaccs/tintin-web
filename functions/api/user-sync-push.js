import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser,
  SUPERADMIN_EMAIL,
} from '../../cloudflare/seguridad-cloudinary.js';
import { syncUserToSheetsBestEffort } from '../../cloudflare/admin-mirror-sheets-sync.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

function clean(value, max = 220) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * Empuja a Sheets el perfil canónico indicado. Una cuenta normal solo puede
 * pedir su propio UID; SuperAdmin puede indicar targetUid para que sus cambios
 * administrativos directos se reflejen inmediatamente sin enviar datos del
 * perfil por el navegador. Cloudflare siempre relee users/{uid} de Firestore.
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
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (raw && new TextEncoder().encode(raw).byteLength > 2048) {
      return jsonResponse({ ok: false, error: 'request_too_large' }, 400, origin, requestUrl);
    }
    const body = raw ? JSON.parse(raw) : {};
    const requestedUid = clean(body?.targetUid, 128);
    const targetUid = requestedUid || user.uid;
    if (!UID_PATTERN.test(targetUid)) {
      return jsonResponse({ ok: false, error: 'invalid_uid' }, 400, origin, requestUrl);
    }
    const isSuperAdmin = clean(user.email, 254).toLowerCase() === SUPERADMIN_EMAIL;
    if (targetUid !== user.uid && !isSuperAdmin) {
      return jsonResponse({ ok: false, error: 'forbidden_target' }, 403, origin, requestUrl);
    }

    const result = await syncUserToSheetsBestEffort(env, targetUid);
    // La réplica es best-effort: Firestore ya confirmó el dato. Si Google
    // falla, el reconciliador de paridad lo recupera sin hacer fallar la UI.
    return jsonResponse({
      ok: true,
      uid: targetUid,
      synced: result.ok === true,
      deferred: result.deferred === true,
    }, 200, origin, requestUrl);
  } catch (error) {
    const message = clean(error?.message || 'No se pudo sincronizar el perfil.');
    return jsonResponse({ ok: false, error: message }, /sesión/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
