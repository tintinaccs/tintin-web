import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/auth/app-check-admin.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replace('export async function', 'async function');
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
function fixture() {
  const restored = deferred(), credential = deferred();
  let refreshes = 0;
  const user = { uid: 'fixture-a', getIdToken(force) { assert.equal(force, true); refreshes++; return credential.promise; } };
  const auth = { currentUser: null, authStateReady: () => restored.promise };
  const timers = [];
  const window = { TintinAppCheckStatus: 'enabled', setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} };
  const context = vm.createContext({ auth, authPersistenceReady: Promise.resolve(), window, appCheck: {}, appCheckReady: Promise.resolve(true) });
  vm.runInContext(source + ';globalThis.wait = waitForAdminAppCheck;', context);
  return { auth, user, restored, credential, timers, context, refreshes: () => refreshes };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('App Check habilitado no autoriza arrancar antes de restaurar Auth', async () => {
  const f = fixture();
  let settled = false;
  const gate = f.context.wait().then(ok => { settled = true; return ok; });
  await flush();
  assert.equal(settled, false);
  assert.equal(f.refreshes(), 0);
  f.auth.currentUser = f.user;
  f.restored.resolve();
  await flush();
  assert.equal(settled, false);
  assert.equal(f.refreshes(), 1);
  f.credential.resolve('fixture-only');
  assert.equal(await gate, true);
});

test('diez módulos comparten una sola renovación y reutilizan su resultado', async () => {
  const f = fixture();
  f.auth.currentUser = f.user;
  const gates = Array.from({length: 10}, () => f.context.wait());
  f.restored.resolve();
  await flush();
  assert.equal(f.refreshes(), 1);
  f.credential.resolve('fixture-only');
  assert.deepEqual(await Promise.all(gates), Array(10).fill(true));
  assert.equal(await f.context.wait(), true);
  assert.equal(f.refreshes(), 1);
});

test('una sesión que se cierra durante la renovación no abre consultas', async () => {
  const f = fixture();
  f.auth.currentUser = f.user;
  const gate = f.context.wait();
  f.restored.resolve();
  await flush();
  f.auth.currentUser = null;
  f.credential.resolve('fixture-only');
  assert.equal(await gate, false);
});

test('sin sesión o con error de credencial no se admite el acceso; se puede reintentar', async () => {
  const f = fixture();
  const empty = f.context.wait();
  f.restored.resolve();
  assert.equal(await empty, false);
  f.auth.currentUser = { uid: 'fixture-a', getIdToken: async () => { throw new Error('fixture network error'); } };
  assert.equal(await f.context.wait(), false);
  f.auth.currentUser = f.user;
  f.credential.resolve('fixture-only');
  assert.equal(await f.context.wait(), true);
});

test('un plazo vencido devuelve control sin convertirlo en autenticación', async () => {
  const f = fixture();
  const gate = f.context.wait();
  f.timers[0]();
  assert.equal(await gate, false);
});

test('las seis superficies auxiliares consumen el gate estricto, no el timeout público', () => {
  for (const path of ['content/gestion-contenido-admin.js', 'pages/paginas-admin.js', 'settings/control-tienda-admin.js', 'settings/esquema-color-admin.js', 'settings/metodos-pago-admin.js', 'settings/sincronizacion-correo-admin.js']) {
    const module = fs.readFileSync(new URL(`../../js/admin/${path}`, import.meta.url), 'utf8');
    assert.match(module, /await waitForAdminAppCheck\(12000\)/);
    assert.doesNotMatch(module, /await appCheckReady/);
  }
});
