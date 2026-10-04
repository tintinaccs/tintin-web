import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { requestCurrentLocation } from '../../js/components/location/geolocalizacion.mjs';

const login = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const googleHandler = login.slice(login.indexOf('let _googleLoginToken'), login.indexOf('// ======== TOGGLE'));
const otpHandler = login.slice(login.indexOf("document.getElementById('btn-verify-otp').onclick ="), login.indexOf('</script>', login.indexOf("document.getElementById('btn-verify-otp').onclick =")));
const subscriber = login.slice(login.indexOf('subscribeSession(async snapshot =>'), login.indexOf('// GOOGLE — primera opción'));
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

function fixture() {
  const popup = deferred();
  const calls = { popup: 0, redirect: 0, finish: 0, hide: 0, reveal: 0, errors: [], texts: [], timers: [], otp: 0 };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: 'Continuar con Google', value: '123456' });
    return elements.get(id);
  };
  const context = vm.createContext({
    explicitLoginInProgress: false, loginPersistenceReady: true,
    googleRedirectWasExpected: false, authPersistenceReady: Promise.resolve(), auth: {}, provider: {}, otpEmail: 'fixture@example.invalid',
    document: { getElementById: element, body: { classList: { add() {}, remove() {} } } },
    window: { setTimeout(fn, ms) { calls.timers.push({fn,ms}); }, dispatchEvent() {} },
    CustomEvent: class { constructor(type) { this.type = type; } },
    hideMessages() {}, showOverlay() {},
    hideLoginOverlay() { calls.hide++; }, revealLoginSurface() { calls.reveal++; },
    setOverlayText(value) { calls.texts.push(value); },
    showError(value) { calls.errors.push(value); }, errMsg: code => code, otpErrorMessage: code => code,
    googleIdleLabel: () => 'Continuar con Google',
    signInWithPopup() { calls.popup++; return popup.promise; },
    signInWithRedirect: async () => { calls.redirect++; },
    markGoogleRedirectPending() {}, clearGoogleRedirectPending() {},
    finishGoogleLogin: async () => { calls.finish++; }, finishOtpLogin: async () => { calls.finish++; },
    verifyOtpCode: async () => { calls.otp++; return { uid: 'fixture' }; },
    AUTH_STATES: { RESTORING: 'restoring', UNKNOWN: 'unknown' },
    subscribeSession(handler) { context.observer = handler; },
  });
  vm.runInContext(googleHandler + otpHandler + subscriber, context);
  return { context, calls, popup, element, google: () => element('btn-google').onclick(), otp: () => element('btn-verify-otp').onclick() };
}

test('un popup lento conserva un solo ingreso aunque pasen 7 segundos', async () => {
  const f = fixture();
  const attempt = f.google();
  for (const timer of f.calls.timers) if (timer.ms <= 7000) timer.fn();
  await Promise.resolve();
  assert.equal(f.calls.redirect, 0);
  assert.equal(f.calls.popup, 1);
  assert.equal(f.calls.hide, 0);
  f.popup.resolve({ user: { uid: 'fixture' } });
  await attempt;
  assert.equal(f.calls.finish, 1);
  assert.equal(f.element('btn-google-label').textContent, 'Continuar con Google');
  assert.deepEqual(f.calls.texts, []);
});

test('doble clic y correo concurrente no abren ni verifican otro ingreso', async () => {
  const f = fixture();
  const attempt = f.google();
  await f.google();
  await f.otp();
  assert.equal(f.calls.popup, 1);
  assert.equal(f.calls.otp, 0);
  f.popup.resolve({ user: { uid: 'fixture' } });
  await attempt;
});

test('sólo el bloqueo real del popup activa una alternativa de redirect', async () => {
  const f = fixture();
  const attempt = f.google();
  f.popup.reject({ code: 'auth/popup-blocked' });
  await attempt;
  assert.equal(f.calls.redirect, 1);
  assert.equal(f.calls.hide, 0);
  assert.equal(f.calls.finish, 0);
});

