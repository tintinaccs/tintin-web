// TINTIN — App Check gate for protected Admin surfaces.
// This module does not initialize Firebase. It only consumes the canonical
// runtime from js/core/firebase/firebase.js and waits for a real App Check
// token before private Firestore listeners are mounted.
import {
  appCheck,
  appCheckReady
} from '../../core/firebase/firebase.js?v=tintin-20260924-auth-persistence-init-1';
import { getToken as getAppCheckToken } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';

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
  if (window.TintinAppCheckStatus === 'enabled') return true;

  // Todos los módulos del Admin comparten una sola verificación/reintento.
  // Evita que 6-10 listeners privados disparen getToken al mismo tiempo.
  const existing = window[ADMIN_APP_CHECK_GATE_KEY];
  if (existing) return existing;

  const gate = resolveAdminAppCheck(timeoutMs);
  window[ADMIN_APP_CHECK_GATE_KEY] = gate;
  try {
    return await gate;
  } finally {
    // Un resultado negativo se puede reintentar más tarde sin recargar Auth.
    if (window.TintinAppCheckStatus !== 'enabled') {
      window[ADMIN_APP_CHECK_GATE_KEY] = null;
    }
  }
}
