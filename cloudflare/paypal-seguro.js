import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminFindFirstByFields,
  firestoreAdminGet,
  firestoreAdminMerge,
  firestoreAdminReplace,
  fsInteger,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';
import { notifyAdminIfAbsent } from './notificaciones-sociales.js';
import { applyOrderAdminMutation } from './order-admin-domain.js';

const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PYG_PER_USD = 1000;
const MAX_PYG_PER_USD = 50000;
const ORDER_ID_RE = /^[A-Za-z0-9_-]{12,220}$/;
const PROVIDER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

const clean = (value, max = 220) => String(value == null ? '' : value).trim().slice(0, max);

export function paypalConfig(env = {}, now = Date.now()) {
  const requested = clean(env.PAYPAL_ENABLED, 10).toLowerCase() === 'true';
  const mode = clean(env.PAYPAL_ENVIRONMENT, 20).toLowerCase() === 'live' ? 'live' : 'sandbox';
  const currency = clean(env.PAYPAL_SETTLEMENT_CURRENCY || 'USD', 3).toUpperCase();
  const rate = Number(env.PAYPAL_PYG_PER_USD);
  const rateAt = Date.parse(clean(env.PAYPAL_RATE_UPDATED_AT, 60));
  const clientId = clean(env.PAYPAL_CLIENT_ID, 300);
  const secret = clean(env.PAYPAL_CLIENT_SECRET, 500);
  const webhookId = clean(env.PAYPAL_WEBHOOK_ID, 180);
  const missing = [];
  if (!requested) missing.push('feature_disabled');
  if (!clientId) missing.push('client_id');
  if (!secret) missing.push('client_secret');
  if (!webhookId) missing.push('webhook_id');
  if (currency !== 'USD') missing.push('unsupported_settlement_currency');
  if (!Number.isFinite(rate) || rate < MIN_PYG_PER_USD || rate > MAX_PYG_PER_USD) missing.push('exchange_rate');
  if (!Number.isFinite(rateAt) || Math.abs(now - rateAt) > MAX_RATE_AGE_MS) missing.push('stale_exchange_rate');
  return {
    enabled: missing.length === 0,
    mode,
    currency,
    rate,
    rateAt: Number.isFinite(rateAt) ? new Date(rateAt).toISOString() : '',
    clientId,
    secret,
    webhookId,
    apiBase: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    missing,
  };
}

export function publicPaypalConfig(env = {}, now = Date.now()) {
  const config = paypalConfig(env, now);
  return {
    enabled: config.enabled,
    environment: config.mode,
    currency: config.currency,
    clientId: config.enabled ? config.clientId : '',
    rateUpdatedAt: config.rateAt,
    unavailableReasons: config.enabled ? [] : config.missing,
  };
}

// La tasa diaria publicada por el BCP se mantiene en Firestore mediante un
// workflow firmado de GitHub. El valor de entorno sigue siendo respaldo para
// instalaciones anteriores, pero nunca se habilitan pagos desde este dato.
export async function resolvedPaypalConfig(env = {}, now = Date.now()) {
  let rateDocument = null;
  try {
    rateDocument = await firestoreAdminGet(env, 'settings/paymentFx');
  } catch (error) {
    console.warn('[paypal] No se pudo leer la tasa diaria de Firestore:', error?.message || error);
  }
  const stored = rateDocument ? decodeFirestoreFields(rateDocument.fields || {}) : {};
  const sourceDate = clean(stored.sourceDate, 10);
  const sourceDateAt = Date.parse(`${sourceDate}T12:00:00Z`);
  const useStored = Number.isFinite(Number(stored.pygPerUsd))
    && Number(stored.pygPerUsd) >= MIN_PYG_PER_USD
    && Number(stored.pygPerUsd) <= MAX_PYG_PER_USD
    && stored.source === 'BCP'
    && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
    && Number.isFinite(sourceDateAt)
    && sourceDateAt <= now + 86_400_000
    && now - sourceDateAt <= MAX_RATE_AGE_MS
    && Date.parse(stored.updatedAt || '') > 0;
  const config = paypalConfig(useStored ? {
    ...env,
    PAYPAL_PYG_PER_USD: String(stored.pygPerUsd),
    PAYPAL_RATE_UPDATED_AT: stored.updatedAt,
  } : env, now);
  return { ...config, rateSource: useStored ? 'BCP' : 'manual', rateSourceDate: useStored ? sourceDate : '' };
}

