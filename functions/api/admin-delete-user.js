import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import { applyUserLifecycle, purgeUserByEmail } from '../../cloudflare/user-lifecycle-domain.js';
import { syncEngagementBatchToSheets } from '../../cloudflare/sincronizacion-participacion-sheets.js';

const SAFE_ERRORS = /^(Solicitud inválida|Usuario o acción inválidos|Correo inválido|No se encontró la identidad solicitada|La cuenta Super Admin está protegida|La cuenta no está eliminada|La cuenta cambió después de la última sincronización\. Actualizá la hoja antes de volver a editar|Hay demasiados registros de participación para purgar la cuenta de forma segura|Hay demasiadas cuentas con ese correo; eliminalas desde la lista|Quedan documentos por borrar; reintentá la operación)\.?$/;

function safeText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || raw.length > 3000) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    const options = {
      reason: body.reason,
      actorId: actor.uid,
      actorEmail: actor.email,
      actorRole: 'superadmin',
      origin: 'superadmin',
      changeId: body.changeId,
      baseChangeId: body.baseChangeId,
    };
    const { sheetEvents, ...result } = body.email && !body.uid
      ? await purgeUserByEmail(env, { ...options, email: body.email })
      : await applyUserLifecycle(env, { ...options, uid: body.uid, action: body.action || 'delete' });
    // La hoja de participación se actualiza después de responder; si falla,
    // la cola de reintentos existente vuelve a intentarlo.
    if (sheetEvents?.length) {
      context.waitUntil?.(syncEngagementBatchToSheets(env, sheetEvents).catch(syncError => {
        console.error('[admin-delete-user] sheets sync failed', syncError?.message || syncError);
      }));
    }

    return jsonResponse({ ok: true, ...result }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-delete-user]', error?.message || error);
    const message = safeText(error?.message, 300);
    const safeMessage = SAFE_ERRORS.test(message)
      ? message
      : 'No se pudo actualizar el estado de la cuenta.';
    return jsonResponse({ ok: false, error: safeMessage }, statusFromError(error, 400), origin, requestUrl);
  }
}
