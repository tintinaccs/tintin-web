// Cupones de envío gratis. Única fuente de la regla: la usan el checkout
// (preparePublicCheckoutOrder), la creación atómica del pedido y el endpoint
// de validación. Los documentos `coupons/{CODIGO}` los administra sólo la
// super admin; `couponRedemptions/{CODIGO}__{uid}` los escribe sólo el servidor.

export const COUPON_TYPE_FREE_SHIPPING = 'free_shipping';
const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
const PY_OFFSET = '-03:00';

export function normalizeCouponCode(value) {
  const code = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '');
  return COUPON_CODE_PATTERN.test(code) ? code : '';
}

export function couponDocPath(code) {
  return `coupons/${encodeURIComponent(code)}`;
}

export function redemptionDocId(code, uid) {
  return `${code}__${uid}`;
}

export function redemptionDocPath(code, uid) {
  return `couponRedemptions/${encodeURIComponent(redemptionDocId(code, uid))}`;
}

function parseBoundary(value, endOfDay) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}${PY_OFFSET}`
    : text;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : NaN;
}

function limit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0; // 0 = sin límite
}

/**
 * Evalúa un cupón ya leído de Firestore (campos decodificados).
 * Devuelve { ok: true, shippingDiscount } o { ok: false, code }.
 */
export function evaluateCoupon(coupon, redemption, { now = Date.now(), shippingCost = 0 } = {}) {
  if (!coupon) return { ok: false, code: 'coupon_not_found' };
  if (coupon.active !== true || coupon.type !== COUPON_TYPE_FREE_SHIPPING) return { ok: false, code: 'coupon_inactive' };
  const startsAt = parseBoundary(coupon.startsAt, false);
  const endsAt = parseBoundary(coupon.endsAt, true);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return { ok: false, code: 'coupon_inactive' };
  if (startsAt !== null && now < startsAt) return { ok: false, code: 'coupon_not_started' };
  if (endsAt !== null && now > endsAt) return { ok: false, code: 'coupon_expired' };
  const maxUses = limit(coupon.maxUses);
  if (maxUses && Number(coupon.usedCount || 0) >= maxUses) return { ok: false, code: 'coupon_exhausted' };
  const perCustomer = limit(coupon.maxUsesPerCustomer);
  if (perCustomer && Number(redemption?.count || 0) >= perCustomer) return { ok: false, code: 'coupon_customer_limit' };
  if (!(shippingCost > 0)) return { ok: false, code: 'coupon_not_applicable' };
  return { ok: true, shippingDiscount: shippingCost };
}

export const COUPON_ERROR_MESSAGES = Object.freeze({
  coupon_not_found: 'El cupón no existe.',
  coupon_inactive: 'El cupón no está activo.',
  coupon_not_started: 'El cupón todavía no está vigente.',
  coupon_expired: 'El cupón venció.',
  coupon_exhausted: 'El cupón ya alcanzó su límite de usos.',
  coupon_customer_limit: 'Ya usaste este cupón el máximo de veces permitido.',
  coupon_not_applicable: 'El cupón de envío gratis solo aplica a envíos con costo.',
  coupon_invalid: 'El código del cupón no es válido.',
});
