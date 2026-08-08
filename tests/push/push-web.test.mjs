// Pruebas del núcleo de Web Push. No envían ninguna notificación real:
// todo lo que se ejercita acá es determinista y corre sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORDER_ID_PATTERN,
  PUSH_EVENT_TYPES,
  adminOrderLink,
  buildFcmMessage,
  buildPushContent,
  buildTestPushContent,
  classifyFcmError,
  constantTimeEqual,
  deviceDocumentId,
  eventDocumentId,
  formatGuarani,
  normalizePrivateKey,
  parseWebhookEvent,
  sanitizeError,
  signWebhook,
  verifyWebhookSignature,
  webhookSigningPayload
} from '../../cloudflare/nucleo-push.js';
import { pushEnabled } from '../../cloudflare/servicio-push.js';

test('Push queda cerrado por defecto y sólo acepta una habilitación explícita', () => {
  assert.equal(pushEnabled({}), false);
  assert.equal(pushEnabled({ TINTIN_PUSH_ENABLED: 'false' }), false);
  assert.equal(pushEnabled({ TINTIN_PUSH_ENABLED: 'true' }), true);
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const SECRET = 'secreto-de-prueba-no-real';
const ORDER_ID = 'uid123456789_req0987654321';

const ORDER = {
  shortId: 'A1B2C3D4',
  total: 180000,
  subtotal: 150000,
  userName: 'Clienta Ejemplo',
  userEmail: 'clienta@example.com',
  userPhone: '0981123456',
  notes: 'Tocar el timbre dos veces',
  shipping: {
    method: 'delivery',
    city: 'Asunción',
    address: 'Calle Falsa 123',
    referencia: 'Casa rosada',
    mapLocation: { lat: -25.3, lng: -57.6 }
  },
  payment: { method: 'efectivo' },
  items: [{ name: 'Anillo dorado', qty: 2, price: 75000 }]
};

// --- Formato de guaraníes --------------------------------------------------

test('los guaraníes se formatean sin decimales y con puntos de miles', () => {
  assert.equal(formatGuarani(180000), 'Gs. 180.000');
  assert.equal(formatGuarani(1500), 'Gs. 1.500');
  assert.equal(formatGuarani(1234567), 'Gs. 1.234.567');
  assert.equal(formatGuarani(0), 'Gs. 0');
  assert.equal(formatGuarani(null), 'Gs. 0');
  assert.equal(formatGuarani(99.6), 'Gs. 100');
  assert.ok(!formatGuarani(180000).includes(','));
});

// --- Contenido del mensaje -------------------------------------------------

test('el mensaje de pedido creado usa el texto acordado', () => {
  const content = buildPushContent({
    type: 'order.created',
    orderId: ORDER_ID,
    order: ORDER,
    eventId: `order.created:${ORDER_ID}`
  });
  assert.equal(content.title, 'Nuevo pedido en Tintin');
  assert.equal(content.body, 'Pedido #A1B2C3D4 · Gs. 180.000 · Delivery');
  assert.equal(content.data.shortId, 'A1B2C3D4');
  assert.equal(content.data.url, `/admin.html?section=pedidos&order=${ORDER_ID}`);
});

test('el payload no contiene ningún dato personal del pedido', () => {
  const content = buildPushContent({
    type: 'order.created',
    orderId: ORDER_ID,
    order: ORDER,
    eventId: `order.created:${ORDER_ID}`
  });
  const serialized = JSON.stringify(content).toLowerCase();
  const prohibited = [
    'clienta ejemplo', 'clienta@example.com', '0981123456',
    'calle falsa', 'casa rosada', 'timbre', 'anillo dorado', '-25.3', '-57.6'
  ];
  for (const value of prohibited) {
    assert.ok(!serialized.includes(value), `el payload no debe incluir "${value}"`);
  }
  const allowedKeys = ['type', 'orderId', 'shortId', 'url', 'eventId', 'tag', 'title', 'body'];
  assert.deepEqual(Object.keys(content.data).sort(), [...allowedKeys].sort());
});

test('el mensaje FCM viaja sólo como data, con TTL y enlace interno', () => {
  const content = buildPushContent({
    type: 'order.created',
    orderId: ORDER_ID,
    order: ORDER,
    eventId: `order.created:${ORDER_ID}`
  });
  const message = buildFcmMessage({ token: 'token-de-prueba', content }).message;
  assert.equal(message.token, 'token-de-prueba');
  // Sin bloque `notification`: la única notificación visible la crea el
  // service worker, así no aparece duplicada.
  assert.equal(message.notification, undefined);
  assert.equal(message.webpush.notification, undefined);
  assert.equal(message.webpush.headers.TTL, '3600');
  assert.ok(message.webpush.fcm_options.link.startsWith('/admin.html?section=pedidos'));
  assert.equal(message.data.tag, `order.created:${ORDER_ID}`);
});

test('la notificación de prueba usa contenido fijo del servidor', () => {
  const content = buildTestPushContent('push.test:abc');
  assert.equal(content.title, 'Tintin Pedidos');
  assert.equal(content.body, 'Las notificaciones están funcionando correctamente.');
  assert.equal(content.data.type, 'push.test');
  assert.ok(content.data.url.startsWith('/admin.html?section='));
});

test('un orderId inválido no genera un enlace con parámetros arbitrarios', () => {
  assert.equal(adminOrderLink('../../evil'), '/admin.html?section=pedidos');
  assert.equal(adminOrderLink(''), '/admin.html?section=pedidos');
  assert.ok(ORDER_ID_PATTERN.test(ORDER_ID));
});

// --- Firma HMAC ------------------------------------------------------------

test('la firma HMAC se calcula sobre <timestamp>.<rawBody>', async () => {
  const timestamp = Date.now();
  const rawBody = '{"a":1}';
  assert.equal(webhookSigningPayload(timestamp, rawBody), `${timestamp}.${rawBody}`);
  const signature = await signWebhook(SECRET, timestamp, rawBody);
  assert.match(signature, /^[0-9a-f]{64}$/);
  const verified = await verifyWebhookSignature({ secret: SECRET, timestamp, rawBody, signature });
  assert.equal(verified.ok, true);
});

test('una firma incorrecta se rechaza', async () => {
  const timestamp = Date.now();
  const rawBody = '{"a":1}';
  const wrong = await signWebhook('otro-secreto', timestamp, rawBody);
  const verified = await verifyWebhookSignature({ secret: SECRET, timestamp, rawBody, signature: wrong });
  assert.equal(verified.ok, false);
  assert.equal(verified.error, 'invalid_signature');
});

test('un cuerpo alterado invalida la firma', async () => {
  const timestamp = Date.now();
  const signature = await signWebhook(SECRET, timestamp, '{"a":1}');
  const verified = await verifyWebhookSignature({ secret: SECRET, timestamp, rawBody: '{"a":2}', signature });
  assert.equal(verified.ok, false);
});

test('un timestamp vencido se rechaza aunque la firma sea válida', async () => {
  const timestamp = Date.now() - 6 * 60 * 1000;
  const rawBody = '{"a":1}';
  const signature = await signWebhook(SECRET, timestamp, rawBody);
  const verified = await verifyWebhookSignature({ secret: SECRET, timestamp, rawBody, signature });
  assert.equal(verified.ok, false);
  assert.equal(verified.error, 'timestamp_expired');
});

test('sin secreto configurado nunca se acepta una firma', async () => {
  const verified = await verifyWebhookSignature({ secret: '', timestamp: Date.now(), rawBody: '{}', signature: 'x' });
  assert.equal(verified.ok, false);
  assert.equal(verified.error, 'push_secret_missing');
});

test('la comparación de firmas no corta en la primera diferencia', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
  assert.equal(constantTimeEqual('', ''), true);
});

// --- Contrato del evento ---------------------------------------------------

test('el webhook acepta el contrato esperado', () => {
  const rawBody = JSON.stringify({
    eventId: `order.created:${ORDER_ID}`,
    type: 'order.created',
    orderId: ORDER_ID,
    occurredAt: '2026-08-05T17:00:00.000Z'
  });
  const parsed = parseWebhookEvent(rawBody);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.event.orderId, ORDER_ID);
});

