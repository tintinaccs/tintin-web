import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../js/core/auth/roles.js', import.meta.url), 'utf8');
const moduleSource = source
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '');

function createHarness({ pathname = '/admin', user = null, read = async () => ({ exists: () => false }) } = {}) {
  const auth = { currentUser: user };
  const context = {
    auth,
    db: {},
    window: { location: { pathname } },
    console: { error() {} },
    SUPER_ADMIN_EMAIL: 'tintinaccs@gmail.com',
    ASSIGNABLE_ROLES: ['admin', 'agent', 'viewer', 'client'],
    doc: (_db, collection, uid) => ({ collection, uid }),
    getDoc: read,
    setDoc: async () => {},
    serverTimestamp: () => 'timestamp'
  };
  vm.createContext(context);
  vm.runInContext(`${moduleSource}\nthis.resolveRole = getUserRole;`, context);
  return { auth, resolveRole: context.resolveRole };
}

function user(email, claims = { email }) {
  return { uid: 'uid-1', email, getIdTokenResult: async () => ({ claims }) };
}

test('SuperAdmin is resolved from the authenticated token', async () => {
  const { resolveRole } = createHarness({ user: user('tintinaccs@gmail.com') });
  assert.equal(await resolveRole('uid-1', 'other@example.com'), 'superadmin');
});

test('an email argument cannot grant SuperAdmin access', async () => {
  const { resolveRole } = createHarness({ user: user('client@example.com') });
  assert.equal(await resolveRole('uid-1', 'tintinaccs@gmail.com'), 'client');
});

test('the admin route rejects an unavailable or mismatched session', async () => {
  const { resolveRole } = createHarness();
  await assert.rejects(resolveRole('uid-1', 'tintinaccs@gmail.com'), { code: 'auth/session-unavailable' });
  const mismatch = createHarness({ user: user('admin@example.com') });
  await assert.rejects(mismatch.resolveRole('another-uid', 'admin@example.com'), { code: 'auth/session-unavailable' });
});

test('a Firestore authorization error is not converted into a client role in admin', async () => {
  const error = Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' });
  const { resolveRole } = createHarness({ user: user('admin@example.com'), read: async () => { throw error; } });
  await assert.rejects(resolveRole('uid-1', 'admin@example.com'), { code: 'permission-denied' });
});

test('ordinary client onboarding retains its existing fallback contract', async () => {
  const { resolveRole } = createHarness({ pathname: '/perfil', user: user('client@example.com'), read: async () => { throw new Error('offline'); } });
  assert.equal(await resolveRole('uid-1', 'client@example.com'), 'client');
});

test('a valid admin role is read from the authoritative user document', async () => {
  const { resolveRole } = createHarness({ user: user('admin@example.com'), read: async () => ({ exists: () => true, data: () => ({ role: 'admin' }) }) });
  assert.equal(await resolveRole('uid-1', 'admin@example.com'), 'admin');
});