export function publicResolvedPaypalConfig(config) {
  return {
    enabled: config.enabled,
    environment: config.mode,
    currency: config.currency,
    clientId: config.enabled ? config.clientId : '',
    rateUpdatedAt: config.rateAt,
    rateSource: config.rateSource,
    rateSourceDate: config.rateSourceDate,
    unavailableReasons: config.enabled ? [] : config.missing,
  };
}

export function paypalAmountFromPyg(totalPyg, pygPerUsd) {
  const total = Number(totalPyg);
  const rate = Number(pygPerUsd);
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Importe o tasa de cambio inválidos');
  }
  const cents = Math.round((total * 100) / rate);
  if (!Number.isSafeInteger(cents) || cents < 1) throw new Error('El importe convertido no es cobrable');
  return { cents, value: (cents / 100).toFixed(2) };
}

async function accessToken(config) {
  const authorization = btoa(`${config.clientId}:${config.secret}`);
  const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${authorization}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`PayPal OAuth falló (${response.status})`);
  return data.access_token;
}

async function paypalRequest(config, path, options = {}) {
  const token = await accessToken(config);
  const response = await fetch(`${config.apiBase}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PayPal API falló (${response.status}:${clean(data?.name || data?.message, 80)})`);
  return data;
}

async function loadOrder(env, orderId) {
  const safeId = clean(orderId);
  if (!ORDER_ID_RE.test(safeId)) throw new Error('Pedido inválido');
  const document = await firestoreAdminGet(env, `orders/${safeId}`);
  if (!document) throw new Error('Pedido inexistente');
  return { id: safeId, ...decodeFirestoreFields(document.fields || {}) };
}

async function assertAccountNotBlocked(env, uid) {
  const document = await firestoreAdminGet(env, `users/${uid}`);
  const profile = document ? decodeFirestoreFields(document.fields || {}) : {};
  if (profile.blocked === true) throw new Error('La cuenta está bloqueada y no puede completar pagos');
}

// Un pedido cancelado, rechazado o ya reembolsado no se puede volver a cobrar:
// el cobro quedaría registrado sobre un pedido que el equipo ya cerró.
const CLOSED_ORDER_STATUSES = new Set(['cancelado', 'rechazado']);
const CLOSED_PAYMENT_STATUSES = new Set(['pagado', 'cancelado', 'rechazado', 'reembolsado']);

export function validatePayableOrder(order, uid) {
  if (clean(order.userId, 128) !== uid) throw new Error('El pedido no pertenece a la cuenta iniciada');
  if (clean(order?.payment?.method, 30) !== 'paypal') throw new Error('El pedido no seleccionó PayPal');
  const paymentStatus = clean(order?.payment?.status || order.paymentStatus, 30).toLowerCase();
  if (paymentStatus === 'pagado' || clean(order.paymentStatus, 30) === 'pagado') {
    throw new Error('El pedido ya está pagado');
  }
  if (CLOSED_PAYMENT_STATUSES.has(paymentStatus) || CLOSED_ORDER_STATUSES.has(clean(order.status, 30).toLowerCase())) {
    throw new Error('El pedido está cerrado y no admite pagos');
  }
  if (order.shippingPending === true) throw new Error('El envío todavía no tiene un total cobrable');
  return Number(order.total);
}

