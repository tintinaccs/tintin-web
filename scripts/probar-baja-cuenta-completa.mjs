#!/usr/bin/env node
// Prueba de la baja definitiva de cuentas contra el emulador de Firestore.
// Ejecuta el código real de cloudflare/user-lifecycle-domain.js: sus llamadas
// REST a Firestore van al emulador y las de Firebase Auth (lookup, delete,
// update) a un registro de cuentas en memoria con la misma forma de respuesta.
//   npm run test:account-purge
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-tintin-purge';
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}`;
const authAccounts = new Map();

function authResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeIdentityToolkit(method, body) {
  if (method === 'accounts:lookup') {
    const uid = body.localId?.[0];
    const email = body.email?.[0];
    const account = uid ? authAccounts.get(uid) : [...authAccounts.values()].find(item => item.email === email);
    return authResponse(account ? { users: [{ localId: account.uid, email: account.email, disabled: account.disabled }] } : {});
  }
  if (method === 'accounts:delete') {
    if (!authAccounts.delete(body.localId)) return authResponse({ error: { message: 'USER_NOT_FOUND' } }, 400);
    return authResponse({});
  }
  if (method === 'accounts:update') {
    const account = authAccounts.get(body.localId);
    if (!account) return authResponse({ error: { message: 'USER_NOT_FOUND' } }, 400);
    account.disabled = body.disableUser === true;
    return authResponse({ localId: account.uid });
  }
  throw new Error(`Método de Auth no esperado en la prueba: ${method}`);
}

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: PROJECT,
    client_email: `purge-test@${PROJECT}.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
};

let subrequests = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  subrequests += 1;
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'owner', expires_in: 3600 }), { headers: { 'content-type': 'application/json' } });
  }
  const headers = { ...(init.headers || {}), authorization: 'Bearer owner' };
  if (url.startsWith('https://firestore.googleapis.com/')) {
    return realFetch(url.replace('https://firestore.googleapis.com', FIRESTORE), { ...init, headers });
  }
  if (url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:')) {
    return fakeIdentityToolkit(url.split('/v1/')[1], JSON.parse(init.body || '{}'));
  }
  throw new Error(`Llamada externa no esperada en la prueba: ${url}`);
};

const { applyUserLifecycle, purgeUserByEmail } = await import('../cloudflare/user-lifecycle-domain.js');
const { encodeFirestoreFields, firestoreAdminGet, firestoreAdminCommit, firestoreAdminReplace, lookupFirebaseUser } = await import('../cloudflare/firebase-admin-ligero.js');
const { userNotificationPath } = await import('../cloudflare/notificaciones-sociales.js');

