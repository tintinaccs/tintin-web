// TINTIN — App Check gate for protected Admin surfaces.
// This module does not initialize Firebase. It only consumes the canonical
// runtime from js/core/firebase/firebase.js and waits for a real App Check
// token before private Firestore listeners are mounted.
import {
  auth,
  authPersistenceReady,
  appCheck,
  appCheckReady,
  db
} from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { getToken as getAppCheckToken } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
import { doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

function waitForReadyEvent(timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      window.removeEventListener('tintin:app-check-ready', onReady);
      window.clearTimeout(timer);
      resolve(Boolean(value));
    };
    const onReady = event => done(event?.detail?.ready === true);
    const timer = window.setTimeout(() => done(false), Math.max(0, Number(timeoutMs) || 0));
    window.addEventListener('tintin:app-check-ready', onReady, { once: true });
    // Cierra la carrera en la que el evento llegó justo antes de registrar
    // este listener pero después del chequeo previo.
    if (window.TintinAppCheckStatus === 'enabled') done(true);
  });
}

const ADMIN_APP_CHECK_GATE_KEY = '__TINTIN_ADMIN_APP_CHECK_GATE__';
const ADMIN_AUTH_GATE_KEY = '__TINTIN_ADMIN_AUTH_GATE__';
const ADMIN_FIRESTORE_READY_GATE_KEY = '__TINTIN_ADMIN_FIRESTORE_READY_GATE__';
const FIRESTORE_READY_RETRY_MS = Object.freeze([0, 80, 220]);

// App Check listo no confirma Auth. Los módulos auxiliares deben esperar la
// restauración y una credencial fresca antes del primer listener privado.
// Todos comparten la misma renovación; sólo se conserva un booleano, no tokens.
async function waitForAdminAuth(timeoutMs) {
  const existing = window[ADMIN_AUTH_GATE_KEY];
  if (existing && (!existing.uid || existing.uid === auth.currentUser?.uid)) return existing.promise;
  const gate = { uid: '', promise: null };
  let timer;
  const attempt = (async () => {
    await authPersistenceReady;
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return false;
    gate.uid = user.uid;
    await user.getIdToken(true);
    return auth.currentUser?.uid === user.uid;
  })().catch(() => false);
  gate.promise = Promise.race([
    attempt,
    new Promise(resolve => { timer = window.setTimeout(() => resolve(false), Math.max(1500, Number(timeoutMs) || 12000)); })
  ]).then(ok => {
    window.clearTimeout(timer);
    if (!ok && window[ADMIN_AUTH_GATE_KEY] === gate) window[ADMIN_AUTH_GATE_KEY] = null;
    return Boolean(ok);
  });
  window[ADMIN_AUTH_GATE_KEY] = gate;
  return gate.promise;
}

async function waitForAdminFirestoreReady(timeoutMs) {
  const user = auth.currentUser;
  if (!user) return false;
  const existing = window[ADMIN_FIRESTORE_READY_GATE_KEY];
  if (existing && existing.uid === user.uid) return existing.promise;

  const gate = { uid: user.uid, promise: null };
  let timeoutId = 0;
  const attempt = (async () => {
    for (let index = 0; index < FIRESTORE_READY_RETRY_MS.length; index += 1) {
      if (auth.currentUser?.uid !== user.uid) return false;
      const delay = FIRESTORE_READY_RETRY_MS[index];
      if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
      try {
        // Una lectura forzada al servidor confirma que Firestore ya absorbió
        // la identidad renovada y el token de App Check. getIdToken(true)
        // puede resolver antes de que el proveedor de credenciales de
        // Firestore procese el cambio, que era la ventana que abría decenas
        // de listeners con permission-denied durante una recarga fría.
        await getDocFromServer(doc(db, 'users', user.uid));
        return auth.currentUser?.uid === user.uid;
      } catch (error) {
        const code = String(error?.code || error?.name || '').replace(/^firestore\//, '').toLowerCase();
        const retryable = code === 'permission-denied' || code === 'unauthenticated' ||
          code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed';
        if (!retryable || index === FIRESTORE_READY_RETRY_MS.length - 1) return false;
      }
    }
    return false;
  })();

  gate.promise = Promise.race([
    attempt,
    new Promise(resolve => {
      timeoutId = window.setTimeout(() => resolve(false), Math.max(1500, Number(timeoutMs) || 12000));
    }),
  ]).then(ok => {
    window.clearTimeout(timeoutId);
    if (!ok && window[ADMIN_FIRESTORE_READY_GATE_KEY] === gate) {
      window[ADMIN_FIRESTORE_READY_GATE_KEY] = null;
    }
    return Boolean(ok);
  });
  window[ADMIN_FIRESTORE_READY_GATE_KEY] = gate;
  return gate.promise;
}

async function resolveAdminAppCheck(timeoutMs) {
  const initial = await Promise.resolve(appCheckReady).catch(() => false);
  if (initial || window.TintinAppCheckStatus === 'enabled') return true;

  // appCheckReady tiene un timeout blando para no congelar superficies
  // públicas. En Admin no debemos confundir ese timeout con "token válido":
  // primero damos margen a que llegue el evento real del SDK.
  const eventReady = await waitForReadyEvent(timeoutMs);
  if (eventReady || window.TintinAppCheckStatus === 'enabled') return true;

  // Si la inicialización sí produjo una instancia, hacemos un último intento
  // explícito. Una caída de red/reCAPTCHA devuelve false y el panel conserva
  // Auth sin abrir listeners privados ni generar una tormenta permission-denied.
  if (!appCheck) return false;
  try {
    const retry = Promise.resolve(getAppCheckToken(appCheck, false))
      .then(() => true)
      .catch(() => false);
    const retryTimeout = new Promise(resolve => {
      window.setTimeout(() => resolve(false), Math.max(1500, Math.min(6000, Number(timeoutMs) || 0)));
    });
    const ok = await Promise.race([retry, retryTimeout]);
    if (ok) window.TintinAppCheckStatus = 'enabled';
    return Boolean(ok);
  } catch {
    return false;
  }
}

export async function waitForAdminAppCheck(timeoutMs = 12000) {
  if (!await waitForAdminAuth(timeoutMs)) return false;

  let appCheckOk = window.TintinAppCheckStatus === 'enabled';
  if (!appCheckOk) {
    // Todos los módulos del Admin comparten una sola verificación/reintento.
    // Evita que 6-10 listeners privados disparen getToken al mismo tiempo.
    const existing = window[ADMIN_APP_CHECK_GATE_KEY];
    if (existing) {
      appCheckOk = await existing;
    } else {
      const gate = resolveAdminAppCheck(timeoutMs);
      window[ADMIN_APP_CHECK_GATE_KEY] = gate;
      try {
        appCheckOk = await gate;
      } finally {
        // Un resultado negativo se puede reintentar más tarde sin recargar Auth.
        if (window.TintinAppCheckStatus !== 'enabled') {
          window[ADMIN_APP_CHECK_GATE_KEY] = null;
        }
      }
    }
  }
  if (!appCheckOk || auth.currentUser == null) return false;

  // App Check + Auth listos no bastan: antes de liberar listeners privados,
  // confirma una lectura server-side con el mismo SDK de Firestore.
  return waitForAdminFirestoreReady(timeoutMs);
}