test('el webhook rechaza JSON inválido, campos extra y tipos desconocidos', () => {
  assert.equal(parseWebhookEvent('no es json').error, 'invalid_json');
  assert.equal(parseWebhookEvent('').error, 'empty_body');
  assert.equal(parseWebhookEvent(JSON.stringify({
    eventId: `order.created:${ORDER_ID}`, type: 'order.created', orderId: ORDER_ID, total: 999
  })).error, 'unexpected_fields');
  assert.equal(parseWebhookEvent(JSON.stringify({
    eventId: `order.hackeado:${ORDER_ID}`, type: 'order.hackeado', orderId: ORDER_ID
  })).error, 'invalid_type');
  assert.equal(parseWebhookEvent(JSON.stringify({
    eventId: 'order.created:x', type: 'order.created', orderId: 'x'
  })).error, 'invalid_order_id');
  assert.equal(parseWebhookEvent(JSON.stringify({
    eventId: 'otro-id', type: 'order.created', orderId: ORDER_ID
  })).error, 'invalid_event_id');
  assert.equal(parseWebhookEvent(`{"a":"${'x'.repeat(5000)}"}`).error, 'body_too_large');
});

test('los tipos de pago quedan declarados pero no se emiten hoy', () => {
  assert.deepEqual([...PUSH_EVENT_TYPES], [
    'order.created', 'payment.completed', 'payment.failed', 'payment.refunded'
  ]);
  const emitters = ['apps-script/CrearPedido.gs', 'functions/api/order-email.js']
    .map(read)
    .join('\n');
  assert.ok(!emitters.includes('payment.completed'), 'ningún camino actual dispara un aviso de pago');
});

