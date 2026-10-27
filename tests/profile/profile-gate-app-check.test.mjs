import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getProfileCompletionPlan } from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const helper = read('js/core/firebase/suscripcion-app-check.js');
const gate = read('js/pages/profile/control-acceso-perfil.js').replace(/import\('[^']*tutorial-bienvenida\.js\?v=[^']+'\)/, 'loadWelcome()');
const tick = () => new Promise(resolve => setImmediate(resolve));
const client = { uid: 'client-a', email: 'client@example.test' };
function setup(pathname='/checkout') {
  let settle, session;
  const events = new Set(), calls = [], warnings = [], redirects = [], storage = new Map();
  let stops = 0, signOuts = 0, welcomeLoads = 0;
  const context = vm.createContext({
    loadWelcome: async () => { welcomeLoads++; },
    appCheckReady: new Promise(resolve => { settle = resolve; }),
    window: { addEventListener: (_name, listener) => events.add(listener), removeEventListener: (_name, listener) => events.delete(listener) },
    location: { pathname, search: '', hash: '', replace: url => redirects.push(url) },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    auth: {}, db: {}, SUPER_ADMIN: 'owner@example.test', AUTH_STATES: { RESTORING: 'restoring', UNKNOWN: 'unknown' },
    subscribeSession: callback => { session = callback; }, recordAuthDiagnostic: () => {}, getProfileCompletionPlan,
    doc: (_db, collection, uid) => `${collection}/${uid}`,
    onSnapshot: (reference, next, fail) => { calls.push({ reference, next, fail }); return () => { stops++; }; },
    signOut: async () => { signOuts++; }, console: { warn: (...args) => warnings.push(args) },
  });
  vm.runInContext(helper + '\n' + gate, context);
  context.startProfileGate();
  return { calls, warnings, redirects, events, settle,
    session: user => session({ status: user ? 'authenticated' : 'signed-out', user }),
    ready: () => { context.window.TintinAppCheckStatus = 'enabled'; for (const listener of events) listener({ detail: { ready: true } }); },
    get welcomeLoads() { return welcomeLoads; },
    get stops() { return stops; }, get signOuts() { return signOuts; },
  };
}

test('perfil espera App Check y recupera el token tardío sin abrir conexiones duplicadas', async () => {
  const state = setup(); state.session(client);
  assert.equal(state.calls.length, 0, 'Auth listo todavía no autoriza abrir Firestore');
  state.settle(false); await tick();
  assert.equal(state.calls.length, 0);
  assert.equal(state.warnings[0][1].code, 'app-check-unavailable');
  state.ready(); state.ready();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].reference, 'users/client-a');
  state.calls[0].next({ exists: () => true, data: () => ({ blocked: true }) }); await tick();
  assert.equal(state.signOuts, 1);
  assert.deepEqual(state.redirects, ['/login?blocked=1']);
});
test('cerrar sesión antes del token impide suscribir el perfil anterior', async () => {
  const state = setup(); state.session(client); state.session(null);
  state.ready(); state.settle(true); await tick();
  assert.equal(state.calls.length, 0); assert.equal(state.events.size, 0);
});
test('cambiar de cuenta mientras se espera sólo abre el perfil vigente', async () => {
  const state = setup(); state.session(client); state.session({ uid: 'client-b', email: 'other@example.test' });
  state.settle(true); await tick(); state.ready();
  assert.deepEqual(state.calls.map(call => call.reference), ['users/client-b']);
});
test('rechazo real de reglas sigue visible y no genera reintentos automáticos', async () => {
  const state = setup(); state.settle(true); await tick(); state.session(client); await tick();
  state.calls[0].fail({ code: 'permission-denied' }); state.ready();
  assert.equal(state.warnings[0][1].code, 'permission-denied'); assert.equal(state.calls.length, 1);
});
test('cerrar sesión cancela la conexión e ignora respuestas antiguas de bloqueo', async () => {
  const state = setup(); state.settle(true); await tick(); state.session(client); await tick();
  state.session(null);
  state.calls[0].next({ exists: () => true, data: () => ({ blocked: true }) }); await tick();
  assert.equal(state.stops, 1); assert.equal(state.signOuts, 0); assert.deepEqual(state.redirects, []);
});

test('perfil carga una sola guía pública para cuentas nuevas y no para cuentas existentes',async()=>{
  for(const pending of [true,false]){
    const state=setup('/catalogo');state.settle(true);await tick();state.session(client);await tick();
    const data={role:'client',profileStatus:'active',firstName:'Lucía',lastName:'Benítez',name:'Lucía Benítez',phone:'+595981123456',savedLocation:{lat:-25.29,lng:-57.63,name:'Casa',address:'San Lorenzo'},welcomeTutorialPending:pending};
    state.calls[0].next({exists:()=>true,data:()=>data});
    state.calls[0].next({exists:()=>true,data:()=>data});await tick();
    assert.equal(state.welcomeLoads,pending?1:0);
    assert.deepEqual(state.redirects,[]);
  }
});

test('el guardia de checkout no descarga ni consume la primera bienvenida',async()=>{
 const state=setup();state.settle(true);await tick();state.session(client);await tick();
 const data={role:'client',profileStatus:'active',firstName:'Lucía',lastName:'Benítez',name:'Lucía Benítez',phone:'+595981123456',savedLocation:{lat:-25.29,lng:-57.63,name:'Casa',address:'San Lorenzo'},welcomeTutorialPending:true};
 state.calls[0].next({exists:()=>true,data:()=>data});await tick();
 assert.equal(state.welcomeLoads,0);assert.deepEqual(state.redirects,[]);
});
