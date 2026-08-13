import {
  jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import { adminReviewAction, markLikeSeen } from '../../cloudflare/participacion-admin.js';
import { syncEngagementToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 8 * 1024) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);
    if (input.action === 'likeSeen') {
      const record = await markLikeSeen(env, input.likeId);
      return jsonResponse({ ok: true, record }, 200, origin, request.url);
    }
    const record = await adminReviewAction(env, actor, input);
    context.waitUntil?.(syncEngagementToSheets(actor.idToken, {
      type: 'review', operation: record.deleted ? 'trash' : 'upsert', record,
    }));
    return jsonResponse({ ok: true, record }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) }, error?.code === 'version_conflict' ? 409 : 400, origin, request.url);
  }
}
