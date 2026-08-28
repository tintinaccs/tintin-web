import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import { applyUserLifecycle } from '../../cloudflare/user-lifecycle-domain.js';

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
    const result = await applyUserLifecycle(env, {
      uid: body.uid,
      action: body.action || 'softDelete',
      reason: body.reason,
      actorId: actor.uid,
      actorEmail: actor.email,
      actorRole: 'superadmin',
      origin: 'superadmin',
      changeId: body.changeId,
      baseChangeId: body.baseChangeId,
    });

    return jsonResponse({ ok: true, ...result }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-delete-user]', error?.message || error);
    const message = safeText(error?.message, 300);
    const safeMessage = /^(Solicitud inválida|Usuario o acción inválidos|No se encontró la identidad solicitada|La cuenta Super Admin está protegida|La cuenta no está eliminada|La cuenta cambió después de la última sincronización\. Actualizá la hoja antes de volver a editar)\.?$/.test(message)
      ? message
      : 'No se pudo actualizar el estado de la cuenta.';
    return jsonResponse({ ok: false, error: safeMessage }, Number(error?.status) === 409 ? 409 : 400, origin, requestUrl);
  }
}