// PayPal-Request-Id admite hasta 108 caracteres y PayPal devuelve la orden
// original si se repite: incluir el importe evita reutilizar una orden con un
// total viejo cuando el pedido cambió, y el hash mantiene el largo acotado.
export async function paypalCreateRequestId(orderId, cents) {
  const bytes = new TextEncoder().encode(`${orderId}:${cents}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `tintin-create-${[...digest.slice(0, 20)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function createPaypalOrder(env, { orderId, uid }) {
  const config = await resolvedPaypalConfig(env);
  if (!config.enabled) throw new Error(`PayPal no está habilitado: ${config.missing.join(',')}`);
  await assertAccountNotBlocked(env, uid);
  const order = await loadOrder(env, orderId);
  const amount = paypalAmountFromPyg(validatePayableOrder(order, uid), config.rate);
  const provider = await paypalRequest(config, '/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': await paypalCreateRequestId(order.id, amount.cents) },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: order.id,
        invoice_id: order.id,
        amount: { currency_code: config.currency, value: amount.value },
      }],
    }),
  });
  const providerId = clean(provider.id, 80);
  if (!PROVIDER_ID_RE.test(providerId)) throw new Error('PayPal no devolvió un identificador válido');
  await firestoreAdminReplace(env, `paypalOrders/${providerId}`, {
    orderId: fsString(order.id), uid: fsString(uid), currency: fsString(config.currency),
    expectedCents: fsInteger(amount.cents), status: fsString(clean(provider.status, 30) || 'CREATED'),
    createdAt: fsTimestamp(new Date()),
  });
  await firestoreAdminMerge(env, `orders/${order.id}`, {
    payment: { mapValue: { fields: {
      method: fsString('paypal'), status: fsString('pendiente'), providerOrderId: fsString(providerId),
      currency: fsString(config.currency), amount: fsString(amount.value),
    } } },
  });
  return { providerOrderId: providerId, status: clean(provider.status, 30), currency: config.currency, value: amount.value };
}

async function loadMapping(env, providerOrderId) {
  const id = clean(providerOrderId, 80);
  if (!PROVIDER_ID_RE.test(id)) throw new Error('Orden PayPal inválida');
  const document = await firestoreAdminGet(env, `paypalOrders/${id}`);
  if (!document) throw new Error('No existe conciliación para esa orden PayPal');
  return { ...decodeFirestoreFields(document.fields || {}), id, updateTime: document.updateTime };
}

function completedCapture(provider) {
  const units = Array.isArray(provider?.purchase_units) ? provider.purchase_units : [];
  return units.flatMap(unit => unit?.payments?.captures || []).find(capture => capture?.status === 'COMPLETED') || null;
}

export async function markPaid(env, mapping, capture, deps = {}) {
  const captureId = clean(capture?.id, 100);
  if (mapping.status === 'COMPLETED' && mapping.captureId && mapping.captureId === captureId) {
    return { idempotent: true };
  }
  // PayPal no garantiza el orden de los webhooks: un "cobro completado" que
  // llega tarde no puede volver a marcar como pagado algo ya devuelto.
  if (['REFUNDED', 'REVERSED'].includes(mapping.status)) return { idempotent: true, reversed: true };
  if (!captureId) throw new Error('PayPal no devolvió el identificador de captura');
  const currency = clean(capture?.amount?.currency_code, 3).toUpperCase();
  const cents = Math.round(Number(capture?.amount?.value) * 100);
  if (currency !== mapping.currency || cents !== Number(mapping.expectedCents)) {
    const discrepancyFields = {
      status: fsString('DISCREPANCY'),
      discrepancyAt: fsTimestamp(new Date()),
      discrepancyCurrency: fsString(currency),
      discrepancyCents: fsInteger(Number.isSafeInteger(cents) ? cents : 0),
    };
    if (!mapping.updateTime) throw new Error('No se pudo verificar la versión de la conciliación');
    await (deps.commit || firestoreAdminCommit)(env, [{ path: `paypalOrders/${mapping.id}`, fields: discrepancyFields, mergeFields: Object.keys(discrepancyFields), currentDocument: { updateTime: mapping.updateTime } }]);
    throw new Error('El importe confirmado por PayPal no coincide con el pedido');
  }
  const confirmedAt = new Date();
  const orderFields = {
    payment: { mapValue: { fields: {
      method: fsString('paypal'), status: fsString('pagado'), providerOrderId: fsString(mapping.id),
      captureId: fsString(captureId), currency: fsString(currency),
      amount: fsString((cents / 100).toFixed(2)), confirmedAt: fsTimestamp(confirmedAt),
    } } },
    paymentStatus: fsString('pagado'), updatedAt: fsTimestamp(confirmedAt),
  };
  const mappingFields = {
    status: fsString(mapping.status === 'PARTIALLY_REFUNDED' ? mapping.status : 'COMPLETED'), captureId: fsString(captureId), updatedAt: fsTimestamp(confirmedAt),
  };
  if (!mapping.updateTime) throw new Error('No se pudo verificar la versión de la conciliación');
  await (deps.commit || firestoreAdminCommit)(env, [
    { path: `orders/${mapping.orderId}`, fields: orderFields, mergeFields: Object.keys(orderFields), currentDocument: { exists: true } },
    { path: `paypalOrders/${mapping.id}`, fields: mappingFields, mergeFields: Object.keys(mappingFields), currentDocument: { updateTime: mapping.updateTime } },
  ]);

  await (deps.deductStock || deductStockForPaidOrder)(env, mapping);
  await (deps.notify || notifyOrderConfirmed)(env, mapping, cents, currency);
}

