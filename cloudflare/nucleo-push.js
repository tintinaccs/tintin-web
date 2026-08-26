// =============================================================
// TINTIN — Núcleo compartido de Web Push (sin estado, sin red)
// =============================================================
// Todo lo que se puede probar sin Firebase ni Cloudflare vive acá:
// firma HMAC del webhook, validación del evento, formato de guaraníes y
// construcción del mensaje FCM. Los endpoints de functions/api/ importan
// estas funciones; tests/push/push-web.test.mjs las ejecuta directamente
// en Node (Web Crypto está disponible en ambos runtimes).
//
// Regla que atraviesa todo el archivo: en el mensaje visible y en los
// datos del push NUNCA entran datos personales de la clienta.

export const PUSH_DEVICES_COLLECTION = 'adminPushDevices';
export const PUSH_EVENTS_COLLECTION = 'pushEvents';

export const PUSH_EVENT_TYPES = Object.freeze([
  'order.created',
  // Preparados para cuando exista una verificación server-side real del
  // webhook oficial de PayPal. Hoy ningún camino del repositorio los emite.
  'payment.completed',
  'payment.failed',
  'payment.refunded'
]);

export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;
export const WEBHOOK_MAX_BODY_BYTES = 4096;
export const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{12,220}$/;

export function cleanText(value, maxLength = 200) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Guaraníes sin decimales y con punto como separador de miles: "Gs. 180.000".
 * No se usa toLocaleString: su salida depende del ICU del runtime y acá el
 * mismo número tiene que verse igual en Cloudflare, en Node y en el celular.
 */
export function formatGuarani(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Gs. ${grouped}`;
}

export function deliveryLabel(order) {
  const method = cleanText(order?.shipping?.method || order?.shippingMethod, 40).toLowerCase();
  return {
    delivery: 'Delivery',
    encomienda: 'Encomienda',
    retiro: 'Retiro'
  }[method] || 'A coordinar';
}

export function paymentLabel(order) {
  const method = cleanText(order?.payment?.method || order?.paymentMethod, 40).toLowerCase();
  return {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    paypal: 'PayPal',
    tarjeta: 'Tarjeta'
  }[method] || 'Pago';
}

export function shortIdFor(order, orderId) {
  const fromOrder = cleanText(order?.shortId, 30).replace(/[^A-Za-z0-9]/g, '');
  if (fromOrder) return fromOrder.toUpperCase();
  return cleanText(orderId, 220).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase() || 'PEDIDO';
}

export function adminOrderLink(orderId) {
  const safeId = cleanText(orderId, 220);
  if (!ORDER_ID_PATTERN.test(safeId)) return '/admin.html?section=pedidos';
  return `/admin.html?section=pedidos&order=${encodeURIComponent(safeId)}`;
}

/**
 * Contenido visible + datos internos del push. El pedido llega leído desde
 * Firestore con credenciales de servidor — nunca del navegador ni del webhook.
 */
export function buildPushContent({ type, orderId, order, eventId, foregroundSound = 'default', foregroundSoundUrl = '' }) {
  const shortId = shortIdFor(order, orderId);
  const total = formatGuarani(order?.total);
  const url = adminOrderLink(orderId);
  const tag = cleanText(eventId, 120) || `${type}:${orderId}`;

  let title = 'Tintin Pedidos';
  let body = `Pedido #${shortId}`;
  if (type === 'order.created') {
    title = 'Nuevo pedido en Tintin';
    body = `Pedido #${shortId} · ${total} · ${deliveryLabel(order)}`;
  } else if (type === 'payment.completed') {
    title = 'Pago confirmado';
    body = `Pedido #${shortId} · ${paymentLabel(order)} · ${total}`;
  } else if (type === 'payment.failed') {
    title = 'Pago rechazado';
    body = `Pedido #${shortId} · ${paymentLabel(order)}`;
  } else if (type === 'payment.refunded') {
    title = 'Pago devuelto';
    body = `Pedido #${shortId} · ${paymentLabel(order)} · ${total}`;
  }

  return {
    title,
      body,
      foregroundSound: cleanText(foregroundSound, 20) || 'default',
      foregroundSoundUrl: cleanText(foregroundSoundUrl, 500),
    // Sólo identificadores y texto ya construido: ni nombre, ni teléfono, ni
    // correo, ni dirección, ni coordenadas, ni notas, ni detalle de productos.
    data: {
      type: cleanText(type, 40),
      orderId: cleanText(orderId, 220),
      shortId,
      url,
      eventId: cleanText(eventId, 260),
      tag,
      title,
      body
    }
  };
}

export function buildTestPushContent(eventId, foregroundSound = 'default', foregroundSoundUrl = '') {
  const url = '/admin.html?section=configuracion';
  // Simulación controlada: no representa un pedido real ni escribe en
  // Firestore. Sirve para comprobar el formato visible del aviso push.
  const title = 'Nuevo pedido de prueba';
  const body = 'Mina menina · Gs. 420.000 · Caaguazú · Encomienda (Caaguazú)';
  return {
    title,
      body,
      foregroundSound: cleanText(foregroundSound, 20) || 'default',
      foregroundSoundUrl: cleanText(foregroundSoundUrl, 500),
    data: {
      type: 'push.test',
      orderId: '',
      shortId: '',
      url,
      eventId: cleanText(eventId, 260),
      tag: cleanText(eventId, 120) || 'tintin-push-test',
      title,
      body
    }
  };
}

