import { jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin } from '../../../cloudflare/seguridad-cloudinary.js';

/**
 * El Estudio prepara rama, PR, checks y preview, pero deliberadamente no
 * fusiona. El merge es el límite de aprobación humana y se realiza en GitHub.
 */
export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    if (!origin || !originIsAllowed(origin, request.url)) throw Object.assign(new Error('Origen no autorizado'), { status: 403 });
    await requireSuperAdmin(request);
    return jsonResponse({
      ok: false,
      code: 'human_merge_required',
      error: 'La fusión está reservada a revisión humana en GitHub después de checks y preview.'
    }, 403, origin, request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'Acceso denegado').slice(0, 500) }, Number(error?.status) || 403, origin, request.url);
  }
}