// El pedido nace sin descontar stock; al confirmarse el pago se descuenta con
// las mismas precondiciones atómicas del dominio de pedidos. Si el stock ya no
// alcanza, el cobro queda registrado y se avisa al equipo para resolverlo.
async function deductStockForPaidOrder(env, mapping) {
  try {
    await applyOrderAdminMutation(env, {
      orderId: mapping.orderId, reconcileInventory: true, source: 'paypal-payment',
    }, { uid: 'paypal', email: 'paypal@system', role: 'system', origin: 'paypal-payment' });
  } catch (error) {
    console.error('[paypal] No se pudo descontar stock tras el pago', mapping.orderId, error?.message || error);
    try {
      await notifyAdminIfAbsent(env, {
        kind: 'order_stock_conflict', actorType: 'system', actorName: 'PayPal',
        title: `Pago recibido sin stock suficiente (${mapping.orderId})`,
        body: 'El pago se confirmó pero el stock no alcanzó. Revisá el pedido y contactá a la clienta.',
        iconKey: 'order', targetUrl: 'admin.html#section-pedidos',
        orderId: mapping.orderId, status: 'stock_conflict',
        sourceType: 'order', sourceId: mapping.orderId, createdAt: new Date(),
      }, `stock_conflict:${mapping.orderId}`);
    } catch (notifyError) {
      console.warn('[paypal] No se pudo avisar el conflicto de stock:', notifyError);
    }
  }
}

async function notifyOrderConfirmed(env, mapping, cents, currency) {
  try {
    const orderDoc = await firestoreAdminGet(env, `orders/${mapping.orderId}`);
    const order = orderDoc ? decodeFirestoreFields(orderDoc.fields || {}) : {};
    const orderNumber = clean(order.orderNumber || order.shortId || mapping.orderId, 80);
    const customerName = clean(order.userName || 'Una clienta', 160);
    const totalText = `Gs. ${(cents / 100).toLocaleString('es-PY')}`;

    await notifyAdminIfAbsent(env, {
      kind: 'order_confirmed', actorType: 'system', actorName: 'PayPal',
      title: `Pago confirmado del pedido ${orderNumber}`,
      body: `${customerName} pagó ${totalText} por PayPal.`,
      iconKey: 'order', targetUrl: 'admin.html#section-pedidos',
      orderId: mapping.orderId, orderNumber, status: 'pagado',
      sourceType: 'order', sourceId: mapping.orderId, createdAt: new Date(),
    }, `payment_completed:${mapping.orderId}`);
  } catch (error) {
    console.warn('[paypal] No se pudo registrar la notificación de pago confirmado:', error);
  }
}

export async function capturePaypalOrder(env, { providerOrderId, uid }) {
  const config = await resolvedPaypalConfig(env);
  if (!config.enabled) throw new Error('PayPal no está habilitado');
  const mapping = await loadMapping(env, providerOrderId);
  if (mapping.uid !== uid) throw new Error('La orden PayPal no pertenece a la cuenta iniciada');
  if (['REFUNDED', 'REVERSED', 'PARTIALLY_REFUNDED'].includes(mapping.status)) throw new Error('El pago tiene un reembolso o reversión; revisá el pedido con Tintin');
  if (mapping.status === 'COMPLETED' && mapping.captureId) {
    return { paid: true, orderId: mapping.orderId, captureId: mapping.captureId, idempotent: true };
  }
  await assertAccountNotBlocked(env, uid);
  const provider = await paypalRequest(config, `/v2/checkout/orders/${encodeURIComponent(mapping.id)}/capture`, {
    // Por orden de PayPal (no por pedido): si el pedido tuvo que generar una
    // orden nueva, repetir el id del pedido devolvería la captura de la vieja.
    method: 'POST', headers: { 'PayPal-Request-Id': `tintin-capture-${mapping.id}` }, body: '{}',
  });
  const capture = completedCapture(provider);
  if (!capture) throw new Error('PayPal no confirmó el cobro');
  await markPaid(env, mapping, capture);
  return { paid: true, orderId: mapping.orderId, captureId: clean(capture.id, 100) };
}

