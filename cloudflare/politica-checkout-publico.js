import { shippingDepartment } from '../js/components/location/departamento-ciudad.mjs';
import { canonicalDeliveryCities, normalizeDeliveryCityName } from '../js/components/location/tarifas-delivery.mjs';
import { decodeFirestoreFields, firestoreAdminGet } from './firebase-admin-ligero.js';
import { SUPERADMIN_EMAIL } from './seguridad-cloudinary.js';
import { isValidRuc, isValidTaxpayerType } from '../js/components/forms/validacion-documentos-py.js';
import {
  COUPON_TYPE_FREE_SHIPPING,
  couponDocPath,
  evaluateCoupon,
  normalizeCouponCode,
  redemptionDocPath,
} from './cupones.js';

// Política del checkout público. El navegador sólo propone un borrador
// (carrito, contacto, entrega y el total que vio); todo lo comercial se
// decide aquí con datos de Firestore: estado y pago siempre "pendiente",
// correo de la cuenta desde el token, costo de envío desde las tarifas, turno
// de compra desde checkoutGuards y precios/variantes desde el producto.
// Es el mismo contrato que aplicaba phase4CreateOrder_ (apps-script/CrearPedido.gs)
// antes de que la creación se moviera a Cloudflare.

const MAX_CART_LINES = 60;
const CHECKOUT_GUARD_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{12,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CI_PATTERN = /^\d{5,8}$/;
const PAYMENT_METHODS = new Set(['efectivo', 'transferencia', 'paypal']);
const CART_LINE_KEYS = new Set(['id', 'qty', 'variant', 'variants']);
const MAP_KEYS = new Set(['lat', 'lng', 'name', 'address']);
const VARIANT_META_KEYS = new Set(['price', 'sku', 'imageUrl', 'stock', 'active']);

function checkoutError(code, status = 400, details = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return isPlainObject(value) && Object.keys(value).every(key => allowed.has(key));
}

function expectedMoneyValid(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1e9;
}

// Mismo parseo que parseMoney() de js/orders/pedido-checkout-seguro.js: el
// costo que calcula el navegador y el del servidor deben coincidir.
function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;
  const parsed = Number(
    String(value == null ? '' : value)
      .replace(/gs\.?/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function normalizeCartLines(cartLines) {
  if (!Array.isArray(cartLines) || !cartLines.length) throw checkoutError('empty_cart');
  if (cartLines.length > MAX_CART_LINES) throw checkoutError('too_many_products');
  const byLine = new Map();
  for (const raw of cartLines) {
    if (!hasOnlyKeys(raw, CART_LINE_KEYS)) throw checkoutError('invalid_cart');
    const legacy = raw.variants;
    if (legacy !== undefined && legacy !== null && (!Array.isArray(legacy) || legacy.length > 1)) {
      throw checkoutError('invalid_cart');
    }
    const legacyVariant = Array.isArray(legacy) && legacy.length ? legacy[0] : '';
    if (legacyVariant && typeof legacyVariant !== 'string') throw checkoutError('invalid_cart');
    if (raw.variant !== undefined && raw.variant !== null && raw.variant !== '' && typeof raw.variant !== 'string') {
      throw checkoutError('invalid_cart');
    }
    const explicitVariant = cleanText(raw.variant, 120);
    const migratedVariant = cleanText(legacyVariant, 120);
    if (explicitVariant && migratedVariant && explicitVariant !== migratedVariant) throw checkoutError('invalid_cart');
    const id = cleanText(raw.id, 180);
    const qty = Number(raw.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) throw checkoutError('invalid_cart');
    const variant = explicitVariant || migratedVariant;
    const key = JSON.stringify([id, variant]);
    const line = byLine.get(key) || { id, qty: 0, variant };
    line.qty += qty;
    if (line.qty > 99) throw checkoutError('invalid_cart');
    byLine.set(key, line);
  }
  return [...byLine.values()];
}

function normalizeMapLocation(value) {
  if (value === null || value === undefined) return null;
  if (!hasOnlyKeys(value, MAP_KEYS)) throw checkoutError('map_invalid');
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw checkoutError('map_invalid');
  }
  return { lat, lng, name: cleanText(value.name, 120), address: cleanText(value.address, 240) };
}

function normalizeCities(list, fallback) {
  return (Array.isArray(list) ? list : [])
    .map((item, sourceIndex) => {
      if (typeof item === 'string') {
        return { name: cleanText(item, 120), price: parseMoney(fallback), departamento: shippingDepartment(item), sourceIndex };
      }
      if (!item?.name) return null;
      const price = item.price === null ? null : parseMoney(item.price === undefined ? fallback : item.price);
      return {
        name: cleanText(item.name, 120),
        price: Number.isFinite(price) ? price : null,
        departamento: shippingDepartment(item.name, cleanText(item.departamento, 80)),
        sourceIndex,
      };
    })
    .filter(city => city?.name);
}

function mergeShippingRates(settings, rates) {
  return {
    deliveryCities: Array.isArray(rates.deliveryCities) ? rates.deliveryCities : settings.deliveryCities,
    encomiendaCities: Array.isArray(rates.encomiendaCities) ? rates.encomiendaCities : settings.encomiendaCities,
    deliveryCost: rates.deliveryCost != null ? rates.deliveryCost : settings.deliveryCost,
    encomiendaCost: rates.encomiendaCost != null ? rates.encomiendaCost : settings.encomiendaCost,
  };
}

function resolveShipping(rates, selectedCity, selectedDepartment, requestedMethod) {
  if (selectedCity === '__retiro__') {
    if (requestedMethod && requestedMethod !== 'retiro') throw checkoutError('shipping_changed');
    return { method: 'retiro', city: 'Retiro coordinado', departamento: 'Central', cost: 0, pending: false, rateIndex: -1 };
  }
  const wanted = normalizeDeliveryCityName(selectedCity).toLocaleLowerCase('es');
  const wantedDepartment = cleanText(selectedDepartment, 80).toLocaleLowerCase('es');
  const matches = city =>
    city.name.toLocaleLowerCase('es') === wanted &&
    (!wantedDepartment || city.departamento.toLocaleLowerCase('es') === wantedDepartment);

  const delivery = requestedMethod && requestedMethod !== 'delivery'
    ? null
    : canonicalDeliveryCities(normalizeCities(rates.deliveryCities, rates.deliveryCost)).find(matches);
  if (delivery) {
    return {
      method: 'delivery',
      city: delivery.name,
      departamento: delivery.departamento,
      cost: delivery.price,
      pending: delivery.price === null,
      rateIndex: delivery.sourceIndex,
    };
  }
  const encomienda = requestedMethod && requestedMethod !== 'encomienda'
    ? null
    : normalizeCities(rates.encomiendaCities, rates.encomiendaCost).find(matches);
  if (encomienda) {
    return {
      method: 'encomienda',
      city: encomienda.name,
      departamento: encomienda.departamento,
      cost: 0,
      pending: false,
      rateIndex: encomienda.sourceIndex,
    };
  }
  throw checkoutError('shipping_invalid');
}

function variantGroups(value) {
  const groups = [];
  const positions = new Map();
  const add = (rawKey, rawValue) => {
    const key = cleanText(rawKey, 60);
    if (!key) return;
    const values = Array.isArray(rawValue) ? rawValue : String(rawValue == null ? '' : rawValue).split(',');
    const options = [...new Set(values.map(option => cleanText(option, 120)).filter(Boolean))];
    if (!options.length) return;
    if (!positions.has(key)) {
      positions.set(key, groups.length);
      groups.push([]);
    }
    const target = groups[positions.get(key)];
    for (const option of options) if (!target.includes(option)) target.push(option);
  };
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      if (!isPlainObject(item)) continue;
      for (const key of Object.keys(item)) if (!VARIANT_META_KEYS.has(key)) add(key, item[key]);
    }
  } else if (isPlainObject(value)) {
    for (const key of Object.keys(value).slice(0, 20)) add(key, value[key]);
  }
  return groups;
}

