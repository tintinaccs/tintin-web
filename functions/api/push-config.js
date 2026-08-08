// =============================================================
// TINTIN — Configuración pública de Web Push (sólo Super Admin)
// =============================================================
// Devuelve únicamente la clave VAPID pública. Es pública por definición
// (viaja igual dentro del navegador al pedir el token FCM), pero se sirve
// desde acá y no incrustada en el HTML para que renovarla sea cambiar una
// variable de Cloudflare y nada más. La cuenta de servicio y el secreto
// del webhook NO salen nunca por esta respuesta.

import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/seguridad-cloudinary.js';
import { pushEnabled } from '../../cloudflare/servicio-push.js';
import { cleanText, sanitizeError } from '../../cloudflare/nucleo-push.js';

const DENIED = 'Solo el Super Admin puede configurar las notificaciones';

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'GET, OPTIONS');
  }
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, requestUrl);
  }

  try {
    await requireSuperAdmin(request, DENIED);
  } catch (error) {
    return jsonResponse({ success: false, error: sanitizeError(error, 160) }, 401, origin, requestUrl);
  }

  const vapidKey = cleanText(env.FIREBASE_WEB_PUSH_VAPID_KEY, 200);
  if (!vapidKey) {
    return jsonResponse({
      success: false,
      error: 'Falta configurar FIREBASE_WEB_PUSH_VAPID_KEY en Cloudflare.'
    }, 503, origin, requestUrl);
  }

  return jsonResponse({
    success: true,
    vapidKey,
    enabled: pushEnabled(env),
    serviceWorkerPath: '/firebase-messaging-sw.js'
  }, 200, origin, requestUrl);
}
