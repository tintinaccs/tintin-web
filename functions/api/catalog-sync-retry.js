import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { retryPendingCatalogSheets } from '../../cloudflare/resiliencia-sync-catalogo.js';

function bearerToken(request) {
  const match = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (origin && !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  }

  try {
    await requireSuperAdmin(request);
    const idToken = bearerToken(request);
    if (!idToken) return jsonResponse({ ok: false, error: 'Falta la sesión.' }, 401, origin, requestUrl);
    const result = await retryPendingCatalogSheets(env, idToken, { force: true });
    return jsonResponse({ ok: true, result }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[catalog-sync-retry]', error?.message || error);
    return jsonResponse({
      ok: false,
      error: 'No se pudo reintentar la reconciliación de Google Sheets.',
    }, statusFromError(error), origin, requestUrl);
  }
}
