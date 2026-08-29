import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser
} from '../../cloudflare/seguridad-cloudinary.js';
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { isReservedUsername, usernameKey } from '../../js/components/forms/utilidades-username.js';

function clean(value, maxLength = 20) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

/**
 * Único oráculo público de disponibilidad: no expone UID, email ni si la
 * cuenta propietaria existe. Requiere una sesión verificada porque este
 * control solo vive dentro del alta, después de iniciar sesión.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ available: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ available: false, error: 'method_not_allowed' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const raw = clean(body?.username);
    const key = usernameKey(raw);
    if (!key || isReservedUsername(raw)) {
      return jsonResponse({ available: false, valid: false }, 200, origin, requestUrl);
    }

    const reservation = await firestoreAdminGet(env, `usernameReservations/${encodeURIComponent(key)}`);
    const owner = reservation ? String(decodeFirestoreFields(reservation.fields)?.uid || '') : '';
    return jsonResponse({ available: !owner || owner === user.uid, valid: true }, 200, origin, requestUrl);
  } catch (error) {
    const message = clean(error?.message || 'No se pudo comprobar el nombre.', 160);
    return jsonResponse({ available: false, error: message }, /sesión/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