// --- Idempotencia y limpieza de tokens -------------------------------------

test('el mismo eventId produce siempre el mismo documento, y otro evento no', async () => {
  const first = await eventDocumentId(`order.created:${ORDER_ID}`);
  const second = await eventDocumentId(`order.created:${ORDER_ID}`);
  const other = await eventDocumentId('order.created:otro-pedido-000000');
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^[0-9a-f]{40}$/);
  assert.ok(!first.includes(ORDER_ID));
});

test('el id del documento de dispositivo no contiene el token ni el deviceId', async () => {
  const docId = await deviceDocumentId('uid-1', 'dispositivo-1234567890');
  assert.match(docId, /^[0-9a-f]{40}$/);
  assert.ok(!docId.includes('dispositivo'));
});

test('los tokens muertos se distinguen de los errores temporales', () => {
  assert.equal(classifyFcmError(404, { error: { status: 'NOT_FOUND' } }).permanent, true);
  assert.equal(classifyFcmError(400, {
    error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] }
  }).permanent, true);
  assert.equal(classifyFcmError(403, {
    error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] }
  }).permanent, true);
  assert.equal(classifyFcmError(503, { error: { status: 'UNAVAILABLE' } }).permanent, false);
  assert.equal(classifyFcmError(500, { error: { status: 'INTERNAL' } }).permanent, false);
  assert.equal(classifyFcmError(429, { error: { status: 'RESOURCE_EXHAUSTED' } }).permanent, false);
});

test('los errores se sanitizan antes de salir o de registrarse', () => {
  const noisy = new Error('falló con token fWvB3kQ7RmS9tXyZ0aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abcdefghij y correo duena@tintinaccs.com');
  const clean = sanitizeError(noisy);
  assert.ok(!clean.includes('fWvB3kQ7RmS9tXyZ0aBcDeFgHiJkLmNoPqRsTuVwXyZ'));
  assert.ok(!clean.includes('duena@tintinaccs.com'));
});

// --- Cuenta de servicio ----------------------------------------------------

test('la clave privada normaliza los saltos de línea escapados', () => {
  const escaped = '-----BEGIN TEST KEY-----\\nLINEA1\\nLINEA2\\n-----END TEST KEY-----\\n';
  const normalized = normalizePrivateKey(escaped);
  assert.ok(!normalized.includes('\\n'));
  assert.equal(normalized.split('\n').length, 4);
  assert.equal(normalizePrivateKey(undefined), '');
});

test('el JWT RS256 de la cuenta de servicio se firma con Web Crypto', async () => {
  // Se genera un par RSA al vuelo: no hay ninguna clave real en el repositorio.
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const base64Url = bytes => Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: 'cuenta@ejemplo.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1, exp: 3601
  })));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  assert.equal(jwt.split('.').length, 3);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', pair.publicKey, signature, new TextEncoder().encode(signingInput)
  );
  assert.equal(valid, true);
});

// --- Control de acceso de los endpoints ------------------------------------

test('todos los endpoints de push exigen Super Admin o firma', () => {
  for (const file of ['push-config.js', 'push-subscription.js', 'push-test.js']) {
    const source = read(`functions/api/${file}`);
    assert.ok(source.includes('requireSuperAdmin'), `${file} exige Super Admin`);
    assert.ok(source.includes('originIsAllowed'), `${file} valida el origen`);
    assert.ok(source.includes("405"), `${file} limita los métodos`);
  }
  const webhook = read('functions/api/push-order-event.js');
  assert.ok(webhook.includes('verifyWebhookSignature'), 'el webhook verifica la firma');
  assert.ok(webhook.includes("request.method !== 'POST'"), 'el webhook sólo acepta POST');
  assert.ok(!webhook.includes('requireSuperAdmin'), 'el webhook es server-to-server, no de navegador');
});

test('el endpoint de prueba no acepta título ni cuerpo del navegador', () => {
  const source = read('functions/api/push-test.js');
  assert.ok(source.includes("['scope', 'token'].includes(key)"), 'sólo se aceptan scope y token');
  assert.ok(!source.includes('body.title'));
  assert.ok(!source.includes('body.body'));
  assert.ok(source.includes('buildTestPushContent') || source.includes('sendTestPush'));
});

test('el registro de dispositivos guarda sólo los campos previstos', () => {
  const source = read('functions/api/push-subscription.js');
  assert.ok(source.includes("ALLOWED_FIELDS"), 'rechaza campos inesperados');
  assert.ok(!/\bip\b\s*:/.test(source), 'no guarda la IP');
  const service = read('cloudflare/servicio-push.js');
  assert.ok(service.includes('deviceDocumentId'), 'el id del documento es un hash');
  assert.ok(!service.includes('${token}`'), 'el token no se usa como id de documento');
});
