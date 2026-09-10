// Fuente común del estado de sesión para las superficies críticas.
// Firebase sólo tiene una suscripción aquí; los consumidores reciben el mismo
// estado restaurado y no interpretan el null inicial como logout.
import { auth } from '../firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const listeners = new Set();
let currentUser = undefined;
let started = false;
let readyResolve;
export const sessionReady = new Promise(resolve => { readyResolve = resolve; });

function start() {
  if (started) return;
  started = true;
  const authReady = typeof auth.authStateReady === 'function' ? auth.authStateReady().catch(() => {}) : Promise.resolve();
  authReady.then(() => onAuthStateChanged(auth, user => {
    currentUser = user || null;
    readyResolve(currentUser);
    listeners.forEach(listener => {
      try { listener(currentUser); } catch (error) { console.error('[session-coordinator]', error); }
    });
  }));
}

export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  start();
  listeners.add(listener);
  if (currentUser !== undefined) queueMicrotask(() => listener(currentUser));
  return () => listeners.delete(listener);
}

export function getSessionUser() { return currentUser === undefined ? auth.currentUser : currentUser; }