for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/network-request-failed', 'auth/unauthorized-domain']) {
  test(`${code} devuelve control sin abrir Google en otra superficie`, async () => {
    const f = fixture();
    const attempt = f.google();
    f.popup.reject({ code });
    await attempt;
    assert.equal(f.calls.redirect, 0);
    assert.equal(f.calls.hide, 1);
    assert.equal(f.element('btn-google').disabled, false);
    assert.equal(f.context.explicitLoginInProgress, false);
  });
}

test('eventos null/UNKNOWN de sesión no revelan login durante popup o verificación OTP', async () => {
  const f = fixture();
  const attempt = f.google();
  await f.context.observer({ status: 'unauthenticated', user: null });
  await f.context.observer({ status: 'unknown', user: null });
  assert.equal(f.calls.hide, 0);
  assert.equal(f.calls.reveal, 0);
  f.popup.resolve({ user: { uid: 'fixture' } });
  await attempt;
});

test('OTP válido finaliza una sola vez con loader, sin textos intermedios', async () => {
  const f = fixture();
  const attempt = f.otp();
  await f.otp();
  await attempt;
  assert.equal(f.calls.otp, 1);
  assert.equal(f.calls.finish, 1);
  assert.equal(f.calls.hide, 0);
  assert.deepEqual(f.calls.texts, []);
});

test('el límite de arranque no apaga el loader mientras login espera una interacción', () => {
  const loader = fs.readFileSync(new URL('../../js/cargador-pagina.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = loader.indexOf('window.setTimeout(() => {\n    logoReady = true;');
  const code = loader.slice(start, loader.indexOf('}, SAFETY_MS);', start) + '}, SAFETY_MS);'.length);
  for (const [isLoginPage, pendingWaits, expectedHides] of [[true, 1, 0], [true, 0, 1], [false, 1, 1]]) {
    let hidden = 0;
    vm.runInNewContext(code, { isLoginPage, pendingWaits, logoReady: false, SAFETY_MS: 11000, window: {setTimeout: fn => fn()}, ready() {}, storeGateRequired: false, gateResolved: true, gateEmergencyShown: false, hideNow() { hidden++; }, isAdminImagesPage: false, bootPublicRuntime() {}, bootPageRuntime() {} });
    assert.equal(hidden, expectedHides);
  }
});

test('ubicación de Últimos datos tiene un solo dueño: un clic solicita geolocalización una vez', async () => {
  assert.match(login, /locateButton: document\.getElementById\('login-profile-locate'\)/);
  assert.doesNotMatch(login, /getElementById\('login-profile-locate'\)\.onclick/);
  const source = fs.readFileSync(new URL('../../js/components/location/mapa-ubicacion.js', import.meta.url), 'utf8')
    .replace(/^import[^\n]*\n/gm, '').replace(/export (async )?function/g, '$1function');
  let locationCalls = 0;
  let handler;
  const button = { setAttribute() {}, addEventListener(type, fn) { if (type === 'click') handler = fn; }, removeEventListener() {} };
  const map = { setView() { return this; }, on() {}, invalidateSize() {}, remove() {} };
  const fakeElement = () => ({ setAttribute() {}, remove() {}, append() {}, hidden: false });
  const navigator = { geolocation: { getCurrentPosition() { locationCalls++; } } };
  const context = vm.createContext({
    requestCurrentLocation: () => requestCurrentLocation({ navigator, secure: true }),
    window: { isSecureContext: true, L: { map: () => map, tileLayer: () => ({addTo() {}}) } },
    document: { createElement: fakeElement, getElementById: () => null, removeEventListener() {} },
    navigator,
    setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
  });
  vm.runInContext(source + '; globalThis.mountMap = createLocationMap;', context);
  const mounted = await context.mountMap({ mapEl: { id: 'login-profile-map', classList: { add() {} }, before() {}, after() {} }, locateButton: button });
  handler({ preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(locationCalls, 1);
  // Mientras el dispositivo resuelve, otro clic tampoco duplica la solicitud.
  handler({ preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(locationCalls, 1);
  mounted.destroy();
});
