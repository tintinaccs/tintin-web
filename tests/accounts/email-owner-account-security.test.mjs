// Inicio con código por correo: quien confirma el código demuestra que controla
// el correo. Si ya existía una cuenta con ese correo sin verificar o con
// contraseña (la pudo crear otra persona antes), se le quita la contraseña, se
// marca verificada y se cortan las sesiones previas antes de entregar el acceso.

import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { findOrCreateUserByEmail } from '../../cloudflare/firebase-admin-ligero.js';

const PROJECT = 'test-project';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/';
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const ENV = {
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: PROJECT,
    client_email: `test@${PROJECT}.iam.gserviceaccount.com`,
    private_key: privateKey,
  }),
};
const EMAIL = 'clienta@example.com';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Identity Toolkit mínimo: lookup, signUp y update, registrando cada llamada. */
async function withIdentity({ lookups = [], signUp = null, update = null }, run) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'test-only-access-token', expires_in: 3600 });
    if (!url.startsWith(IDENTITY)) throw new Error(`Petición de red inesperada: ${url}`);
    const action = url.slice(IDENTITY.length);
    const body = JSON.parse(init.body || '{}');
    calls.push({ action, body });
    if (action === 'accounts:lookup') {
      const user = lookups.shift() ?? null;
      return json(user ? { users: [user] } : {});
    }
    if (action === 'accounts:signUp') return signUp ? signUp(body) : json({ error: { message: 'NO_ESPERADO' } }, 400);
    if (action === 'accounts:update') return update ? update(body) : json({ localId: body.localId });
    throw new Error(`Acción inesperada: ${action}`);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const updates = calls => calls.filter(call => call.action === 'accounts:update').map(call => call.body);

test('cuenta verificada sin contraseña (Google o código): se reutiliza sin tocarla', async () => {
  await withIdentity({
    lookups: [{ localId: 'uid_google', email: EMAIL, emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }],
  }, async calls => {
    assert.deepEqual(await findOrCreateUserByEmail(ENV, EMAIL), { uid: 'uid_google', isNewUser: false });
    assert.deepEqual(updates(calls), []);
  });
});

test('cuenta sin verificar con contraseña: se quita la contraseña, se verifica y se cortan sesiones', async () => {
  const before = Math.floor(Date.now() / 1000);
  await withIdentity({
    lookups: [{ localId: 'uid_previa', email: EMAIL, emailVerified: false, passwordHash: 'x', providerUserInfo: [{ providerId: 'password' }] }],
  }, async calls => {
    assert.deepEqual(await findOrCreateUserByEmail(ENV, EMAIL), { uid: 'uid_previa', isNewUser: false });
    const [body] = updates(calls);
    assert.equal(body.localId, 'uid_previa');
    assert.equal(body.emailVerified, true);
    assert.deepEqual(body.deleteProvider, ['password']);
    assert.ok(Number(body.validSince) >= before, 'validSince invalida las sesiones emitidas antes');
  });
});

test('cuenta verificada que además tiene contraseña: se quita la contraseña', async () => {
  await withIdentity({
    lookups: [{ localId: 'uid_mixta', email: EMAIL, emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }, { providerId: 'password' }] }],
  }, async calls => {
    await findOrCreateUserByEmail(ENV, EMAIL);
    const [body] = updates(calls);
    assert.deepEqual(body.deleteProvider, ['password']);
    assert.equal(body.emailVerified, true);
  });
});

test('cuenta sin verificar y sin contraseña: se verifica sin pedir quitar proveedores', async () => {
  await withIdentity({
    lookups: [{ localId: 'uid_sinverificar', email: EMAIL, emailVerified: false, providerUserInfo: [] }],
  }, async calls => {
    await findOrCreateUserByEmail(ENV, EMAIL);
    const [body] = updates(calls);
    assert.equal(body.emailVerified, true);
    assert.equal('deleteProvider' in body, false);
  });
});

test('si no se puede asegurar la cuenta previa, no se entrega el acceso', async () => {
  await withIdentity({
    lookups: [{ localId: 'uid_previa', email: EMAIL, emailVerified: false, passwordHash: 'x' }],
    update: () => json({ error: { message: 'INTERNAL_ERROR' } }, 500),
  }, async () => {
    await assert.rejects(findOrCreateUserByEmail(ENV, EMAIL), /No se pudo asegurar la cuenta de acceso: INTERNAL_ERROR/);
  });
});

test('carrera EMAIL_EXISTS: la cuenta encontrada también se asegura', async () => {
  await withIdentity({
    lookups: [null, { localId: 'uid_carrera', email: EMAIL, emailVerified: false, passwordHash: 'x' }],
    signUp: () => json({ error: { message: 'EMAIL_EXISTS' } }, 400),
  }, async calls => {
    assert.deepEqual(await findOrCreateUserByEmail(ENV, EMAIL), { uid: 'uid_carrera', isNewUser: false });
    const [body] = updates(calls);
    assert.equal(body.localId, 'uid_carrera');
    assert.deepEqual(body.deleteProvider, ['password']);
  });
});

test('correo nuevo: se crea la cuenta ya verificada y sin contraseña', async () => {
  await withIdentity({
    lookups: [null],
    signUp: body => json({ localId: 'uid_nueva', email: body.email }),
  }, async calls => {
    assert.deepEqual(await findOrCreateUserByEmail(ENV, EMAIL), { uid: 'uid_nueva', isNewUser: true });
    const signUp = calls.find(call => call.action === 'accounts:signUp');
    assert.deepEqual(signUp.body, { email: EMAIL, emailVerified: true });
    assert.deepEqual(updates(calls), []);
  });
});
