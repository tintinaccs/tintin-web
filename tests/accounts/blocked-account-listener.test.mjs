// Ejecuta el guardia real de perfil (control-acceso-perfil.js) con Firebase
// simulado. A diferencia de profile-gate-all-pages.test.mjs, que lee el texto
// del archivo, acá corre el código: una cuenta con blocked=true debe perder la
// sesión una sola vez y llegar a /login?blocked=1 con su correo disponible
// para el botón de WhatsApp. Es la prueba que sostiene la conexión
// «users/{uid} → Cuenta bloqueada» del Flujo de conexiones.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getProfileCompletionPlan } from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const SOURCE = fs.readFileSync(new URL('../../js/pages/profile/control-acceso-perfil.js', import.meta.url), 'utf8');
const SUPER_ADMIN = 'tintinaccs@gmail.com';
const AUTH_STATES = { UNKNOWN: 'unknown', RESTORING: 'restoring', AUTHENTICATED: 'authenticated', SIGNED_OUT: 'signed-out' };
const COMPLETE_PROFILE = {
  role: 'client',
  firstName: 'Ana',
  lastName: 'Gómez',
  phone: '+595981123456',
  username: 'ana_gomez',
  dob: new Date('1990-01-01'),
  savedLocation: { lat: -25.29, lng: -57.63, name: 'Casa', address: 'San Lorenzo, Paraguay' },
};

// Convierte los import/export del módulo en dependencias inyectadas para poder
// ejecutarlo en Node sin red. Si el módulo cambia de forma de importar, la
// prueba falla en vez de pasar sin ejecutar nada.
function loadGate({ pathname = '/catalogo', search = '', hash = '' } = {}) {
  const exported = [...SOURCE.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map(match => match[1]);
  const body = SOURCE
    .replace(/^import\s+\{([^}]+)\}\s+from\s+["'][^"']+["'];?[ \t]*$/gm, (_, names) => `const {${names}} = __deps;`)
    .replace(/^export\s+((?:async\s+)?function\s+)/gm, '$1');
  assert.doesNotMatch(body, /^\s*import\s/m, 'quedó un import sin inyectar: actualizar loadGate');
  assert.deepEqual(exported.sort(), ['clearProfileGateCache', 'consumeBlockedEmail', 'startProfileGate']);

  const world = { signOuts: 0, redirects: [], listeners: [], unsubscribed: 0, diagnostics: [], sessionCallback: null, warnings: [] };
  const storage = new Map();
  const sessionStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  const location = { pathname, search, hash, replace: url => world.redirects.push(url) };
  const deps = {
    auth: { name: 'auth' },
    db: { name: 'db' },
    AUTH_STATES,
    subscribeSession: callback => { world.sessionCallback = callback; },
    recordAuthDiagnostic: (event, detail) => world.diagnostics.push({ event, ...detail }),
    doc: (db, collection, id) => ({ path: `${collection}/${id}` }),
    onSnapshot: (ref, next, error) => {
      world.listeners.push({ path: ref.path, next, error });
      return () => { world.unsubscribed += 1; };
    },
    signOut: async auth => { assert.equal(auth.name, 'auth'); world.signOuts += 1; },
    getProfileCompletionPlan,
    SUPER_ADMIN,
  };
  const gate = new Function('__deps', 'location', 'sessionStorage', 'console',
    `${body}\nreturn { ${exported.join(', ')} };`)(deps, location, sessionStorage, { warn: (...args) => world.warnings.push(args) });
  return { gate, world, storage };
}

const snapshot = data => ({ exists: () => data !== null, data: () => data });
const settle = () => new Promise(resolve => setImmediate(resolve));
const signIn = (world, user) => world.sessionCallback({ status: AUTH_STATES.AUTHENTICATED, user });
const CLIENT = { uid: 'u-clienta', email: 'clienta@example.com' };