export function variantIsValid(product, selectedVariant) {
  const groups = variantGroups(product?.variants);
  const selected = cleanText(selectedVariant, 120);
  if (!groups.length) return !selected;
  if (!selected) return false;
  const parts = selected.split('/').map(part => cleanText(part, 120)).filter(Boolean);
  return parts.length === groups.length && parts.every((part, index) => groups[index].includes(part));
}

async function readDocument(env, get, path) {
  const document = await get(env, path);
  return document ? decodeFirestoreFields(document.fields || {}) : null;
}

/**
 * Convierte el borrador del navegador en la entrada canónica de
 * createOrderAdmin. Devuelve `inspect`, que createOrderAdmin ejecuta con los
 * productos y totales leídos de Firestore antes de escribir nada.
 */
export async function preparePublicCheckoutOrder(env, payload, authenticatedUser, { get = firestoreAdminGet } = {}) {
  const uid = cleanText(authenticatedUser?.uid, 128);
  const accountEmail = cleanText(authenticatedUser?.email, 254).toLowerCase();
  if (!uid) throw checkoutError('invalid_id_token', 401);

  const requestId = cleanText(payload?.requestId, 100);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw checkoutError('invalid_request_id');
  const orderId = `public_${uid}_${requestId}`;
  const guardOrderId = `${uid}_${requestId}`;

  const cartLines = normalizeCartLines(payload.cartLines);
  const name = cleanText(payload.name, 120);
  if (name.length < 2) throw checkoutError('name_required');
  const paymentMethod = String(payload.paymentMethod || '');
  if (!PAYMENT_METHODS.has(paymentMethod)) throw checkoutError('payment_required');
  const phone = cleanText(payload.phone, 40);
  if (!/^\d{8,20}$/.test(phone)) throw checkoutError('phone_invalid');
  const contactEmail = cleanText(payload.contactEmail, 254).toLowerCase() || accountEmail;
  if (contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail)) throw checkoutError('email_invalid');
  const selectedCity = cleanText(payload.selectedCity, 120);
  if (!selectedCity) throw checkoutError('shipping_invalid');
  if (
    !expectedMoneyValid(payload.expectedSubtotal) ||
    !expectedMoneyValid(payload.expectedShippingCost) ||
    typeof payload.expectedShippingPending !== 'boolean' ||
    !expectedMoneyValid(payload.expectedTotal)
  ) {
    throw checkoutError('invalid_quote');
  }
  const mapLocation = normalizeMapLocation(payload.mapLocation);

  const baseInput = {
    orderId,
    requestId,
    items: cartLines,
    userName: name,
    status: 'pendiente',
    paymentStatus: 'pendiente',
    paymentMethod,
    customerId: `CUS_${uid}`,
    userId: uid,
    accountEmail,
    contactEmail,
  };

  // Reintento idempotente: el pedido ya existe y createOrderAdmin lo devuelve
  // como duplicado sin volver a validar ni escribir.
  if (await get(env, `orders/${encodeURIComponent(orderId)}`)) return { input: baseInput, inspect: null };

  const [settings, shippingRates, guard] = await Promise.all([
    readDocument(env, get, 'settings/general'),
    readDocument(env, get, 'settings/shippingRates'),
    readDocument(env, get, `checkoutGuards/${encodeURIComponent(uid)}`),
  ]);
  if (!settings) throw checkoutError('settings_missing', 503);

  if (accountEmail !== SUPERADMIN_EMAIL) {
    if (settings.storeOpen !== true) throw checkoutError('store_closed', 409);
    if (!guard || cleanText(guard.lastCheckoutOrderId, 260) !== guardOrderId) throw checkoutError('checkout_guard_missing', 409);
    const guardAt = Date.parse(guard.lastCheckoutAt || '');
    if (!Number.isFinite(guardAt) || Date.now() - guardAt > CHECKOUT_GUARD_WINDOW_MS) {
      throw checkoutError('checkout_guard_expired', 409);
    }
  }

  if (paymentMethod === 'paypal' && settings.paypal?.enabled !== true) throw checkoutError('payment_unavailable', 409);
  if (paymentMethod !== 'paypal' && settings.paymentMethods?.[paymentMethod] === false) {
    throw checkoutError('payment_unavailable', 409);
  }

  const requestedMethod = cleanText(payload.shippingMethod, 20);
  const shipping = resolveShipping(
    mergeShippingRates(settings, shippingRates || {}),
    selectedCity,
    payload.departamento,
    requestedMethod,
  );
  if (requestedMethod !== shipping.method) throw checkoutError('shipping_changed', 409);
  if ((shipping.method === 'encomienda' && paymentMethod !== 'transferencia') || (paymentMethod === 'efectivo' && shipping.method !== 'delivery')) throw checkoutError('payment_unavailable', 409);

  const encomiendaMode = cleanText(payload.encomiendaMode, 20);
  if (shipping.method !== 'encomienda' && encomiendaMode) throw checkoutError('shipping_invalid');
  if (shipping.method === 'encomienda' && encomiendaMode !== 'agencia' && encomiendaMode !== 'puerta') {
    throw checkoutError('shipping_invalid');
  }
  const address = cleanText(payload.address, 300);
  const referencia = cleanText(payload.referencia, 300);
  const doorDelivery = shipping.method === 'encomienda' && encomiendaMode === 'puerta';
  if (shipping.method === 'delivery' && !mapLocation?.name) throw checkoutError('map_required');
  if (shipping.method === 'delivery' && referencia.length < 5) throw checkoutError('reference_required');
  if (doorDelivery) {
    if (address.length < 5) throw checkoutError('address_required');
    if (!mapLocation?.name) throw checkoutError('map_required');
  }

  const ci = cleanText(payload.ci, 8);
  if (shipping.method === 'encomienda' && !CI_PATTERN.test(ci)) throw checkoutError('ci_invalid');
  const wantsInvoice = payload.wantsInvoice === true;
  const razonSocial = cleanText(payload.razonSocial, 180);
  const ruc = cleanText(payload.ruc, 40).replace(/\s/g, '');
  if (wantsInvoice && razonSocial.length < 3) throw checkoutError('razon_social_required');
  if (wantsInvoice && !isValidRuc(ruc)) throw checkoutError('ruc_invalid');
  const taxpayerType = cleanText(payload.taxpayerType, 20);
  if (wantsInvoice && !isValidTaxpayerType(taxpayerType)) throw checkoutError('taxpayer_type_required');

  const keepsAddress = shipping.method === 'delivery' || doorDelivery;
  const baseShippingCost = shipping.cost === null ? 0 : shipping.cost;
  let shippingCost = baseShippingCost;
  let coupon = null;
  const rawCoupon = cleanText(payload.couponCode, 64);
  if (rawCoupon) {
    const code = normalizeCouponCode(rawCoupon);
    if (!code) throw checkoutError('coupon_invalid');
    const [couponDoc, redemption] = await Promise.all([
      readDocument(env, get, couponDocPath(code)),
      readDocument(env, get, redemptionDocPath(code, uid)),
    ]);
    const verdict = evaluateCoupon(couponDoc, redemption, {
      shippingCost: shipping.pending ? 0 : baseShippingCost,
    });
    if (!verdict.ok) throw checkoutError(verdict.code, 422);
    shippingCost = baseShippingCost - verdict.shippingDiscount;
    coupon = { code, type: COUPON_TYPE_FREE_SHIPPING, shippingDiscount: verdict.shippingDiscount };
  }
  const input = {
    ...baseInput,
    userPhone: phone,
    notes: cleanText(payload.notes, 1000),
    ci: shipping.method === 'encomienda' ? ci : '',
    invoice: { wanted: wantsInvoice, razonSocial: wantsInvoice ? razonSocial : '', ruc: wantsInvoice ? ruc : '', ...(wantsInvoice ? { taxpayerType } : {}) },
    shippingMethod: shipping.method,
    shippingCity: shipping.city,
    departamento: shipping.departamento,
    address: keepsAddress ? address : '',
    reference: keepsAddress ? referencia : '',
    shippingCost,
    ...(coupon ? { coupon } : {}),
    shippingPending: shipping.pending,
    shipping: {
      method: shipping.method,
      encomiendaMode: shipping.method === 'encomienda' ? encomiendaMode : '',
      city: shipping.city,
      departamento: shipping.departamento,
      rateIndex: shipping.rateIndex,
      address: keepsAddress ? address : '',
      referencia: keepsAddress ? referencia : '',
      zone: shipping.method === 'encomienda' ? 'interior' : 'central',
      mapLocation: keepsAddress ? mapLocation : null,
    },
  };

  const inspect = ({ items, documents, subtotal, shippingCost: computedShipping, total }) => {
    for (const item of items) {
      const product = decodeFirestoreFields(documents.get(item.id)?.fields || {});
      if (!variantIsValid(product, item.variant)) {
        throw checkoutError(item.variant ? 'invalid_variant' : 'variant_required', 422, { productId: item.id });
      }
    }
    if (
      payload.expectedSubtotal !== subtotal ||
      payload.expectedShippingCost !== computedShipping ||
      payload.expectedShippingPending !== shipping.pending ||
      payload.expectedTotal !== total
    ) {
      throw checkoutError('quote_changed', 422, {
        quote: { items, subtotal, shippingCost: computedShipping, shippingPending: shipping.pending, total },
      });
    }
  };

  return { input, inspect };
}
