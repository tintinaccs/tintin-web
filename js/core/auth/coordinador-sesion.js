// Fuente común del estado de sesión para las superficies críticas.
// Firebase sólo tiene una suscripción aquí; los consumidores reciben el mismo
// estado restaurado y no interpretan el null inicial como logout.
import { auth } from '../firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const listeners = new Set();
let currentUser = undefined;
let started = false;
let readyResolve;
let readyResolved = false;
let sessionSnapshot = Object.freeze({ status: 'loading', user: null, error: null });

export const sessionReady = new Promise(resolve => { readyResolve = resolve; });

function publish(snapshot) {
  sessionSnapshot = Object.freeze(snapshot);
  currentUser = snapshot.status === 'authenticated' ? snapshot.user : null;

  if (!readyResolved && snapshot.status !== 'loading') {
    readyResolved = true;
    readyResolve(currentUser);
  }

  listeners.forEach(listener => {
    try { listener(currentUser, sessionSnapshot); }
    catch (error) { console.error('[session-coordinator]', error); }
  });
}

function start() {
  if (started) return;
  started = true;

  const authReady = typeof auth.authStateReady === 'function'
    ? auth.authStateReady()
    : Promise.resolve();

  authReady
    .catch(error => {
      console.warn('[session-coordinator] Firebase no confirmó authStateReady:', error);
    })
    .then(() => onAuthStateChanged(
      auth,
      user => publish(user
        ? { status: 'authenticated', user, error: null }
        : { status: 'guest', user: null, error: null }),
      error => publish({ status: 'error', user: null, error }),
    ));
}

/**
 * Suscripción canónica. El segundo argumento expone un snapshot explícito:
 * loading | guest | authenticated | error.
 */
export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  start();
  listeners.add(listener);
  if (sessionSnapshot.status !== 'loading') {
    queueMicrotask(() => listener(currentUser, sessionSnapshot));
  }
  return () => listeners.delete(listener);
}

/** Espera a que Firebase resuelva la identidad inicial. */
export async function waitForSession() {
  start();
  await sessionReady;
  return sessionSnapshot;
}

/** Estado canónico sin volver a consultar Firebase desde el consumidor. */
export function getSessionSnapshot() {
  start();
  return sessionSnapshot;
}

/**
 * Compatibilidad con consumidores históricos. Durante loading devuelve null;
 * los flujos que necesiten distinguir loading de guest deben usar snapshot.
 */
export function getSessionUser() {
  start();
  return sessionSnapshot.status === 'authenticated' ? sessionSnapshot.user : null;
}

// Arrancar al importar evita que alguien espere sessionReady sin haber creado
// primero una suscripción, lo que antes podía dejar una promesa pendiente.
start();
