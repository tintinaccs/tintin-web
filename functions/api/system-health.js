import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import { runSystemHealth } from '../../cloudflare/system-health.js';

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (origin && !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'GET, OPTIONS');
  }
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  }

  try {
    await requireSuperAdmin(request);
    const report = await runSystemHealth(env);
    return jsonResponse({ ok: true, report }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[system-health]', error?.message || error);
    const authFailure = /sesión|super admin|correo verificado/i.test(String(error?.message || ''));
    return jsonResponse({
      ok: false,
      error: authFailure
        ? 'La sesión no corresponde al Super Admin autorizado.'
        : 'No se pudo consultar el estado operativo del ecosistema.',
    }, authFailure ? 401 : 500, origin, requestUrl);
  }
}
