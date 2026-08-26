// =============================================================
// TINTIN — Registro seguro de dispositivos para Web Push
// =============================================================
// El navegador NUNCA escribe el token en Firestore: lo manda acá y esta
// función lo guarda con credenciales de servidor en adminPushDevices, una
// colección que las reglas de Firestore niegan a cualquier cliente.
// En esta primera versión sólo el Super Admin puede registrar dispositivos.

import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/seguridad-cloudinary.js';
import { cleanText, sanitizeError } from '../../cloudflare/nucleo-push.js';
import {
  deviceStatus,
  pushEnabled,
  registerDevice,
  unregisterDevice
} from '../../cloudflare/servicio-push.js';

const MAX_BODY_BYTES = 6000;
const ALLOWED_FIELDS = ['action', 'deviceId', 'deviceLabel', 'token', 'platform', 'userAgent'];
const ALLOWED_ACTIONS = ['register', 'unregister', 'status'];
const ALLOWED_PLATFORMS = ['ios', 'android', 'desktop', 'otro'];

function parseBody(rawBody) {
  if (rawBody.length > MAX_BODY_BYTES) throw new Error('Solicitud demasiado grande.');
  let body;
  try { body = JSON.parse(rawBody || '{}'); } catch { throw new Error('Solicitud inválida.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Solicitud inválida.');
  if (Object.keys(body).some(key => !ALLOWED_FIELDS.includes(key))) {
    throw new Error('La solicitud tiene campos no permitidos.');
  }
  return body;
}

function validDeviceId(value) {
  return /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

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
    return jsonResponse({ success: false, error: sanitizeError(error, 160) }, 401, origin, requestUrl);
  }

  try {
    const body = parseBody(await request.text());
    const action = cleanText(body.action, 20);
    if (!ALLOWED_ACTIONS.includes(action)) throw new Error('Acción no permitida.');

    const deviceId = cleanText(body.deviceId, 64);
    if (!validDeviceId(deviceId)) throw new Error('Identificador de dispositivo inválido.');

    if (action === 'status') {
      const status = await deviceStatus(env, { uid: user.uid, deviceId });
      return jsonResponse({ success: true, ...status }, 200, origin, requestUrl);
    }

    if (action === 'unregister') {
      const result = await unregisterDevice(env, { uid: user.uid, deviceId });
      return jsonResponse({ success: true, registered: false, found: result.found }, 200, origin, requestUrl);
    }

    const token = cleanText(body.token, 400);
    if (!/^[A-Za-z0-9_:.\-]{60,400}$/.test(token)) throw new Error('Token de notificación inválido.');

    const platformRaw = cleanText(body.platform, 20).toLowerCase();
    const platform = ALLOWED_PLATFORMS.includes(platformRaw) ? platformRaw : 'otro';

    const saved = await registerDevice(env, {
      uid: user.uid,
      email: user.email,
      deviceId,
      deviceLabel: cleanText(body.deviceLabel, 60) || 'Dispositivo de Tintin',
      token,
      platform,
      // Se recorta a 120 caracteres: alcanza para reconocer el navegador y no
      // convierte el documento en un registro de rastreo. No se guarda la IP.
      userAgent: cleanText(body.userAgent, 120)
    });

    return jsonResponse({
      success: true,
      registered: true,
      // Huella corta del token para poder diferenciar dispositivos en el panel
      // sin exponer nunca el token completo.
      tokenPreview: saved.tokenPreview,
      updatedAt: new Date().toISOString()
    }, 200, origin, requestUrl);
  } catch (error) {
    return jsonResponse({ success: false, error: sanitizeError(error, 200) }, 400, origin, requestUrl);
  }
}