export async function processPaypalWebhook(env, request, rawBody) {
  const config = await resolvedPaypalConfig(env);
  if (!config.enabled) throw new Error('PayPal no está habilitado');
  const event = JSON.parse(rawBody || '{}');
  const verification = await paypalRequest(config, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: request.headers.get('paypal-auth-algo'), cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'), transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'), webhook_id: config.webhookId, webhook_event: event,
    }),
  });
  if (verification.verification_status !== 'SUCCESS') throw new Error('Firma de webhook PayPal inválida');
  if (REVERSAL_EVENTS.has(event.event_type)) {
    const reversal = paypalReversalDetails(event);
    const mapping = await loadMappingForReversal(env, reversal);
    await markReversed(env, mapping, reversal);
    return { accepted: true, handled: true, orderId: mapping.orderId };
  }
  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return { accepted: true, handled: false };
  const providerOrderId = clean(event?.resource?.supplementary_data?.related_ids?.order_id, 80);
  const mapping = await loadMapping(env, providerOrderId);
  await markPaid(env, mapping, event.resource);
  return { accepted: true, handled: true, orderId: mapping.orderId };
}

// Reembolsos y contracargos. Antes sólo se escuchaba el cobro completado, así
// que un pedido reembolsado o revertido seguía figurando como pagado.
const REVERSAL_EVENTS = new Set(['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']);

/**
 * Extrae de un evento de reembolso/contracargo la captura afectada y el monto.
 * En REVERSED el recurso es la propia captura; en REFUNDED es el reembolso,
 * que apunta a su captura con el enlace rel="up".
 */
