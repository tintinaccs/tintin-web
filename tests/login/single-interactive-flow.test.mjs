import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { requestCurrentLocation } from '../../js/components/location/geolocalizacion.mjs';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

const login = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const googleHandler = login.slice(login.indexOf('let _googleLoginToken'), login.indexOf('// ======== TOGGLE'));
const otpHandler = login.slice(login.indexOf("document.getElementById('btn-verify-otp').onclick ="), login.indexOf('</script>', login.indexOf("document.getElementById('btn-verify-otp').onclick =")));
const subscriber = login.slice(login.indexOf('subscribeSession(async snapshot =>'), login.indexOf('// GOOGLE —'));
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

function fixture({ popupBlocked = true } = {}) {
  const redirect = deferred(), popup = deferred();
  const calls = { popup: 0, redirect: 0, finish: 0, show: 0, hide: 0, reveal: 0, errors: [], texts: [], timers: [], otp: 0 };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: 'Continuar con Google', value: '123456', setAttribute() {}, removeAttribute() {} });
    return elements.get(id);
  };
  const context = vm.createContext({
    explicitLoginInProgress: false, loginPersistenceReady: true,
    loginSessionGeneration: 0, AUTH_NETWORK_DEADLINE_MS: 15000,
    withDeadline: (promise, ms) => withDeadline(promise, ms, {set(fn, delay){const timer={fn,ms:delay};calls.timers.push(timer);return timer;},clear(timer){timer.cleared=true;}}),
    googleRedirectHandledUserUid: null, googleRedirectWasExpected: false, authPersistenceReady: Promise.resolve(), auth: {}, provider: {}, otpEmail: 'fixture@example.invalid',
    document: { getElementById: element, body: { classList: { add() {}, remove() {} } } },
    window: { setTimeout(fn, ms) { calls.timers.push({fn,ms}); }, dispatchEvent() {}, addEventListener(type,fn){calls[type]=fn;} },
    CustomEvent: class { constructor(type) { this.type = type; } },
    hideMessages() {}, showOverlay() { calls.show++; },
    hideLoginOverlay() { calls.hide++; }, revealLoginSurface() { calls.reveal++; },
    setOverlayText(value) { calls.texts.push(value); },
    showError(value) { calls.errors.push(value); }, errMsg: code => code, otpErrorMessage: code => code,
    googleIdleLabel: () => 'Continuar con Google',
    signInWithPopup() { calls.popup++; if (popupBlocked) throw { code: 'auth/popup-blocked' }; return popup.promise; },
    signInWithRedirect: () => { calls.redirect++; return redirect.promise; },
    markGoogleRedirectPending() { calls.marked = true; }, clearGoogleRedirectPending() { calls.marked = false; },
    hasGoogleRedirectPending:()=>calls.marked===true,
    finishGoogleLogin: async () => { calls.finish++; }, finishOtpLogin: async () => { calls.finish++; },
    verifyOtpCode: async () => { calls.otp++; return { uid: 'fixture' }; },
    AUTH_STATES: { RESTORING: 'restoring', UNKNOWN: 'unknown' },
    subscribeSession(handler) { context.observer = handler; },
  });
  vm.runInContext(googleHandler + otpHandler + subscriber, context);
  return { context, calls, redirect, popup, element, google: () => element('btn-google').onclick(), otp: () => element('btn-verify-otp').onclick() };
}

test('Popup bloqueado redirige después de confirmar persistencia', async () => {
  const f=fixture(),persistence=deferred();
  f.context.authPersistenceReady=persistence.promise;
  const attempt=f.google();
  assert.equal(f.calls.redirect,0);assert.equal(f.calls.popup,1);
  assert.equal(f.element('btn-google-label').textContent,'Abriendo Google…');
  persistence.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.redirect,1);assert.equal(f.calls.marked,true);
  assert.equal(f.calls.show,1);assert.equal(f.calls.finish,0);
  f.redirect.resolve();await attempt;
});

test('doble clic y correo concurrente no abren otra operación', async () => {
  const f=fixture();const attempt=f.google();
  await f.google();await f.otp();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.redirect,1);assert.equal(f.calls.popup,1);assert.equal(f.calls.otp,0);
  f.redirect.resolve();await attempt;
});

test('redirect sin respuesta libera el formulario y no inventa un ingreso', async () => {
  const f=fixture();const attempt=f.google();
  await new Promise(resolve=>setImmediate(resolve));
  f.calls.timers.find(timer=>!timer.cleared&&timer.ms===15000).fn();await attempt;
  assert.equal(f.calls.marked,false);assert.equal(f.calls.finish,0);
  assert.equal(f.element('btn-google').disabled,false);
  assert.equal(f.context.explicitLoginInProgress,false);
  assert.match(f.calls.errors[0],/Google está tardando/);
  f.redirect.resolve();await Promise.resolve();assert.equal(f.calls.finish,0);
});

