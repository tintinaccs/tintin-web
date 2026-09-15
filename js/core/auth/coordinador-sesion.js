// Fuente común del estado de sesión para las superficies críticas.
// Firebase sólo tiene una suscripción aquí; los consumidores reciben el mismo
// estado restaurado y no interpretan el null inicial como logout.
import { auth } from '../firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const listeners = new Set();
let currentUser = undefined;
let started = false;
let readySettled = false;
let readyResolve;
export const sessionReady = new Promise(resolve => { readyResolve = resolve; });

function sameIdentity(left, right) {
  return (left?.uid || null) === (right?.uid || null);
}

function publish(user, { force = false } = {}) {
  const nextUser = user || null;
  const changed = currentUser === undefined || !sameIdentity(currentUser, nextUser);
  currentUser = nextUser;
  if (!readySettled) {
    readySettled = true;
    readyResolve(currentUser);
  }
  if (!changed && !force) return;
  listeners.forEach(listener => {
    try { listener(currentUser); } catch (error) { console.error('[session-coordinator]', error); }
  });
}

function start() {
  if (started) return;
  started = true;

  const authReady = typeof auth.authStateReady === 'function'
    ? auth.authStateReady().catch(error => {
        console.warn('[session-coordinator] authStateReady no resolvió normalmente:', error?.code || error);
      })
    : Promise.resolve();

  authReady.then(() => {
    // authStateReady garantiza que Firebase terminó de restaurar IndexedDB.
    // Publicamos ese valor inmediatamente, sin esperar un segundo ciclo de
    // onAuthStateChanged; esto elimina el intervalo en el que checkout/cuenta
    // podían parecer deslogueados al cambiar de página.
    publish(auth.currentUser || null, { force: true });
    onAuthStateChanged(auth, user => publish(user || null));
  });
}

export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  start();
  listeners.add(listener);
  if (currentUser !== undefined) queueMicrotask(() => listener(currentUser));
  return () => listeners.delete(listener);
}

export function getSessionUser() { return currentUser === undefined ? auth.currentUser : currentUser; }