test('cuenta bloqueada al cargar: cierra la sesión una vez y lleva al aviso con su correo', async () => {
  const { gate, world } = loadGate();
  gate.startProfileGate();
  signIn(world, CLIENT);
  assert.deepEqual(world.listeners.map(item => item.path), ['users/u-clienta'], 'debe escuchar sólo su propio perfil');

  world.listeners[0].next(snapshot({ ...COMPLETE_PROFILE, blocked: true }));
  await settle();
  assert.equal(world.signOuts, 1);
  assert.deepEqual(world.redirects, ['/login?blocked=1']);
  assert.ok(world.diagnostics.some(item => item.reason === 'account-blocked'));

  // Firestore puede volver a emitir el mismo documento: no se repite la salida.
  world.listeners[0].next(snapshot({ ...COMPLETE_PROFILE, blocked: true }));
  await settle();
  assert.equal(world.signOuts, 1, 'un segundo snapshot no vuelve a cerrar la sesión');
  assert.deepEqual(world.redirects, ['/login?blocked=1']);

  assert.equal(gate.consumeBlockedEmail(), 'clienta@example.com', 'el login recibe el correo para el enlace de WhatsApp');
  assert.equal(gate.consumeBlockedEmail(), '', 'el correo se entrega una sola vez');
});

test('bloqueo mientras navega: el perfil sano no molesta y el bloqueo posterior la saca', async () => {
  const { gate, world } = loadGate();
  gate.startProfileGate();
  signIn(world, CLIENT);

  world.listeners[0].next(snapshot({ ...COMPLETE_PROFILE, blocked: false }));
  await settle();
  assert.equal(world.signOuts, 0);
  assert.deepEqual(world.redirects, [], 'una clienta con perfil completo y sin bloqueo sigue navegando');

  world.listeners[0].next(snapshot({ ...COMPLETE_PROFILE, blocked: true }));
  await settle();
  assert.equal(world.signOuts, 1);
  assert.deepEqual(world.redirects, ['/login?blocked=1']);
});

test('sólo blocked === true bloquea; un perfil incompleto va a completar datos sin cerrar la sesión', async () => {
  for (const blocked of [undefined, false, 'true', 1]) {
    const { gate, world } = loadGate();
    gate.startProfileGate();
    signIn(world, CLIENT);
    world.listeners[0].next(snapshot({ ...COMPLETE_PROFILE, blocked }));
    await settle();
    assert.equal(world.signOuts, 0, `blocked=${String(blocked)} no debe cerrar la sesión`);
    assert.deepEqual(world.redirects, []);
  }

  const { gate, world } = loadGate({ pathname: '/checkout', search: '?paso=2' });
  gate.startProfileGate();
  signIn(world, CLIENT);
  world.listeners[0].next(snapshot({ role: 'client', firstName: 'Ana', lastName: 'Gómez' }));
  await settle();
  assert.equal(world.signOuts, 0, 'faltar datos no es un bloqueo');
  assert.deepEqual(world.redirects, [`/login?from=${encodeURIComponent('/checkout?paso=2')}`]);
});

test('un fallo al leer el perfil no expulsa a nadie', async () => {
  const { gate, world } = loadGate();
  gate.startProfileGate();
  signIn(world, CLIENT);
  world.listeners[0].error(Object.assign(new Error('offline'), { code: 'unavailable' }));
  await settle();
  assert.equal(world.signOuts, 0);
  assert.deepEqual(world.redirects, []);
  assert.equal(world.warnings.length, 1);
});

test('Super Admin, visitantes y páginas exentas no abren el listener de bloqueo', async () => {
  const superAdmin = loadGate();
  superAdmin.gate.startProfileGate();
  signIn(superAdmin.world, { uid: 'u-super', email: 'TintinAccs@gmail.com' });
  assert.equal(superAdmin.world.listeners.length, 0);

  const visitor = loadGate();
  visitor.gate.startProfileGate();
  visitor.world.sessionCallback({ status: AUTH_STATES.SIGNED_OUT, user: null });
  assert.equal(visitor.world.listeners.length, 0);

  for (const pathname of ['/login', '/perfil', '/admin', '/admin-images.html']) {
    const exempt = loadGate({ pathname });
    exempt.gate.startProfileGate();
    assert.equal(exempt.world.sessionCallback, null, `${pathname} no debe suscribirse: tiene su propio control`);
  }
});

test('al cambiar de cuenta se suelta el listener anterior y no se mezclan perfiles', async () => {
  const { gate, world } = loadGate();
  gate.startProfileGate();
  signIn(world, CLIENT);
  signIn(world, { uid: 'u-otra', email: 'otra@example.com' });
  assert.equal(world.unsubscribed, 1);
  assert.deepEqual(world.listeners.map(item => item.path), ['users/u-clienta', 'users/u-otra']);

  world.listeners[1].next(snapshot({ ...COMPLETE_PROFILE, blocked: true }));
  await settle();
  assert.equal(world.signOuts, 1);
  assert.equal(gate.consumeBlockedEmail(), 'otra@example.com');
});
