import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import { syncUserToSheetsBestEffort } from '../../cloudflare/admin-mirror-sheets-sync.js';

function clean(value, max = 220) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * Empuja el perfil canónico del usuario autenticado a las superficies espejo.
 * El navegador nunca manda los datos del perfil: el servidor relee
 * users/{uid} en Firestore después del commit para impedir payloads parciales,
 * obsoletos o manipulados.
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
    const result = await syncUserToSheetsBestEffort(env, user.uid);
    // La réplica es best-effort: Firestore ya confirmó el dato. Si Google
    // falla, el reconciliador de paridad lo recupera sin hacer fallar la UI.
    return jsonResponse({ ok: true, synced: result.ok === true, deferred: result.deferred === true }, 200, origin, requestUrl);
  } catch (error) {
    const message = clean(error?.message || 'No se pudo sincronizar el perfil.');
    return jsonResponse({ ok: false, error: message }, /sesión/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
