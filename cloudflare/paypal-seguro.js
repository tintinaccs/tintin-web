import {
  decodeFirestoreFields,
  firestoreAdminGet,
  firestoreAdminMerge,
  firestoreAdminReplace,
  fsInteger,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';

const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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
  if (!Number.isFinite(rate) || rate <= 0) missing.push('exchange_rate');
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

function validatePayableOrder(order, uid) {
  if (clean(order.userId, 128) !== uid) throw new Error('El pedido no pertenece a la cuenta iniciada');
  if (clean(order?.payment?.method, 30) !== 'paypal') throw new Error('El pedido no seleccionó PayPal');
  if (clean(order?.payment?.status, 30) === 'pagado' || clean(order.paymentStatus, 30) === 'pagado') {
    throw new Error('El pedido ya está pagado');
  }
  if (order.shippingPending === true) throw new Error('El envío todavía no tiene un total cobrable');
  return Number(order.total);
}

export async function createPaypalOrder(env, { orderId, uid }) {
  const config = paypalConfig(env);
  if (!config.enabled) throw new Error(`PayPal no está habilitado: ${config.missing.join(',')}`);
  await assertAccountNotBlocked(env, uid);
  const order = await loadOrder(env, orderId);
  const amount = paypalAmountFromPyg(validatePayableOrder(order, uid), config.rate);
  const provider = await paypalRequest(config, '/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `tintin-create-${order.id}` },
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
  return { id, ...decodeFirestoreFields(document.fields || {}) };
}

function completedCapture(provider) {
  const units = Array.isArray(provider?.purchase_units) ? provider.purchase_units : [];
  return units.flatMap(unit => unit?.payments?.captures || []).find(capture => capture?.status === 'COMPLETED') || null;
}

async function markPaid(env, mapping, capture) {
  const currency = clean(capture?.amount?.currency_code, 3).toUpperCase();
  const cents = Math.round(Number(capture?.amount?.value) * 100);
  if (currency !== mapping.currency || cents !== Number(mapping.expectedCents)) {
    await firestoreAdminMerge(env, `paypalOrders/${mapping.id}`, {
      status: fsString('DISCREPANCY'),
      discrepancyAt: fsTimestamp(new Date()),
      discrepancyCurrency: fsString(currency),
      discrepancyCents: fsInteger(Number.isSafeInteger(cents) ? cents : 0),
    });
    throw new Error('El importe confirmado por PayPal no coincide con el pedido');
  }
  const confirmedAt = new Date();
  await firestoreAdminMerge(env, `orders/${mapping.orderId}`, {
    payment: { mapValue: { fields: {
      method: fsString('paypal'), status: fsString('pagado'), providerOrderId: fsString(mapping.id),
      captureId: fsString(clean(capture.id, 100)), currency: fsString(currency),
      amount: fsString((cents / 100).toFixed(2)), confirmedAt: fsTimestamp(confirmedAt),
    } } },
    paymentStatus: fsString('pagado'), updatedAt: fsTimestamp(confirmedAt),
  });
  await firestoreAdminMerge(env, `paypalOrders/${mapping.id}`, {
    status: fsString('COMPLETED'), captureId: fsString(clean(capture.id, 100)), updatedAt: fsTimestamp(confirmedAt),
  });
}

export async function capturePaypalOrder(env, { providerOrderId, uid }) {
  const config = paypalConfig(env);
  if (!config.enabled) throw new Error('PayPal no está habilitado');
  const mapping = await loadMapping(env, providerOrderId);
  if (mapping.uid !== uid) throw new Error('La orden PayPal no pertenece a la cuenta iniciada');
  await assertAccountNotBlocked(env, uid);
  const provider = await paypalRequest(config, `/v2/checkout/orders/${encodeURIComponent(mapping.id)}/capture`, {
    method: 'POST', headers: { 'PayPal-Request-Id': `tintin-capture-${mapping.orderId}` }, body: '{}',
  });
  const capture = completedCapture(provider);
  if (!capture) throw new Error('PayPal no confirmó el cobro');
  await markPaid(env, mapping, capture);
  return { paid: true, orderId: mapping.orderId, captureId: clean(capture.id, 100) };
}

export async function processPaypalWebhook(env, request, rawBody) {
  const config = paypalConfig(env);
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
  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return { accepted: true, handled: false };
  const providerOrderId = clean(event?.resource?.supplementary_data?.related_ids?.order_id, 80);
  const mapping = await loadMapping(env, providerOrderId);
  await markPaid(env, mapping, event.resource);
  return { accepted: true, handled: true, orderId: mapping.orderId };
}
