import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser
} from '../../cloudflare/seguridad-cloudinary.js';
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { findCountryByCode, phoneKey, isValidPhone } from '../../js/components/forms/utilidades-telefono.js';

function clean(value, maxLength = 32) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

/**
 * Comprueba un teléfono solo para una persona que ya inició sesión.
 * No devuelve UID, correo ni ningún dato de la cuenta propietaria.
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
    const country = findCountryByCode(clean(body?.country, 4));
    const rawPhone = clean(body?.phone);
    if (!rawPhone || !isValidPhone(rawPhone, country)) {
      return jsonResponse({ available: false, valid: false }, 200, origin, requestUrl);
    }
    const key = phoneKey(rawPhone, country);
    const reservation = await firestoreAdminGet(env, `phoneReservations/${encodeURIComponent(key)}`);
    const owner = reservation ? String(decodeFirestoreFields(reservation.fields)?.uid || '') : '';
    return jsonResponse({ available: !owner || owner === user.uid, valid: true }, 200, origin, requestUrl);
  } catch (error) {
    const message = clean(error?.message || 'No se pudo comprobar el teléfono.', 160);
    return jsonResponse({ available: false, error: message }, /sesión/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
