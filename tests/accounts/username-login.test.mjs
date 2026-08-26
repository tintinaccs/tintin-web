import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEmailFromUsernameKey,
  encodeFirestoreFields,
} from '../../cloudflare/firebase-admin-ligero.js';

function doc(fields) {
  return { fields: encodeFirestoreFields(fields) };
}

test('resolveEmailFromUsernameKey devuelve el email de la cuenta dueña del username', async () => {
  const calls = [];
  const get = async (_env, path) => {
    calls.push(path);
    if (path === 'usernameReservations/ana98') return doc({ uid: 'uid_ana' });
    if (path === 'users/uid_ana') return doc({ email: 'ANA@example.com' });
    return null;
  };

  const email = await resolveEmailFromUsernameKey({}, 'ana98', { get });
  assert.equal(email, 'ana@example.com');
  assert.deepEqual(calls, ['usernameReservations/ana98', 'users/uid_ana']);
});

test('resolveEmailFromUsernameKey devuelve null cuando el username no tiene reserva', async () => {
  const get = async () => null;
  assert.equal(await resolveEmailFromUsernameKey({}, 'nadie', { get }), null);
});

test('resolveEmailFromUsernameKey devuelve null cuando la reserva no tiene cuenta con email', async () => {
  const get = async (_env, path) => {
    if (path === 'usernameReservations/huerfano') return doc({ uid: 'uid_x' });
    return null; // users/uid_x no existe
  };
  assert.equal(await resolveEmailFromUsernameKey({}, 'huerfano', { get }), null);
});

test('resolveEmailFromUsernameKey devuelve null para un key vacío sin llamar a Firestore', async () => {
  let called = false;
  const get = async () => { called = true; return null; };
  assert.equal(await resolveEmailFromUsernameKey({}, '', { get }), null);
  assert.equal(called, false);
});
