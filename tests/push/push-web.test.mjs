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
  normalizePushToneUrl,
  parseWebhookEvent,
  sanitizeError,
  signWebhook,
  verifyWebhookSignature,
  webhookSigningPayload
} from '../../cloudflare/nucleo-push.js';
import { pushEnabled, savePushSettings } from '../../cloudflare/servicio-push.js';
import { adminNotificationPushPresentation } from '../../cloudflare/notificaciones-sociales.js';

test('Push queda cerrado por defecto y sólo acepta una habilitación explícita', () => {
  assert.equal(pushEnabled({}), false);
  assert.equal(pushEnabled({ TINTIN_PUSH_ENABLED: 'false' }), false);
  assert.equal(pushEnabled({ TINTIN_PUSH_ENABLED: 'true' }), true);
});

test('un tono push acepta MP3 directo y rechaza páginas, credenciales y protocolos inseguros', () => {
  assert.equal(normalizePushToneUrl('https://cdn.example.com/tono.mp3?version=2'), 'https://cdn.example.com/tono.mp3?version=2');
  for (const value of ['https://www.youtube.com/shorts/fixture', 'https://cdn.example.com/page', 'http://cdn.example.com/tono.mp3', 'https://user:password@cdn.example.com/tono.mp3', 'javascript:alert(1)', '']) {
    assert.equal(normalizePushToneUrl(value), '');
  }
});

test('un tono inválido detiene el guardado completo antes de acceder a Firebase', async () => {
  await assert.rejects(savePushSettings({}, {
    foregroundSound: 'default', foregroundSoundOrder: 'custom',
    foregroundSoundOrderUrl: 'https://www.youtube.com/shorts/fixture',
  }), /enlace HTTPS directo a un archivo MP3/);
});

test('Web Push se entrega únicamente por Firebase FCM', () => {
  const service = read('cloudflare/servicio-push.js');
  assert.doesNotMatch(service, /ntfy/i);
  assert.match(service, /const devices = await listActiveDevices\(env\);/);
  assert.match(service, /ok: result\.successCount > 0, \.\.\.result, lastError: sanitizeError\(result\.lastError, 120\)/);
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

test('el mensaje FCM viaja sólo como data, con TTL y sin enlace FCM relativo', () => {
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
  assert.equal(message.webpush.headers.Urgency, 'high');
  assert.equal(message.webpush.fcm_options, undefined);
  assert.equal(message.data.tag, `order.created:${ORDER_ID}`);
});

test('los pagos tienen urgencia alta sin elevar avisos sociales ni reemplazar una prioridad explícita', () => {
  for (const type of ['payment.completed', 'payment.failed', 'payment.refunded']) {
    const content = buildPushContent({ type, orderId: ORDER_ID, order: ORDER });
    assert.equal(buildFcmMessage({ token: 'fixture', content }).message.webpush.headers.Urgency, 'high');
    assert.equal(buildFcmMessage({ token: 'fixture', content, urgency: 'low' }).message.webpush.headers.Urgency, 'low');
  }
  for (const type of ['social.review.created', 'admin.user.joined', 'push.test']) {
    assert.equal(buildFcmMessage({ token: 'fixture', content: { data: { type } } }).message.webpush.headers.Urgency, 'normal');
  }
});

test('la notificación de prueba usa el pedido simulado fijo del servidor', () => {
  const content = buildTestPushContent('push.test:abc');
  assert.equal(content.title, 'Nuevo pedido de prueba');
  assert.equal(content.body, 'Mina menina · Gs. 420.000 · Caaguazú · Encomienda (Caaguazú)');
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
    'order.created',
    'social.review.created', 'social.review.reply',
    'social.like.product', 'social.like.review', 'social.like.reply',
    'payment.completed', 'payment.failed', 'payment.refunded'
  ]);
  const emitters = ['apps-script/CrearPedido.gs', 'functions/api/order-email.js']
    .map(read)
    .join('\n');
  assert.ok(!emitters.includes('payment.completed'), 'ningún camino actual dispara un aviso de pago');
});

