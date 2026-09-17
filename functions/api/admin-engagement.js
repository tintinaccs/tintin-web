import {
  jsonResponse, originIsAllowed, preflightResponse, requireSuperAdmin, statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { adminDeleteLike, adminLikeAction, adminReviewAction } from '../../cloudflare/participacion-admin.js';
import { syncEngagementToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';
import { listCommentReports, updateCommentReport } from '../../cloudflare/comentarios-sociales.js';

const LIKE_ADMIN_ACTIONS = new Set(['likeSeen', 'likeUnread', 'likeArchive', 'likeNote']);

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  try {
    const actor = await requireSuperAdmin(request);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('action') !== 'commentReports') throw new Error('Acción administrativa no permitida');
      const reports = await listCommentReports(env, {
        status: url.searchParams.get('status') || '',
        search: url.searchParams.get('search') || '',
      });
      return jsonResponse({ ok: true, reports }, 200, origin, request.url);
    }
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 16 * 1024) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);

    if (LIKE_ADMIN_ACTIONS.has(input.action)) {
      const record = await adminLikeAction(env, actor, input);
      context.waitUntil?.(syncEngagementToSheets(env, actor.idToken, {
        type: 'like', operation: 'upsert', record,
      }));
      return jsonResponse({ ok: true, record }, 200, origin, request.url);
    }

    if (input.action === 'likeDelete') {
      const record = await adminDeleteLike(env, actor, input.likeId);
      context.waitUntil?.(syncEngagementToSheets(env, actor.idToken, {
        type: 'like', operation: 'trash', record,
      }));
      return jsonResponse({ ok: true, record }, 200, origin, request.url);
    }

    if (input.action === 'commentReportStatus') {
      const report = await updateCommentReport(env, actor, input);
      return jsonResponse({ ok: true, report }, 200, origin, request.url);
    }

    const record = await adminReviewAction(env, actor, input);
    context.waitUntil?.(syncEngagementToSheets(env, actor.idToken, {
      type: 'review', operation: record.deleted ? 'trash' : 'upsert', record,
    }));
    return jsonResponse({ ok: true, record }, 200, origin, request.url);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) },
      statusFromError(error, error?.code === 'version_conflict' ? 409 : 400),
      origin,
      request.url,
    );
  }
}
