// Ejecuta el tramo real del guard de admin-app.js que decide a dónde va una
// sesión según su rol (se extrae del archivo y se corre con Firebase simulado).
// Sostiene la conexión «Roles → Página de perfil» del Flujo de conexiones: una
// cuenta sin rol interno que abre /admin va a su perfil, nunca al login; una
// cuenta interna bloqueada va al aviso; el personal habilitado sigue al panel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ADMIN = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const SUPER_ADMIN = 'tintinaccs@gmail.com';
const START = 'const role = await getUserRole(user.uid, user.email);';
const END = 'const storeCfg = await getStoreAccessConfig();';

function guardSegment() {
  const start = ADMIN.indexOf(START);
  assert.notEqual(start, -1, 'admin-app.js ya no resuelve el rol con getUserRole(user.uid, user.email)');
  assert.equal(ADMIN.indexOf(START, start + 1), -1, 'la resolución del rol del guard debe existir una sola vez');
  const end = ADMIN.indexOf(END, start);
  assert.notEqual(end, -1, 'no se encontró el final del tramo de rol del guard');
  const segment = ADMIN.slice(start, end);
  assert.ok(segment.length < 3000, 'el tramo de rol creció: revisar que la prueba siga cubriendo sólo la decisión de destino');
  return segment;
}

const runSegment = new Function('deps', `
  const { user, snapshot, getUserRole, setOperationsViewerRole, SUPER_ADMIN, getDoc, doc, db, window, CustomEvent, recordAuthDiagnostic } = deps;
  let currentRole = null;
  return (async () => {
    ${guardSegment()}
    return { continued: true, currentRole };
  })();
`);

async function runGuard({ role, email = 'persona@example.com', profile = { blocked: false } } = {}) {
  const world = { redirects: [], events: [], diagnostics: [], profileReads: [], viewerRoles: [] };
  const result = await runSegment({
    user: { uid: 'u1', email },
    snapshot: { status: 'authenticated' },
    getUserRole: async (uid, userEmail) => { assert.equal(uid, 'u1'); assert.equal(userEmail, email); return role; },
    setOperationsViewerRole: value => world.viewerRoles.push(value),
    SUPER_ADMIN,
    db: { name: 'db' },
    doc: (db, collection, id) => `${collection}/${id}`,
    getDoc: async path => { world.profileReads.push(path); return { exists: () => profile !== null, data: () => profile }; },
    window: {
      dispatchEvent: event => world.events.push(event),
      location: { replace: url => world.redirects.push(url) },
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    recordAuthDiagnostic: (event, detail) => world.diagnostics.push({ event, ...detail }),
  });
  return { world, continued: result?.continued === true };
}

test('una clienta que abre /admin va a su perfil y no entra al panel', async () => {
  const { world, continued } = await runGuard({ role: 'client' });
  assert.deepEqual(world.redirects, ['perfil.html']);
  assert.equal(continued, false, 'el guard se detiene: no se abren datos del panel');
  assert.ok(world.diagnostics.some(item => item.reason === 'authenticated-without-admin-role' && item.destination === undefined));
  assert.ok(world.diagnostics.some(item => item.destination === 'profile'));
  assert.ok(!world.redirects.some(url => /login/.test(url)), 'una sesión válida sin rol interno nunca vuelve al login');
});

test('una cuenta sin rol resuelto también va a su perfil', async () => {
  for (const role of [null, undefined, '']) {
    const { world, continued } = await runGuard({ role });
    assert.deepEqual(world.redirects, ['perfil.html'], `rol=${String(role)}`);
    assert.equal(continued, false);
  }
});

test('el personal habilitado sigue al panel sin redirecciones', async () => {
  for (const role of ['admin', 'agent', 'viewer']) {
    const { world, continued } = await runGuard({ role });
    assert.deepEqual(world.redirects, [], `rol=${role}`);
    assert.equal(continued, true);
    assert.deepEqual(world.profileReads, ['users/u1'], 'se revisa el bloqueo en su propio perfil');
    assert.deepEqual(world.viewerRoles, [role]);
  }
});

test('una cuenta interna bloqueada va al aviso de bloqueo y no al panel', async () => {
  const { world, continued } = await runGuard({ role: 'agent', profile: { blocked: true } });
  assert.deepEqual(world.redirects, ['perfil.html?blocked=1']);
  assert.equal(continued, false);
  assert.deepEqual(world.events.map(event => [event.type, event.detail]), [['tintin:account-blocked', { uid: 'u1' }]]);
});

test('el bloqueo se revisa antes que el rol: una clienta bloqueada recibe el aviso', async () => {
  const { world } = await runGuard({ role: 'client', profile: { blocked: true } });
  assert.deepEqual(world.redirects, ['perfil.html?blocked=1']);
});

test('el Super Admin se reconoce por su correo y no depende de leer su perfil', async () => {
  const { world, continued } = await runGuard({ role: 'superadmin', email: 'TintinAccs@gmail.com', profile: { blocked: true } });
  assert.deepEqual(world.profileReads, [], 'no se consulta blocked para el Super Admin');
  assert.deepEqual(world.redirects, []);
  assert.equal(continued, true);
});
