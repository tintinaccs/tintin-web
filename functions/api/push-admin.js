// =============================================================
// TINTIN — Módulo maestro de Web Push (sólo Super Admin)
// =============================================================
// El navegador sólo recibe metadatos: nunca devuelve tokens completos ni
// credenciales. Las operaciones destructivas pasan por la cuenta de servicio.

import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/seguridad-cloudinary.js';
import { cleanText, sanitizeError } from '../../cloudflare/nucleo-push.js';
import {
  listAdminDevices,
  readPushSettings,
  revokeAllDevices,
  revokeDeviceByDocumentId,
  savePushSettings
} from '../../cloudflare/servicio-push.js';

const MAX_BODY_BYTES = 4000;
const ALLOWED_ACTIONS = ['list', 'revoke', 'revoke-all', 'save-settings'];

function parseBody(raw) {
  if (raw.length > MAX_BODY_BYTES) throw new Error('Solicitud demasiado grande.');
  const body = raw ? JSON.parse(raw) : {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Solicitud inválida.');
  if (Object.keys(body).some(key => !['action', 'deviceId', 'enabled', 'foregroundSound', 'foregroundSoundUrl'].includes(key))) {
    throw new Error('La solicitud tiene campos no permitidos.');
  }
  return body;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, POST, OPTIONS');
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, requestUrl);

  try {
    const user = await requireSuperAdmin(request);
    if (request.method === 'GET') {
      return jsonResponse({ success: true, devices: await listAdminDevices(env), settings: await readPushSettings(env) }, 200, origin, requestUrl);
    }
    const body = parseBody(await request.text());
    const action = cleanText(body.action, 20);
    if (!ALLOWED_ACTIONS.includes(action)) throw new Error('Acción no permitida.');
    if (action === 'list') return jsonResponse({ success: true, devices: await listAdminDevices(env), settings: await readPushSettings(env) }, 200, origin, requestUrl);
    if (action === 'revoke') {
      const result = await revokeDeviceByDocumentId(env, body.deviceId);
      return jsonResponse({ success: true, ...result }, 200, origin, requestUrl);
    }
    if (action === 'revoke-all') {
      const result = await revokeAllDevices(env);
      return jsonResponse({ success: true, ...result }, 200, origin, requestUrl);
    }
    const settings = await savePushSettings(env, {
      enabled: body.enabled !== false,
      foregroundSound: cleanText(body.foregroundSound, 20),
      foregroundSoundUrl: cleanText(body.foregroundSoundUrl, 500),
      updatedBy: user.email
    });
    return jsonResponse({ success: true, settings }, 200, origin, requestUrl);
  } catch (error) {
    const status = /Super Admin|autenticación|sesión|verificado/i.test(String(error?.message || '')) ? 401 : 400;
    return jsonResponse({ success: false, error: sanitizeError(error, 220) }, status, origin, requestUrl);
  }
}
