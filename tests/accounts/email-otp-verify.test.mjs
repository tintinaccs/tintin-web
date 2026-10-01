import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { handleEmailOtpVerify } from '../../functions/api/email-otp-verify.js';
import { SUPERADMIN_EMAIL } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const ORIGIN = 'https://tintin.test';
const EMAIL = 'clienta@example.com';
const CODE = '777777';
const CODE_PATH = `emailOtpCodes/${encodeURIComponent(EMAIL)}`;

const sha256 = value => createHash('sha256').update(value).digest('hex');
const tick = () => new Promise(resolve => setTimeout(resolve, 2));

// Firestore en memoria con updateTime por documento y latencia simulada, para
// que los pedidos simultáneos se intercalen igual que contra la red real.
function fakeFirestore() {
  const docs = new Map();
  let version = 0;
  const put = (path, data) => docs.set(path, { fields: encodeFirestoreFields(data), updateTime: String(++version) });
  const deps = {
    logins: 0,
    tokenCreations: 0,
    deletedIdentities: [],
    lookupUser: async (_env, { uid }) => ({ uid, email: EMAIL, disabled: false }),
    findProfilesByEmail: async () => [],
    get: async (_env, path) => {
      await tick();
      const doc = docs.get(path);
      return doc ? { ...doc } : null;
    },
    merge: async (_env, path, fields, { updateTime = '' } = {}) => {
      await tick();
      const current = docs.get(path);
      if (updateTime && current?.updateTime !== updateTime) {
        throw Object.assign(new Error('conflict'), { status: 409, code: 'version_conflict' });
      }
      docs.set(path, { fields: { ...(current?.fields || {}), ...fields }, updateTime: String(++version) });
    },
    replace: async (_env, path, fields) => {
      await tick();
      docs.set(path, { fields, updateTime: String(++version) });
    },
    remove: async (_env, path) => {
      await tick();
      docs.delete(path);
    },
    resolveEmailFromUsernameKey: async () => null,
    findOrCreateUserByEmail: async () => {
      deps.logins += 1;
      return { uid: 'uid_clienta', isNewUser: false };
    },
    deleteUser: async (_env, uid) => { deps.deletedIdentities.push(uid); },
    createFirebaseCustomToken: async () => { deps.tokenCreations += 1; return 'custom-token'; },
  };
  return { deps, docs, put, read: path => (docs.has(path) ? decodeFirestoreFields(docs.get(path).fields) : null) };
}

function seedCode(store, { email = EMAIL, attempts = 0 } = {}) {
  store.put(`emailOtpCodes/${encodeURIComponent(email)}`, {
    codeHash: sha256(CODE),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts,
  });
}

async function verify(store, body, ip = '203.0.113.7') {
  const request = new Request(`${ORIGIN}/api/email-otp-verify`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'CF-Connecting-IP': ip, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await handleEmailOtpVerify({ request, env: {} }, store.deps);
  return { status: response.status, ...(await response.json()) };
}

test('200 intentos simultáneos no superan el límite de 5 comparaciones por código', async () => {
  const store = fakeFirestore();
  seedCode(store);
  const guesses = Array.from({ length: 200 }, (_, index) => String(100000 + index));
  guesses.push(CODE);
  const results = await Promise.all(guesses.map((code, index) => verify(store, { email: EMAIL, code }, `198.51.100.${index % 250}`)));
  const compared = results.filter(result => result.error === 'code_mismatch' || result.success).length;
  assert.ok(compared <= 5, `se compararon ${compared} códigos`);
  assert.ok(results.every(result => !result.success || result.customToken === 'custom-token'));
  assert.ok(Number(store.read(CODE_PATH)?.attempts ?? 5) <= 5);
});

test('el código correcto inicia sesión, reserva el intento y se borra', async () => {
  const store = fakeFirestore();
  seedCode(store);
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.customToken, 'custom-token');
  assert.equal(store.read(CODE_PATH), null);
});

test('una cuenta deshabilitada con perfil bloqueado no recibe token OTP', async () => {
  const store = fakeFirestore();
  seedCode(store);
  store.deps.findProfilesByEmail = async () => [{ fields: encodeFirestoreFields({ email: EMAIL, blocked: true }) }];
  store.deps.lookupUser = async (_env, { uid }) => ({ uid, email: EMAIL, disabled: true });
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 403);
  assert.equal(result.error, 'account_blocked');
  assert.equal(store.deps.tokenCreations, 0);
  assert.equal(store.read(CODE_PATH), null);
});

test('un perfil bloqueado impide crear otra identidad para el mismo email', async () => {
  const store = fakeFirestore();
  seedCode(store);
  store.deps.findProfilesByEmail = async () => [{ fields: encodeFirestoreFields({ email: EMAIL, blocked: true }) }];
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 403);
  assert.equal(result.error, 'account_blocked');
  assert.equal(store.deps.logins, 0);
  assert.equal(store.deps.tokenCreations, 0);
});