export function paypalReversalDetails(event) {
  const resource = event?.resource || {};
  const kind = event?.event_type === 'PAYMENT.CAPTURE.REVERSED' ? 'reversed' : 'refunded';
  const upLink = (Array.isArray(resource.links) ? resource.links : []).find(link => link?.rel === 'up');
  const linkedCapture = clean(String(upLink?.href || '').split('/captures/')[1]?.split(/[/?#]/)[0], 100);
  const captureId = kind === 'reversed' ? clean(resource.id, 100) : linkedCapture;
  const amount = resource?.amount || {};
  const cents = Math.round((kind === 'reversed' ? Math.abs(Number(amount.value)) : Number(amount.value)) * 100);
  return {
    kind,
    captureId,
    providerOrderId: clean(resource?.supplementary_data?.related_ids?.order_id, 80),
    currency: clean(amount.currency_code, 3).toUpperCase(),
    cents: Number.isSafeInteger(cents) && cents > 0 ? cents : 0,
    eventId: clean(event?.id, 120),
    refundId: kind === 'refunded' ? clean(resource.id, 120) : '',
  };
}

async function loadMappingForReversal(env, reversal) {
  if (reversal.providerOrderId && PROVIDER_ID_RE.test(reversal.providerOrderId)) {
    return loadMapping(env, reversal.providerOrderId);
  }
  if (!/^[A-Za-z0-9_-]{6,100}$/.test(reversal.captureId)) throw new Error('El evento no identifica la captura');
  const document = await firestoreAdminFindFirstByFields(env, 'paypalOrders', ['captureId'], reversal.captureId);
  if (!document) throw new Error('No existe conciliación para esa captura PayPal');
  const id = clean(String(document.name || '').split('/').pop(), 80);
  return { ...decodeFirestoreFields(document.fields || {}), id, updateTime: document.updateTime };
}

export function paypalReversalTransition(mapping, reversal) {
  if (!reversal.captureId || (mapping.captureId && reversal.captureId !== mapping.captureId)) throw new Error('La captura del evento no coincide con el pedido');
  if (reversal.currency !== mapping.currency || !Number.isSafeInteger(reversal.cents) || reversal.cents <= 0) throw new Error('Importe de reembolso PayPal inválido');
  const expected = Number(mapping.expectedCents);
  if (!Number.isSafeInteger(expected) || expected <= 0 || reversal.cents > expected) throw new Error('El reembolso supera el importe conciliado');
  const refundId = reversal.refundId || reversal.eventId;
  if (!refundId) throw new Error('El evento de reembolso no tiene identificador');
  const records = Array.isArray(mapping.refundRecords) ? mapping.refundRecords : [];
  const duplicate = records.some(record => record.id === refundId);
  const nextRecords = duplicate ? records : [...records, { id: refundId, cents: reversal.cents, kind: reversal.kind }];
  const cumulative = nextRecords.filter(record => record.kind !== 'reversed').reduce((total, record) => total + Number(record.cents || 0), 0);
  if (!Number.isSafeInteger(cumulative)) throw new Error('Total de reembolsos inválido');
  const status = mapping.status === 'REVERSED' || reversal.kind === 'reversed' ? 'REVERSED'
    : mapping.status === 'REFUNDED' || cumulative >= expected ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  return { status, full: status !== 'PARTIALLY_REFUNDED', cumulative: status === 'REVERSED' ? expected : cumulative, records: nextRecords, duplicate };
}

export async function markReversed(env, mapping, reversal, deps = {}) {
  const now = new Date();
  const transition = paypalReversalTransition(mapping, reversal);
  const { full, status: mappingStatus } = transition;
  const mappingFields = {
    status: fsString(mappingStatus),
    captureId: fsString(mapping.captureId || reversal.captureId),
    reversalCents: fsInteger(transition.cumulative),
    ...encodeFirestoreFields({ refundRecords: transition.records }),
    reversalAt: fsTimestamp(now),
  };
  if (!mapping.updateTime) throw new Error('No se pudo verificar la versión de la conciliación');
  const writes = [{ path: `paypalOrders/${mapping.id}`, fields: mappingFields, mergeFields: Object.keys(mappingFields), currentDocument: { updateTime: mapping.updateTime } }];
  if (full) {
    const orderFields = {
      payment: { mapValue: { fields: {
        method: fsString('paypal'), status: fsString('reembolsado'), providerOrderId: fsString(mapping.id),
        captureId: fsString(clean(mapping.captureId || reversal.captureId, 100)), currency: fsString(mapping.currency),
        reversalKind: fsString(mappingStatus === 'REVERSED' ? 'reversed' : 'refunded'), reversedAt: fsTimestamp(now),
      } } },
      paymentStatus: fsString('reembolsado'), updatedAt: fsTimestamp(now),
    };
    writes.push({ path: `orders/${mapping.orderId}`, fields: orderFields, mergeFields: Object.keys(orderFields), currentDocument: { exists: true } });
  }
  // Atomicidad y versión protegen contra fallos parciales y eventos concurrentes.
  // Ante conflicto el webhook falla y PayPal reintenta con la versión actual.
  await (deps.commit || firestoreAdminCommit)(env, writes);
  try {
    const title = reversal.kind === 'reversed'
      ? `Contracargo PayPal en el pedido ${mapping.orderId}`
      : `${full ? 'Reembolso' : 'Reembolso parcial'} PayPal en el pedido ${mapping.orderId}`;
    await (deps.notify || notifyAdminIfAbsent)(env, {
      kind: 'order_payment_reversed', actorType: 'system', actorName: 'PayPal',
      title,
      body: full
        ? 'El pago quedó marcado como reembolsado. Revisá el pedido y el stock antes de entregar.'
        : `Se devolvieron USD ${(reversal.cents / 100).toFixed(2)}; el pago sigue figurando como pagado.`,
      iconKey: 'order', targetUrl: 'admin.html#section-pedidos',
      orderId: mapping.orderId, status: full ? 'reembolsado' : 'pagado',
      sourceType: 'order', sourceId: mapping.orderId, createdAt: now,
    }, `payment_${mappingStatus.toLowerCase()}:${mapping.orderId}:${reversal.refundId || reversal.eventId}`);
  } catch (error) {
    console.warn('[paypal] No se pudo avisar el reembolso/contracargo:', error);
  }
  return { idempotent: transition.duplicate, full };
}
