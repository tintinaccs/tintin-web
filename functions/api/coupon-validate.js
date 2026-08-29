// =============================================================
// TINTIN — Vista previa de cupón para el checkout (sin autoridad)
// =============================================================
// Este endpoint sólo sirve para que la clienta vea el descuento ANTES de
// confirmar el pedido. La aplicación real y el descuento de usedCount pasan
// por CrearPedido.gs dentro de la misma transacción que crea el pedido — ver
// coupons/{code} en firestore.rules: no hay lectura pública de la colección,
// así que esta ruta usa la cuenta de servicio (igual que public-catalog.js)
// para resolver un único código sin exponer el resto.
import { firestoreAdminGet, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';

function normalizeCode(value) {
  return String(value == null ? '' : value).trim().toUpperCase().slice(0, 40);
}

function computeDiscount(coupon, subtotal) {
  if (coupon.type === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(coupon.value) || 0));
    return Math.min(subtotal, Math.round((subtotal * pct) / 100));
  }
  return Math.min(subtotal, Math.max(0, Math.round(Number(coupon.value) || 0)));
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, request.url);

  try {
    await requireFirebaseUser(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 2 * 1024) throw new Error('invalid_request');
    const input = JSON.parse(raw);

    const code = normalizeCode(input.code);
    const subtotal = Math.max(0, Math.round(Number(input.subtotal)));
    if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code) || !Number.isFinite(subtotal)) {
      return jsonResponse({ ok: false, error: 'coupon_invalid' }, 200, origin, request.url);
    }

    const doc = await firestoreAdminGet(env, `coupons/${encodeURIComponent(code)}`);
    if (!doc) return jsonResponse({ ok: false, error: 'coupon_not_found' }, 200, origin, request.url);
    const coupon = decodeFirestoreFields(doc.fields || {});

    if (coupon.active !== true) return jsonResponse({ ok: false, error: 'coupon_inactive' }, 200, origin, request.url);
    if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) {
      return jsonResponse({ ok: false, error: 'coupon_expired' }, 200, origin, request.url);
    }
    if (Number.isFinite(coupon.maxUses) && coupon.maxUses !== null && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
      return jsonResponse({ ok: false, error: 'coupon_limit_reached' }, 200, origin, request.url);
    }
    const minPurchase = Math.max(0, Number(coupon.minPurchase) || 0);
    if (subtotal < minPurchase) {
      return jsonResponse({ ok: false, error: 'coupon_min_purchase', minPurchase }, 200, origin, request.url);
    }

    const discount = computeDiscount(coupon, subtotal);
    return jsonResponse({
      ok: true,
      code,
      type: coupon.type === 'percent' ? 'percent' : 'fixed',
      value: Number(coupon.value) || 0,
      discount,
    }, 200, origin, request.url);
  } catch (error) {
    console.error('[coupon-validate]', error?.message || error);
    const status = Number(error?.status) || 400;
    return jsonResponse({ ok: false, error: 'coupon_validate_failed' }, status, origin, request.url);
  }
}