test('un perfil bloqueado en Firestore tampoco recibe un token OTP', async () => {
  const store = fakeFirestore();
  seedCode(store);
  store.put('users/uid_clienta', { blocked: true });
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 403);
  assert.equal(result.error, 'account_blocked');
  assert.equal(store.deps.tokenCreations, 0);
});

test('un registro posterior a una baja recibe una identidad nueva y puede iniciar sesión', async () => {
  const store = fakeFirestore();
  seedCode(store);
  store.deps.findProfilesByEmail = async () => [{ fields: encodeFirestoreFields({ email: EMAIL, deleted: true, profileStatus: 'deleted' }) }];
  store.deps.findOrCreateUserByEmail = async () => ({ uid: 'uid_cliente_nuevo', isNewUser: true });
  store.deps.lookupUser = async (_env, { uid }) => ({ uid, email: EMAIL, disabled: false });
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.equal(store.deps.tokenCreations, 1);
});

test('un perfil legado eliminado no bloquea el reingreso aunque su identidad Auth siga habilitada', async () => {
  const store = fakeFirestore();
  seedCode(store);
  const oldUid = 'uid_cliente_anterior';
  const newUid = 'uid_cliente_nuevo';
  store.put(`users/${oldUid}`, { email: EMAIL, deleted: true, profileStatus: 'deleted', blocked: true });
  store.deps.findProfilesByEmail = async () => [{ fields: encodeFirestoreFields({
    email: EMAIL, deleted: true, profileStatus: 'deleted', blocked: true
  }) }];
  let currentUid = oldUid;
  store.deps.findOrCreateUserByEmail = async () => ({ uid: currentUid, isNewUser: currentUid === newUid });
  store.deps.deleteUser = async (_env, uid) => {
    store.deps.deletedIdentities.push(uid);
    currentUid = newUid;
  };
  store.deps.lookupUser = async (_env, { uid }) => ({ uid, email: EMAIL, disabled: false });

  const result = await verify(store, { email: EMAIL, code: CODE });

  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.deepEqual(store.deps.deletedIdentities, [oldUid]);
  assert.equal(store.deps.tokenCreations, 1);
});

test('una identidad Auth residual deshabilitada se reemplaza tras verificar el correo si no hay perfil bloqueado', async () => {
  const store = fakeFirestore();
  seedCode(store);
  let currentUid = 'uid_cliente_anterior';
  store.deps.findOrCreateUserByEmail = async () => {
    store.deps.logins += 1;
    if (currentUid === 'uid_cliente_anterior') return { uid: currentUid, isNewUser: false };
    return { uid: currentUid, isNewUser: true };
  };
  store.deps.lookupUser = async (_env, { uid }) => ({
    uid,
    email: EMAIL,
    disabled: uid === 'uid_cliente_anterior',
  });
  store.deps.deleteUser = async (_env, uid) => {
    store.deps.deletedIdentities.push(uid);
    currentUid = 'uid_cliente_nuevo';
  };
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.deepEqual(store.deps.deletedIdentities, ['uid_cliente_anterior']);
  assert.equal(store.deps.logins, 2);
  assert.equal(store.deps.tokenCreations, 1);
});

test('un código incorrecto descuenta intentos y el sexto queda bloqueado', async () => {
  const store = fakeFirestore();
  seedCode(store);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await verify(store, { email: EMAIL, code: '000000' });
    assert.equal(result.error, 'code_mismatch');
    assert.equal(result.attemptsRemaining, 5 - attempt);
  }
  const blocked = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.error, 'too_many_attempts');
  assert.equal(store.deps.logins, 0);
});

test('la cuenta Super Admin no puede entrar con código por correo', async () => {
  const store = fakeFirestore();
  seedCode(store, { email: SUPERADMIN_EMAIL });
  const result = await verify(store, { email: SUPERADMIN_EMAIL, code: CODE });
  assert.equal(result.status, 403);
  assert.equal(result.error, 'email_not_allowed');
  assert.equal(store.deps.logins, 0);
});

test('una IP con demasiados códigos fallidos en el día queda frenada', async () => {
  const store = fakeFirestore();
  const ip = '192.0.2.10';
  for (let index = 0; index < 8; index += 1) {
    const email = `persona${index}@example.com`;
    seedCode(store, { email });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await verify(store, { email, code: '000000' }, ip);
      assert.equal(result.error, 'code_mismatch');
    }
  }
  seedCode(store);
  const limited = await verify(store, { email: EMAIL, code: CODE }, ip);
  assert.equal(limited.status, 429);
  assert.equal(limited.error, 'rate_limit_exceeded');
  assert.ok(limited.retryAfterSeconds > 0);
  assert.equal(store.deps.logins, 0);

  const otherIp = await verify(store, { email: EMAIL, code: CODE }, '192.0.2.11');
  assert.equal(otherIp.success, true);
});

test('Firestore caído al leer el código responde storage_unavailable', async () => {
  const store = fakeFirestore();
  store.deps.get = async (_env, path) => {
    if (path.startsWith('emailOtpCodes/')) throw new Error('down');
    return null;
  };
  const result = await verify(store, { email: EMAIL, code: CODE });
  assert.equal(result.status, 503);
  assert.equal(result.error, 'storage_unavailable');
});