test('los cinco eventos sociales tienen emisor server-side y fallback sin waitUntil', () => {
  const engagement = read('functions/api/engagement.js');
  const social = read('cloudflare/notificaciones-sociales.js');
  const participation = read('cloudflare/participacion-clientes.js');
  for (const type of [
    'social.review.created', 'social.review.reply',
    'social.like.product', 'social.like.review', 'social.like.reply'
  ]) assert.ok(social.includes(type), `${type} debe tener payload push`);
  assert.match(social, /dispatchAdminNotificationPush/);
  assert.match(social, /dispatchSocialPushEvent/);
  assert.match(participation, /await dispatchAdminNotificationPush\(env, adminNotification\)/);
  assert.doesNotMatch(engagement, /dispatchSocialPushEvent/);
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

test('el mensaje global queda reservado al Super Admin y cubre todos los dispositivos activos', () => {
  const endpoint = read('functions/api/push-admin.js');
  const service = read('cloudflare/servicio-push.js');
  assert.match(endpoint, /requireSuperAdmin/);
  assert.match(endpoint, /action === 'broadcast'/);
  assert.match(endpoint, /body\.title/);
  assert.match(endpoint, /body\.body/);
  assert.match(service, /export async function dispatchAdminBroadcast/);
  assert.match(service, /const devices = await listActiveDevices\(env\);/);
  assert.doesNotMatch(service, /MAX_DEVICES_PER_SEND/);
});

test('los Me gusta agrupados conservan el nombre y reemplazan el aviso anterior', () => {
  const presentation = adminNotificationPushPresentation({
    kind: 'product_like', actorName: 'María López', productName: 'Bag Noir',
    targetType: 'product', targetId: 'bag-noir', aggregateCount: 3,
  });
  assert.equal(presentation.title, 'María López y 2 personas más dieron Me gusta');
  assert.equal(presentation.body, 'Bag Noir · 3 Me gusta en total');
  assert.equal(presentation.tag, 'like:product:bag-noir');
});

test('la prueba Push devuelve un diagnóstico seguro cuando FCM no entrega', () => {
  const endpoint = read('functions/api/push-test.js');
  assert.match(endpoint, /lastError: result\.lastError \|\| ''/);
  assert.match(endpoint, /Firebase no pudo entregar la notificación/);
  assert.match(endpoint, /success: result\.ok/);
});

test('el registro de dispositivos guarda sólo los campos previstos', () => {
  const source = read('functions/api/push-subscription.js');
  assert.ok(source.includes("ALLOWED_FIELDS"), 'rechaza campos inesperados');
  assert.ok(!/\bip\b\s*:/.test(source), 'no guarda la IP');
  const service = read('cloudflare/servicio-push.js');
  assert.ok(service.includes('deviceDocumentId'), 'el id del documento es un hash');
  assert.ok(!service.includes('${token}`'), 'el token no se usa como id de documento');
});

// Ejecuta el service worker real: destinos sociales, ventana existente y fallos de navegación.
const { default: vm } = await import('node:vm');
function workerFixture(clients = []) {
  const handlers = {}, opened = [], shown = [];
  let clickRegisteredBeforeSdk = false;
  const self = {
    location: { origin: 'https://tintin.example' },
    addEventListener(type, handle) { handlers[type] = handle; },
    skipWaiting() {},
    clients: { claim() {}, async matchAll() { return clients; }, async openWindow(url) { opened.push(url); } },
    registration: { async showNotification(title, options) { shown.push({ title, ...options }); } },
  };
  vm.runInNewContext(read('firebase-messaging-sw.js'), {
    self, URL, URLSearchParams, console,
    importScripts() { clickRegisteredBeforeSdk = Boolean(handlers.notificationclick); },
    firebase: { initializeApp() {}, messaging() { return { onBackgroundMessage(handle) { handlers.message = handle; } }; } },
  });
  return { handlers, opened, shown, clickRegisteredBeforeSdk,
    async click(url) { let work; handlers.notificationclick({ notification: { close() {}, data: { url } }, waitUntil(promise) { work = promise; } }); await work; },
  };
}
test('push resuelve enlaces sociales históricos y conserva el módulo correcto', async () => {
  const w = workerFixture();
  for (const [url, expected] of [
    ['admin.html#section-usuarios', '/admin.html?section=usuarios'],
    ['/admin?section=notificaciones-push', '/admin.html?section=notificaciones-push'],
    ['/admin.html?section=pedidos&order=valid_order_12345', '/admin.html?section=pedidos&order=valid_order_12345'],
    ['https://otro.example/admin.html', '/admin.html?section=pedidos'],
    ['//otro.example/admin.html', '/admin.html?section=pedidos'],
    ['/admin/../checkout', '/admin.html?section=pedidos'],
  ]) {
    await w.handlers.message({ data: { title: 'Aviso', url } });
    assert.equal(w.shown.at(-1).data.url, expected);
  }
  assert.equal(w.clickRegisteredBeforeSdk, true);
  assert.equal(w.shown[0].icon, '/assets-tintin/images/admin/push-icon-192.png?v=tintin-20261020-push-return-1');
});
test('el clic push no reemplaza la tienda y abre una ventana si navigate falla', async () => {
  let focused = 0, navigated = 0;
  const w = workerFixture([
    { url: 'https://tintin.example/checkout', async navigate() { throw Error('No debe tocar checkout'); } },
    { url: 'https://tintin.example/admin.html', async navigate() { navigated++; throw Error('Ventana cerrada'); }, async focus() { focused++; } },
  ]);
  await w.click('/admin.html?section=usuarios');
  assert.equal(navigated, 1); assert.equal(focused, 0);
  assert.deepEqual(w.opened, ['https://tintin.example/admin.html?section=usuarios']);
});
test('el clic reutiliza el panel cuando la navegación tiene éxito', async () => {
  let focused = 0, target;
  const w = workerFixture([{ url: 'https://tintin.example/admin', async navigate(url) { target = url; return this; }, async focus() { focused++; } }]);
  await w.click('/admin.html?section=pedidos&order=order_example_1234');
  assert.equal(target, 'https://tintin.example/admin.html?section=pedidos&order=order_example_1234');
  assert.equal(focused, 1); assert.equal(w.opened.length, 0);
});

const apiSource = read('functions/api/notifications.js');
const loginFunction = apiSource.slice(apiSource.indexOf('async function registerLoginNotification'), apiSource.indexOf('\nasync function registerOrderCreated'));
function loginFixture(profile) {
  const events = [], reads = [];
  const run = new Function('safeId', 'clean', 'firestoreAdminGet', 'decodeFirestoreFields', 'notifyAdminIfAbsent', 'LOGIN_ALERT_MAX_AGE_MS', `${loginFunction};return registerLoginNotification;`)(
    value => value, value => String(value || '').trim().slice(0, 160),
    async (_, path) => { reads.push(path); return profile ? { fields: profile } : null; }, value => value,
    async (_, event, key) => { events.push({ event, key }); return { created: true }; }, 86400000,
  );
  return { run, events, reads };
}
test('login push identifica la cuenta usando el perfil del servidor y conserva la deduplicación', async () => {
  const f = loginFixture({ firstName: 'Iván', lastName: 'López' });
  const auth_time = Math.floor(Date.now() / 1000);
  await f.run({}, { uid: 'customer_123', claims: { auth_time, name: 'Nombre anterior' } });
  assert.deepEqual(f.reads, ['users/customer_123']);
  assert.equal(f.events[0].event.title, 'Iván López inició sesión');
  assert.equal(f.events[0].event.actorName, 'Iván López');
  assert.equal(f.events[0].key, `user_login:customer_123:${auth_time}`);
});
test('login sin perfil usa el nombre verificado y no expone el correo', async () => {
  const f = loginFixture(null);
  await f.run({}, { uid: 'customer_123', email: 'privado@example.test', claims: { auth_time: Math.floor(Date.now() / 1000), name: 'Iván López' } });
  assert.equal(f.events[0].event.actorName, 'Iván López');
  assert.ok(!JSON.stringify(f.events).includes('privado@example.test'));
});
test('un auth_time ausente, vencido o futuro no lee el perfil ni emite login push', async () => {
  const f = loginFixture({ name: 'Iván' });
  for (const auth_time of [0, Math.floor(Date.now()/1000)-86401, Math.floor(Date.now()/1000)+120]) {
    assert.equal((await f.run({}, { uid: 'customer_123', claims: { auth_time } })).skipped, true);
  }
  assert.equal(f.events.length, 0); assert.equal(f.reads.length, 0);
});
