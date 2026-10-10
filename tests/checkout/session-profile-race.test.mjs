import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../../checkout.html', import.meta.url), 'utf8');
const forwardValidation = fs.readFileSync(new URL('../../js/pages/checkout/validacion-avance.js', import.meta.url), 'utf8').replace(/export function/g, 'function');
const runtime = forwardValidation + fs.readFileSync(new URL('../../js/pages/checkout/checkout-hardening.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const user = uid => ({ uid, emailVerified: true });
const snapshot = profile => ({ exists: () => true, data: () => profile });

function hardeningFixture() {
  const reads = new Map(), timers = [], errors = [];
  const window = { addEventListener() {}, scrollTo() {}, setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; }, clearTimeout(t) { if(t) t.cleared = true; } };
  const context = vm.createContext({
    window, location: { pathname: '/checkout' }, db: {}, console: { error() {} },
    AUTH_STATES: { RESTORING: 'restoring', UNKNOWN: 'unknown' }, subscribeSession(fn) { context.observer = fn; },
    waitForSession: async () => {},
    readCheckoutProfile(user) { const read = deferred(); reads.set(user.uid, read); return read.promise.then(snap => snap.exists() ? snap.data() : null); },
    document: { readyState: 'complete', body: { classList: { contains: () => false } }, addEventListener() {}, querySelectorAll: () => [], getElementById: id => id.startsWith('error-') ? { set textContent(v) { errors.push(v); }, classList: { add() {} }, setAttribute() {} } : null },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    awaitCartReady: async () => {}, getCartLocal: () => [{ id: 'fixture', qty: 1 }], updateQty() {}, removeFromCart() {},
    queueMicrotask() {},
  });
  vm.runInContext(runtime, context);
  return { context, reads, timers, errors, state: () => window.TintinCheckoutHardening.profileState };
}

for (const state of ['signed_out', 'unknown', 'other']) test(`perfil viejo no reemplaza estado ${state}`, async () => {
  const f = hardeningFixture(); f.context.observer({ status: 'authenticated', user: user('old') });
  if (state === 'other') {
    f.context.observer({ status: 'authenticated', user: user('new') });
    f.reads.get('new').resolve(snapshot({ name: 'New', blocked: true })); await tick();
  } else f.context.observer({ status: state === 'unknown' ? 'unknown' : 'unauthenticated', user: null });
  f.reads.get('old').resolve(snapshot({ name: 'Old' })); await tick();
  assert.equal(f.state().ok, false);
  assert.equal(f.state().reason, state === 'other' ? 'blocked' : state === 'unknown' ? 'auth_unknown' : 'signed_out');
  assert.equal(f.state().user?.uid || null, state === 'other' ? 'new' : null);
  assert.equal(f.timers.filter(t => t.ms === 5000 && !t.cleared).length, 0);
});

test('clic que esperaba otro perfil no avanza después de cambiar la sesión', async () => {
  const f = hardeningFixture(); let replays = 0;
  f.context.observer({ status: 'authenticated', user: user('old') });
  const event = { preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} };
  const control = { id: 'btn-step2-next', click() { replays++; } };
  const attempt = f.context.guardForwardClick(event, control); await tick();
  f.context.observer({ status: 'unauthenticated', user: null });
  f.reads.get('old').resolve(snapshot({ name: 'Old' })); await attempt;
  assert.equal(replays, 0); assert.match(f.errors.at(-1), /Tu sesión cambió/);
});

test('precarga nativa no prellena dirección ni bloquea con datos de otra sesión', async () => {
  const start = html.indexOf('let checkoutProfileGeneration');
  const source = html.slice(start, html.indexOf('</script>', start));
  const reads = new Map(), applied = [];
  const context = vm.createContext({
    AUTH_STATES: { RESTORING: 'restoring', UNKNOWN: 'unknown' }, db: {}, window: {}, console: { error() {} },
    currentUser: null, currentUserProfile: null, authReady: false, sessionStatus: null,
    subscribeSession(fn) { context.observer = fn; }, doc: (_, __, uid) => uid,
    readCheckoutProfile(user) { const read = deferred(); reads.set(user.uid, read); return read.promise.then(snap => snap.exists() ? snap.data() : null); },
    reevaluateStoreGate_() {}, enforceCheckoutGuard() {}, tryResumeCheckoutStep() {}, applySavedCheckoutIdentity() {},
    maybeApplySavedLocation() { applied.push(context.currentUserProfile); }, showBlockedOverlay() { applied.push('blocked'); },
  });
  vm.runInContext(source, context);
  context.observer({ status: 'authenticated', user: user('old') });
  context.observer({ status: 'authenticated', user: user('new') });
  reads.get('new').resolve(snapshot({ name: 'New', address: 'Current' })); await tick();
  reads.get('old').resolve(snapshot({ name: 'Old', blocked: true, address: 'Private previous' })); await tick();
  assert.equal(context.currentUserProfile.name, 'New'); assert.equal(applied.length, 1);
  context.observer({ status: 'unknown', user: null }); assert.equal(context.currentUserProfile, null);
});

test('primer clic espera restauración y abre acceso una sola vez sin exigir otro clic', async () => {
  const f = hardeningFixture();
  const ready = deferred();
  f.context.waitForSession = () => ready.promise;
  f.context.observer({ status: 'restoring', user: null });
  let replays = 0;
  const event = { preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} };
  const control = { id: 'btn-step1-next', click() { replays++; } };
  const first = f.context.guardForwardClick(event, control);
  const second = f.context.guardForwardClick(event, control);
  await tick();
  assert.equal(replays, 0);
  assert.equal(f.errors.length, 0, 'restauración pendiente no debe producir un error de sesión');
  f.context.observer({ status: 'unauthenticated', user: null });
  ready.resolve();
  await Promise.all([first, second]);
  assert.equal(replays, 1, 'un intento pendiente debe abrir un único modal');
  assert.equal(f.errors.length, 0);
});

test('visitante resuelta no espera la sincronización remota antes de pedir acceso', async () => {
  const f = hardeningFixture();let replays=0;
  f.context.awaitCartReady = () => new Promise(() => {});
  f.context.observer({status:'unauthenticated',user:null});
  await f.context.guardForwardClick({preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}},{id:'btn-step1-next',click(){replays++;}});
  assert.equal(replays,1);
});