test('Atrás desde caché libera la espera sin borrar la identidad ni duplicar Google',async()=>{
  const f=fixture();const user={uid:'confirmed'};f.context.auth.currentUser=user;
  const attempt=f.google();await new Promise(resolve=>setImmediate(resolve));
  f.calls.pageshow({persisted:true});
  assert.equal(f.element('btn-google').disabled,false);assert.equal(f.calls.marked,false);
  assert.equal(f.context.auth.currentUser,user);assert.equal(f.calls.redirect,1);
  const errors=f.calls.errors.length;
  f.redirect.reject({code:'auth/network-request-failed'});await attempt;
  assert.equal(f.calls.errors.length,errors);assert.equal(f.calls.finish,0);
});

for(const code of ['auth/network-request-failed','auth/unauthorized-domain','auth/operation-not-supported-in-this-environment']) {
  test(`${code} libera controles y limpia el retorno esperado`, async()=>{
    const f=fixture();const attempt=f.google();await new Promise(resolve=>setImmediate(resolve));
    f.redirect.reject({code});await attempt;
    assert.equal(f.calls.popup,1);assert.equal(f.calls.hide,1);assert.equal(f.calls.marked,false);
    assert.equal(f.element('btn-google').disabled,false);assert.deepEqual(f.calls.errors,[code]);
  });
}

test('persistencia fallida no inicia Google ni deja un retorno falso',async()=>{
  const f=fixture(),persistence=deferred();f.context.authPersistenceReady=persistence.promise;
  const attempt=f.google();persistence.reject({code:'auth/persistence-unavailable'});await attempt;
  assert.equal(f.calls.redirect,0);assert.equal(f.calls.marked,false);
  assert.equal(f.element('btn-google').disabled,false);
});

test('eventos intermedios de sesión no interrumpen redirect ni OTP',async()=>{
  const f=fixture();const attempt=f.google();
  await f.context.observer({status:'unauthenticated',user:null});
  await f.context.observer({status:'unknown',user:null});
  assert.equal(f.calls.hide,0);assert.equal(f.calls.reveal,0);
  f.redirect.resolve();await attempt;
});
test('una restauración vieja no redirige después de cerrar o cambiar la sesión', async () => {
  const f=fixture(),reload=deferred();
  const user={uid:'old',email:'fixture@example.invalid',reload:()=>reload.promise};
  Object.assign(f.context,{auth:{currentUser:user},loginPersistenceFailed:false,
    URLSearchParams,
    loginAuthReadyDiagnosticRecorded:false,loginCoordinatorReadyDiagnosticRecorded:false,
    googleRedirectHandlingPromise:null,handleGoogleRedirectReturn:async()=>false,
    recordAuthDiagnostic(){},PROFILE_READ_DEADLINE_MS:15000});
  f.context.window.location={search:''};
  const old=f.context.observer({status:'authenticated',user});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  f.context.auth.currentUser=null;
  await f.context.observer({status:'unauthenticated',user:null});
  reload.resolve();await old;
  assert.equal(f.calls.reveal,1);assert.equal(f.calls.errors.length,0);
});

test('retorno Google y observador Auth finalizan la misma identidad una sola vez',async()=>{
  const f=fixture(),finish=deferred();let reloads=0;
  const user={uid:'redirect-confirmed',email:'fixture@example.invalid',reload:()=>{reloads++;throw new Error('Restauración duplicada');}};
  Object.assign(f.context,{auth:{currentUser:user},loginPersistenceFailed:false,URLSearchParams,
    loginAuthReadyDiagnosticRecorded:false,loginCoordinatorReadyDiagnosticRecorded:false,
    googleRedirectWasExpected:true,googleRedirectHandlingPromise:null,
    googleRedirectResultPromise:Promise.resolve({result:{user},error:null}),
    recordAuthDiagnostic(){},PROFILE_READ_DEADLINE_MS:15000,
    finishGoogleLogin:()=>{f.calls.finish++;return finish.promise;}});
  f.context.window.location={search:''};
  const start=login.indexOf('async function handleGoogleRedirectReturn');
  const end=login.indexOf('// Si ya está logueada',start);
  vm.runInContext(login.slice(start,end),f.context);
  const first=f.context.observer({status:'unauthenticated',user:null});
  await new Promise(resolve=>setImmediate(resolve));
  const second=f.context.observer({status:'authenticated',user});
  finish.resolve();await Promise.all([first,second]);
  assert.equal(f.calls.finish,1);assert.equal(reloads,0);
});

