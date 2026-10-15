import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseUser, SUPERADMIN_EMAIL } from '../../cloudflare/seguridad-cloudinary.js';
import { encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { handleProfileAvatarUpload } from '../../functions/api/profile-avatar-upload.js';

const request = () => new Request('https://shop.test/api/profile-avatar-upload', {
  method: 'POST', headers: { origin: 'https://shop.test', authorization: 'Bearer fixture' }, body: 'fixture',
});
const user = { uid: 'customer', email: 'customer@example.test' };
const deps = profile => ({
  verify: async () => user, limit: async () => {},
  get: async (_env, path) => { assert.equal(path, 'users/customer'); return profile ? { fields: encodeFirestoreFields(profile) } : null; },
});
for (const profile of [{ blocked: true }, { deleted: true }, { profileStatus: 'deleted' }]) {
  test(`el token todavía vigente no evita el bloqueo: ${JSON.stringify(profile)}`, async () => {
    await assert.rejects(requireFirebaseUser(request(), {}, deps(profile)), { status: 403, code: 'auth/account-disabled' });
    const response = await handleProfileAvatarUpload({ request: request(), env: {} }, {
      requireUser: (req, env) => requireFirebaseUser(req, env, deps(profile)),
    });
    assert.equal(response.status, 403, 'no alcanza el proveedor ni la validación de imagen');
  });
}
for (const profile of [null, { profileStatus: 'incomplete' }, { profileStatus: 'active', blocked: false }]) {
  test(`el alta y las cuentas activas conservan acceso: ${JSON.stringify(profile)}`, async () => {
    assert.equal((await requireFirebaseUser(request(), {}, deps(profile))).uid, user.uid);
  });
}
test('un fallo al leer el estado falla cerrado sin exponer el error interno', async () => {
  await assert.rejects(requireFirebaseUser(request(), {}, { ...deps(null), get: async () => { throw Error('internal-secret'); } }),
    { status: 503, code: 'auth/account-state-unavailable', message: 'No se pudo comprobar la cuenta. Reintentá.' });
});
test('Super Admin mantiene la excepción de autoridad de las reglas', async () => {
  const result = await requireFirebaseUser(request(), {}, { ...deps(null), verify: async () => ({ uid: 'owner', email: SUPERADMIN_EMAIL }), get: async () => { throw Error('must not read'); } });
  assert.equal(result.uid, 'owner');
});
