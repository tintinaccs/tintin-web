import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser
} from '../../cloudflare/seguridad-cloudinary.js';
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import {
  COUPON_ERROR_MESSAGES,
  couponDocPath,
  evaluateCoupon,
  normalizeCouponCode,
  redemptionDocPath
} from '../../cloudflare/cupones.js';

/**
 * Comprueba un cupón para la persona con sesión iniciada. Sólo informa si es
 * válido para ella; el cupón se vuelve a evaluar de forma atómica al crear el
 * pedido, así que esta respuesta es informativa y no reserva ningún uso.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ valid: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ valid: false, error: 'method_not_allowed' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const code = normalizeCouponCode(body?.code);
    if (!code) {
      return jsonResponse({ valid: false, code: 'coupon_invalid', message: COUPON_ERROR_MESSAGES.coupon_invalid }, 200, origin, requestUrl);
    }
    const [couponDoc, redemptionDoc] = await Promise.all([
      firestoreAdminGet(env, couponDocPath(code)),
      firestoreAdminGet(env, redemptionDocPath(code, user.uid)),
    ]);
    // shippingCost: 1 sólo para no evaluar el costo de envío, que aún no se conoce aquí.
    const verdict = evaluateCoupon(
      couponDoc ? decodeFirestoreFields(couponDoc.fields || {}) : null,
      redemptionDoc ? decodeFirestoreFields(redemptionDoc.fields || {}) : null,
      { shippingCost: 1 },
    );
    if (!verdict.ok) {
      return jsonResponse({ valid: false, code: verdict.code, message: COUPON_ERROR_MESSAGES[verdict.code] }, 200, origin, requestUrl);
    }
    return jsonResponse({ valid: true, code, type: 'free_shipping' }, 200, origin, requestUrl);
  } catch (error) {
    const message = String(error?.message || 'No se pudo comprobar el cupón.').slice(0, 160);
    return jsonResponse({ valid: false, error: message }, /sesión/i.test(message) ? 401 : 500, origin, requestUrl);
  }
}
