// =============================================================
// TINTIN — Notificación de prueba (sólo Super Admin)
// =============================================================
// El título y el cuerpo los define el servidor: el navegador no puede
// mandar texto arbitrario a los dispositivos registrados.

import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError
} from '../../cloudflare/seguridad-cloudinary.js';
import { cleanText, sanitizeError } from '../../cloudflare/nucleo-push.js';
import { pushEnabled, sendTestPush } from '../../cloudflare/servicio-push.js';

const MAX_BODY_BYTES = 2000;
const RATE_LIMIT_MS = 20 * 1000;

// Límite de frecuencia por cuenta dentro de la misma instancia del worker.
// Alcanza para lo que tiene que evitar (tocar el botón varias veces seguidas);
// no pretende ser una defensa contra un atacante, que igual necesitaría una
// sesión válida de Super Admin para llegar hasta acá.
const lastTestByUid = new Map();

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, requestUrl);
  }
  if (!pushEnabled(env)) {
    return jsonResponse({ success: false, error: 'Las notificaciones están desactivadas.' }, 503, origin, requestUrl);
  }

  let user;
  try {
    user = await requireSuperAdmin(request);
  } catch (error) {
    return jsonResponse({ success: false, error: sanitizeError(error, 160) }, statusFromError(error, 401), origin, requestUrl);
  }

  const now = Date.now();
  const previous = lastTestByUid.get(user.uid) || 0;
  if (now - previous < RATE_LIMIT_MS) {
    return jsonResponse({
      success: false,
      error: 'Esperá unos segundos antes de enviar otra prueba.'
    }, 429, origin, requestUrl);
  }
  lastTestByUid.set(user.uid, now);

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) throw new Error('Solicitud demasiado grande.');
    const body = rawBody ? JSON.parse(rawBody) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Solicitud inválida.');
    if (Object.keys(body).some(key => !['scope', 'token'].includes(key))) {
      throw new Error('La solicitud tiene campos no permitidos.');
    }

    const scope = cleanText(body.scope, 20) || 'device';
    if (!['device', 'all'].includes(scope)) throw new Error('Alcance no permitido.');
    const token = cleanText(body.token, 400);
    if (scope === 'device' && !token) throw new Error('Falta el dispositivo actual.');

    const result = await sendTestPush(env, { onlyToken: scope === 'device' ? token : '' });
    if (result.error === 'no_devices') {
      return jsonResponse({
        success: false,
        error: 'No hay dispositivos activos para este envío.',
        attempted: 0,
        successCount: 0,
        failureCount: 0,
        disabledCount: 0
      }, 409, origin, requestUrl);
    }

    return jsonResponse({
      success: result.ok,
      error: result.ok ? '' : (result.lastError || 'Firebase no pudo entregar la notificación. Revisá el dispositivo activo y la configuración de FCM.'),
      attempted: result.attempted || 0,
      successCount: result.successCount || 0,
      failureCount: result.failureCount || 0,
      disabledCount: result.disabledCount || 0,
      lastError: result.lastError || ''
    }, result.ok ? 200 : 502, origin, requestUrl);
  } catch (error) {
    return jsonResponse({ success: false, error: sanitizeError(error, 200) }, 400, origin, requestUrl);
  }
}