async function emulator(url, init = {}) {
  const response = await realFetch(url, { ...init, headers: { authorization: 'Bearer owner', 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${url} → ${response.status} ${await response.text()}`);
  return response;
}

async function resetEmulators() {
  await emulator(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  authAccounts.clear();
}

function createAuthUser(uid, email, { disabled = false } = {}) {
  authAccounts.set(uid, { uid, email: email.toLowerCase(), disabled });
}

const put = (path, data) => ({ path, fields: encodeFirestoreFields(data) });
const exists = async path => Boolean(await firestoreAdminGet(env, path));
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const A = 'clientaBorrar01';
const B = 'clientaQueda001';
const EMAIL_A = 'clienta.borrar@example.com';
const EMAIL_B = 'clienta.queda@example.com';
const now = new Date('2026-09-20T12:00:00Z');
const OTP_PATH_A = `emailOtpCodes/${encodeURIComponent(EMAIL_A)}`;

async function seedFullAccount() {
  await createAuthUser(A, EMAIL_A);
  await createAuthUser(B, EMAIL_B);
  const noticeToB = await userNotificationPath(B, `review_like:rev-b-1:${A}:${B}`);
  const writes = [
    put(`users/${A}`, { email: EMAIL_A, name: 'Clienta Borrar', phone: '0981000111', username: 'clientaborrar', role: 'client', customerId: `CUS_${A}`, createdAt: now, lastChangeId: 'EVT_base' }),
    put(`users/${B}`, { email: EMAIL_B, name: 'Clienta Queda', role: 'client', customerId: `CUS_${B}`, createdAt: now }),
    put(`users/${A}/cart/items`, { items: [{ productId: 'prod-1', qty: 2 }] }),
    put(`users/${A}/favorites/prod-1`, { productId: 'prod-1', createdAt: now }),
    put(`users/${A}/notifications/aviso-propio`, { type: 'system', createdAt: now }),
    put(`users/${B}/favorites/prod-1`, { productId: 'prod-1', createdAt: now }),
    put('phoneReservations/595981000111', { uid: A }),
    put('usernameReservations/clientaborrar', { uid: A }),
    put(`checkoutGuards/${A}`, { lastAttemptAt: now }),
    put('products/prod-1', { name: 'Aros de prueba', price: 50000, status: 'active' }),
    // Reseña de A con un "Me gusta" de B.
    put('reviewRecords/rev-a-1', { id: 'rev-a-1', reviewId: 'rev-a-1', ownerUid: A, productId: 'prod-1', rating: 5, comment: 'Hermosos', visible: true, deleted: false, likeCount: 1, conversation: [], createdAt: now, updatedAt: now }),
    put(`users/${A}/reviews/rev-a-1`, { reviewId: 'rev-a-1', productId: 'prod-1' }),
    put('products/prod-1/reviews/rev-a-1', { rating: 5, comment: 'Hermosos', publicName: 'Clienta', createdAt: now }),
    put('likeRecords/like-b-on-a', { id: 'like-b-on-a', ownerUid: B, targetOwnerUid: A, targetType: 'review', reviewId: 'rev-a-1', productId: 'prod-1', createdAt: now }),
    // Reseña de B con un "Me gusta" de A (debe quedar la reseña y bajar el contador).
    put('reviewRecords/rev-b-1', { id: 'rev-b-1', reviewId: 'rev-b-1', ownerUid: B, productId: 'prod-1', rating: 4, comment: 'Lindo', visible: true, deleted: false, likeCount: 1, conversation: [], createdAt: now, updatedAt: now }),
    put('likeRecords/like-a-on-b', { id: 'like-a-on-b', ownerUid: A, targetOwnerUid: B, targetType: 'review', reviewId: 'rev-b-1', productId: 'prod-1', createdAt: now }),
    put(noticeToB, { type: 'review_like', createdAt: now }),
    // "Me gusta" de producto de A y de B.
    put('likeRecords/like-prod-a', { id: 'like-prod-a', ownerUid: A, targetType: 'product', productId: 'prod-1', createdAt: now }),
    put('likeRecords/like-prod-b', { id: 'like-prod-b', ownerUid: B, targetType: 'product', productId: 'prod-1', createdAt: now }),
    put('adminNotifications/alta-a', { type: 'user_registered', actorUid: A, createdAt: now }),
    // Pedido de A: es un registro de venta de la tienda y se conserva.
    put('orders/TINPED-0001', { orderId: 'TINPED-0001', uid: A, customerId: `CUS_${A}`, total: 100000, status: 'completed', createdAt: now }),
  ];
  // firestoreAdminCommit acepta hasta 20 escrituras por llamada.
  for (let i = 0; i < writes.length; i += 20) await firestoreAdminCommit(env, writes.slice(i, i + 20));
  // Mismo formato de ruta que functions/api/email-otp-send.js.
  await firestoreAdminReplace(env, OTP_PATH_A, encodeFirestoreFields({ codeHash: 'x', createdAt: now }));
  return { noticeToB };
}

async function testFullDelete() {
  const { noticeToB } = await seedFullAccount();
  subrequests = 0;
  const result = await applyUserLifecycle(env, { uid: A, action: 'delete', actorEmail: 'admin@example.com', actorRole: 'superadmin', baseChangeId: 'EVT_base' });
  const used = subrequests;
  assert.equal(result.purged, true);
  assert.equal(result.authDeleted, true);
  assert.equal(result.profileDeleted, true);

  assert.equal(await lookupFirebaseUser(env, { uid: A }), null, 'el acceso de Auth debe desaparecer');
  for (const path of [
    `users/${A}`, `users/${A}/cart/items`, `users/${A}/favorites/prod-1`, `users/${A}/notifications/aviso-propio`, `users/${A}/reviews/rev-a-1`,
    'phoneReservations/595981000111', 'usernameReservations/clientaborrar', `checkoutGuards/${A}`, OTP_PATH_A,
    'reviewRecords/rev-a-1', 'products/prod-1/reviews/rev-a-1', 'likeRecords/like-b-on-a', 'likeRecords/like-a-on-b', 'likeRecords/like-prod-a',
    'adminNotifications/alta-a', noticeToB,
  ]) assert.equal(await exists(path), false, `${path} debía borrarse`);

  assert.equal(await exists('orders/TINPED-0001'), true, 'el pedido se conserva');
  assert.equal(await exists(`users/${B}`), true, 'la otra cuenta no se toca');
  assert.equal(await exists(`users/${B}/favorites/prod-1`), true);
  assert.equal(await exists('likeRecords/like-prod-b'), true);
  assert.ok(await lookupFirebaseUser(env, { uid: B }), 'el acceso de la otra cuenta sigue');

  const reviewB = await firestoreAdminGet(env, 'reviewRecords/rev-b-1');
  assert.equal(Number(reviewB.fields.likeCount.integerValue ?? reviewB.fields.likeCount.doubleValue), 0, 'el contador de la reseña ajena se descuenta');
  const stats = await firestoreAdminGet(env, 'productEngagementStats/prod-1');
  assert.equal(Number(stats.fields.likeCount.integerValue ?? stats.fields.likeCount.doubleValue), 1, 'el contador de "Me gusta" del producto queda en 1');

  const audit = await firestoreAdminGet(env, `auditLog/${result.auditEventId}`);
  assert.ok(audit, 'queda un registro de auditoría');
  const auditText = JSON.stringify(audit.fields);
  assert.equal(auditText.includes(EMAIL_A), false, 'la auditoría no guarda el correo');
  assert.equal(auditText.includes('0981000111'), false, 'la auditoría no guarda el teléfono');

  const again = await applyUserLifecycle(env, { uid: A, action: 'delete' });
  assert.equal(again.alreadyDeleted, true, 'repetir la baja es seguro');
  return used;
}

async function testLegacyLimbo() {
  // Baja anterior: perfil anonimizado sin createdAt (invisible en la lista) y
  // acceso deshabilitado con el mismo correo → la persona no podía volver.
  const legacyUid = 'cuentaEnElAire1';
  const email = 'cuenta.en.el.aire@example.com';
  await createAuthUser(legacyUid, email, { disabled: true });
  await firestoreAdminCommit(env, [
    put(`users/${legacyUid}`, { deleted: true, profileStatus: 'deleted', deletedEmailHash: await sha256Hex(email), role: 'client', customerId: `CUS_${legacyUid}` }),
    put('orders/TINPED-0002', { orderId: 'TINPED-0002', uid: legacyUid, total: 50000, status: 'completed', createdAt: now }),
  ]);

  const first = await purgeUserByEmail(env, { email: email.toUpperCase(), actorEmail: 'admin@example.com' });
  assert.equal(first.accountsFound, 1);
  assert.equal(first.remainingAccounts, 0);
  assert.equal(first.result.legacyTombstone, true);
  assert.equal(await lookupFirebaseUser(env, { email }), null, 'el correo queda libre en Auth');
  assert.equal(await exists(`users/${legacyUid}`), false, 'el resto del borrado anterior desaparece');
  assert.equal(await exists('orders/TINPED-0002'), true, 'el pedido se conserva');

  const second = await purgeUserByEmail(env, { email });
  assert.equal(second.accountsFound, 0, 'no queda nada asociado al correo');

  // El correo puede registrarse otra vez.
  await createAuthUser('cuentaNueva0001', email);
  assert.equal((await lookupFirebaseUser(env, { email })).uid, 'cuentaNueva0001');
}

async function testGuards() {
  await assert.rejects(() => purgeUserByEmail(env, { email: 'tintinaccs@gmail.com' }), /protegida/);
  await assert.rejects(() => purgeUserByEmail(env, { email: 'no-es-correo' }), /Correo inválido/);
  await assert.rejects(() => applyUserLifecycle(env, { uid: 'x', action: 'delete' }), /inválidos/);
  await createAuthUser('superAdmin0001', 'tintinaccs@gmail.com');
  await assert.rejects(() => applyUserLifecycle(env, { uid: 'superAdmin0001', action: 'delete' }), /protegida/);
  assert.ok(await lookupFirebaseUser(env, { uid: 'superAdmin0001' }), 'Super Admin no se borra');
}

await resetEmulators();
const used = await testFullDelete();
await testLegacyLimbo();
await testGuards();
await resetEmulators();
console.log(`OK — baja completa de cuentas verificada en emuladores (${used} subsolicitudes para una cuenta con participación social).`);