test('volver sin credencial deja el formulario disponible y nunca relanza Google',async()=>{
  const f=fixture();
  Object.assign(f.context,{auth:{currentUser:null},loginPersistenceFailed:false,URLSearchParams,
    loginAuthReadyDiagnosticRecorded:false,loginCoordinatorReadyDiagnosticRecorded:false,
    googleRedirectWasExpected:true,googleRedirectHandlingPromise:null,
    googleRedirectResultPromise:Promise.resolve({result:null,error:null}),recordAuthDiagnostic(){}});
  f.context.window.location={search:''};
  const start=login.indexOf('async function handleGoogleRedirectReturn');
  vm.runInContext(login.slice(start,login.indexOf('// Si ya está logueada',start)),f.context);
  await f.context.observer({status:'unauthenticated',user:null});
  assert.equal(f.calls.finish,0);assert.equal(f.calls.redirect,0);
  assert.equal(f.context.explicitLoginInProgress,false);assert.equal(f.calls.reveal,1);
  assert.match(f.calls.errors[0],/Google no pudo completar/);
});

test('la salida visible del arranque no inventa un estado de Auth ni borra persistencia',()=>{
  const start=login.indexOf('// Sólo libera la interfaz inicial.');
  const end=login.indexOf('}, AUTH_NETWORK_DEADLINE_MS);',start)+'}, AUTH_NETWORK_DEADLINE_MS);'.length;
  let hide=0,reveal=0,error=0;
  const user={uid:'confirmed'};
  const ctx={AUTH_NETWORK_DEADLINE_MS:15000,googleRedirectWasExpected:false,auth:{currentUser:user},
    document:{documentElement:{classList:{contains:()=>true}}},window:{setTimeout:fn=>fn()},
    hideLoginOverlay:()=>hide++,revealLoginSurface:()=>reveal++,showError:()=>error++};
  vm.runInNewContext(login.slice(start,end),ctx);
  assert.equal(hide,1);assert.equal(reveal,1);assert.equal(error,1);
  assert.equal(ctx.auth.currentUser,user);
});

test('verificar correo descarta una restauración anterior todavía pendiente', async () => {
  const f=fixture(),reload=deferred(),verification=deferred();
  const user={uid:'old',email:'fixture@example.invalid',reload:()=>reload.promise};
  Object.assign(f.context,{auth:{currentUser:user},loginPersistenceFailed:false,
    URLSearchParams,
    loginAuthReadyDiagnosticRecorded:false,loginCoordinatorReadyDiagnosticRecorded:false,
    googleRedirectHandlingPromise:null,handleGoogleRedirectReturn:async()=>false,
    recordAuthDiagnostic(){},PROFILE_READ_DEADLINE_MS:15000,
    verifyOtpCode:()=>verification.promise});
  f.context.window.location={search:''};
  const old=f.context.observer({status:'authenticated',user});
  await new Promise(resolve=>setImmediate(resolve));
  const attempt=f.otp();
  reload.resolve();await old;
  assert.equal(f.calls.finish,0);assert.equal(f.calls.hide,0);
  assert.equal(f.calls.reveal,0);assert.equal(f.calls.errors.length,0);
  verification.resolve({uid:'new'});await attempt;
  assert.equal(f.calls.finish,1);
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

test('ubicación del checkout tiene un solo dueño: un clic solicita geolocalización una vez', async () => {
  assert.doesNotMatch(login, /id="login-profile-locate"/);
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
    window: { isSecureContext: true, L: { map: () => map, tileLayer: () => ({addTo() {return this;},on() {return this;}}) } },
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

test('popup conserva activación del clic y finaliza sin redirect ni carreras de sesión',async()=>{
  const f=fixture({popupBlocked:false});const attempt=f.google();
  assert.equal(f.calls.popup,1);assert.equal(f.calls.redirect,0);
  await f.google();await f.otp();
  await f.context.observer({status:'unauthenticated',user:null});
  assert.equal(f.calls.hide,0);assert.equal(f.calls.otp,0);assert.equal(f.calls.popup,1);
  f.popup.resolve({user:{uid:'popup-confirmed'}});await attempt;
  assert.equal(f.calls.finish,1);assert.equal(f.calls.redirect,0);
});
for(const code of ['auth/popup-closed-by-user','auth/network-request-failed']){
  test(`popup ${code} no dispara redirect`,async()=>{
    const f=fixture({popupBlocked:false});const attempt=f.google();
    f.popup.reject({code});await attempt;
    assert.equal(f.calls.redirect,0);assert.equal(f.element('btn-google').disabled,false);
    assert.deepEqual(f.calls.errors,[code]);assert.equal(f.calls.finish,0);
  });
}