/**
 * Mensaje FCM HTTP v1. Se manda sólo `data` (sin bloque `notification`) para
 * que la única notificación visible la cree firebase-messaging-sw.js: así no
 * hay dos avisos por el mismo mensaje y el `tag` queda bajo nuestro control.
 */
export function buildFcmMessage({ token, content, ttlSeconds = 3600, urgency = 'normal' }) {
  return {
    message: {
      token,
      data: { ...content.data },
      webpush: {
        headers: {
          TTL: String(Math.max(0, Math.trunc(ttlSeconds))),
          Urgency: urgency
        },
        fcm_options: { link: content.data.url }
      }
    }
  };
}

// --- Firma HMAC-SHA256 del webhook interno --------------------------------

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function webhookSigningPayload(timestamp, rawBody) {
  return `${String(timestamp)}.${String(rawBody)}`;
}

export async function signWebhook(secret, timestamp, rawBody) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(webhookSigningPayload(timestamp, rawBody))
  );
  return hexFromBuffer(signature);
}

/** Comparación en tiempo constante: no corta en la primera diferencia. */
export function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookSignature({ secret, timestamp, rawBody, signature, nowMs = Date.now() }) {
  if (!secret) return { ok: false, error: 'push_secret_missing' };
  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp) || stamp <= 0) return { ok: false, error: 'invalid_timestamp' };
  if (Math.abs(nowMs - stamp) > WEBHOOK_MAX_SKEW_MS) return { ok: false, error: 'timestamp_expired' };
  const expected = await signWebhook(secret, timestamp, rawBody);
  if (!constantTimeEqual(expected, String(signature || '').trim().toLowerCase())) {
    return { ok: false, error: 'invalid_signature' };
  }
  return { ok: true };
}

/** Valida el contrato del webhook. No se confía en ningún dato económico. */
export function parseWebhookEvent(rawBody) {
  if (typeof rawBody !== 'string' || !rawBody.length) return { ok: false, error: 'empty_body' };
  if (rawBody.length > WEBHOOK_MAX_BODY_BYTES) return { ok: false, error: 'body_too_large' };
  let body;
  try { body = JSON.parse(rawBody); } catch { return { ok: false, error: 'invalid_json' }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid_json' };

  const allowed = ['eventId', 'type', 'orderId', 'occurredAt'];
  if (Object.keys(body).some(key => !allowed.includes(key))) return { ok: false, error: 'unexpected_fields' };

  const type = cleanText(body.type, 40);
  if (!PUSH_EVENT_TYPES.includes(type)) return { ok: false, error: 'invalid_type' };

  const orderId = cleanText(body.orderId, 220);
  if (!ORDER_ID_PATTERN.test(orderId)) return { ok: false, error: 'invalid_order_id' };

  const eventId = cleanText(body.eventId, 260);
  if (!eventId || eventId !== `${type}:${orderId}`) return { ok: false, error: 'invalid_event_id' };

  const occurredAt = cleanText(body.occurredAt, 40);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) return { ok: false, error: 'invalid_occurred_at' };

  return { ok: true, event: { eventId, type, orderId, occurredAt } };
}

/** ID de documento del evento: hash del eventId, nunca el eventId crudo. */
export async function eventDocumentId(eventId) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(eventId)));
  return hexFromBuffer(digest).slice(0, 40);
}

/** ID de documento del dispositivo: hash del token, nunca el token completo. */
export async function deviceDocumentId(uid, deviceId) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${String(uid)}::${String(deviceId)}`)
  );
  return hexFromBuffer(digest).slice(0, 40);
}

export async function tokenFingerprint(token) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  return hexFromBuffer(digest).slice(0, 16);
}

// --- Errores de FCM --------------------------------------------------------

const PERMANENT_FCM_ERRORS = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'SENDER_ID_MISMATCH',
  'NOT_FOUND'
]);

/**
 * Distingue "este token ya no sirve" (se desactiva el dispositivo) de un
 * problema temporal de Google (no se toca nada y se puede reintentar).
 */
export function classifyFcmError(status, payload) {
  const errorStatus = cleanText(payload?.error?.status, 60).toUpperCase();
  const detailCode = cleanText(
    (payload?.error?.details || []).find(detail => detail?.errorCode)?.errorCode,
    60
  ).toUpperCase();

  if (status === 404 || PERMANENT_FCM_ERRORS.has(detailCode) || PERMANENT_FCM_ERRORS.has(errorStatus)) {
    return { permanent: true, reason: detailCode || errorStatus || `http_${status}` };
  }
  return { permanent: false, reason: errorStatus || `http_${status}` };
}

/** Nunca se propaga el texto crudo de Google a la respuesta ni a los logs. */
export function sanitizeError(error, maxLength = 200) {
  const text = cleanText(error?.message || error, maxLength);
  return text
    .replace(/[A-Za-z0-9_-]{60,}/g, '[dato omitido]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo omitido]')
    .slice(0, maxLength);
}

/**
 * `private_key` de la cuenta de servicio: cuando el JSON se pega en un panel
 * web, los saltos de línea suelen quedar como la secuencia literal \n. Sin
 * normalizarlos, importKey() falla y el push nunca sale.
 */
export function normalizePrivateKey(privateKey) {
  return String(privateKey || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}
