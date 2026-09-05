import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileAvatarReconciler } from '../../functions/api/profile-avatar-reconcile.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

function fixture(profile, { authError, pending = [] } = {}) {
  const updates = [];
  const commits = [];
  const env = {};
  const handler = createProfileAvatarReconciler({
    authenticate: async () => ({ uid: 'test-user', email: 'test@example.test' }),
    getProfile: async (receivedEnv, path) => {
      assert.equal(receivedEnv, env);
      assert.equal(path, 'users/test-user');
      return profile === null ? null : { fields: encodeFirestoreFields(profile) };
    },
    updateAuth: async (receivedEnv, uid, payload) => {
      assert.equal(receivedEnv, env);
      updates.push({ uid, payload });
      if (authError) throw authError;
    },
    listPending: async (_env, path, limit) => {
      assert.equal(path, 'users/test-user/profilePhotoReconciliations');
      assert.equal(limit, 20);
      return pending;
    },
    commit: async (_env, writes) => { commits.push(writes); },
  });
  return {
    updates, commits,
    run: () => handler({ env, request: new Request('https://tintinaccesorios.pages.dev/api/profile-avatar-reconcile', {
      method: 'POST', headers: { origin: 'https://tintinaccesorios.pages.dev' },
    }) }),
  };
}

for (const [name, profile, expected] of [
  ['la retirada explícita no resucita la URL heredada', { photoURL: '', photoUrl: 'https://old.example/photo.png' }, ''],
  ['un perfil antiguo conserva compatibilidad', { photoUrl: 'https://old.example/photo.png' }, 'https://old.example/photo.png'],
  ['la foto canónica prevalece sobre la heredada', { photoURL: 'https://new.example/photo.png', photoUrl: 'https://old.example/photo.png' }, 'https://new.example/photo.png'],
  ['un perfil sin foto sincroniza el valor vacío', {}, ''],
]) {
  test(name, async () => {
    const f = fixture(profile);
    const response = await f.run();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, authSync: 'synchronized', resolved: 0 });
    assert.deepEqual(f.updates, [{ uid: 'test-user', payload: { photoURL: expected } }]);
    assert.deepEqual(f.commits, []);
  });
}

test('un fallo de Auth no marca reconciliaciones como resueltas', async () => {
  const f = fixture({ photoURL: '' }, { authError: new Error('Auth unavailable') });
  const response = await f.run();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  assert.deepEqual(f.commits, []);
});

test('la falta de perfil no borra la foto de Auth por accidente', async () => {
  const f = fixture(null);
  assert.equal((await f.run()).status, 503);
  assert.deepEqual(f.updates, []);
});

test('una reconciliación antigua no se resuelve con una foto diferente', async () => {
  const f = fixture({ photoURL: '', photoUrl: 'https://old.example/photo.png' }, {
    pending: [{ name: 'users/test-user/profilePhotoReconciliations/old',
      fields: encodeFirestoreFields({ state: 'pending', photoURL: 'https://old.example/photo.png' }) }],
  });
  const response = await f.run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).resolved, 0);
  assert.deepEqual(f.commits, []);
  assert.equal(f.updates[0].payload.photoURL, '');
});

test('la retirada pendiente se resuelve con precondición y registro de auditoría', async () => {
  const f = fixture({ photoURL: '' }, {
    pending: [{ name: 'users/test-user/profilePhotoReconciliations/removal',
      updateTime: '2026-09-05T00:00:00Z',
      fields: encodeFirestoreFields({ state: 'pending', photoURL: '', attempts: 2 }) }],
  });
  const response = await f.run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).resolved, 1);
  assert.equal(f.commits.length, 1);
  const [pendingWrite, auditWrite] = f.commits[0];
  assert.equal(pendingWrite.path, 'users/test-user/profilePhotoReconciliations/removal');
  assert.deepEqual(pendingWrite.currentDocument, { updateTime: '2026-09-05T00:00:00Z' });
  assert.equal(decodeFirestoreFields(pendingWrite.fields).attempts, 3);
  assert.equal(decodeFirestoreFields(pendingWrite.fields).state, 'resolved');
  assert.match(auditWrite.path, /^auditLog\//);
  assert.deepEqual(auditWrite.currentDocument, { exists: false });
  assert.equal(decodeFirestoreFields(auditWrite.fields).entityId, 'test-user');
});
