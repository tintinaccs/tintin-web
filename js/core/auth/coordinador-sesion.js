// Autoridad única del estado de sesión para toda la tienda y el panel.
// RESTORING/UNKNOWN nunca se interpretan como una sesión ausente.
import { auth } from '../firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { AUTH_STATES, createSessionStateMachine } from './estado-sesion.mjs?v=tintin-20260918-global-session-restore-2';

export { AUTH_STATES };
export const SESSION_HANDOFF_KEY = 'tt_auth_handoff_v2';
const LEGACY_HANDOFF_KEY = 'tt_auth_handoff_uid';
const HANDOFF_TTL_MS = 30_000;

const listeners = new Set();
const sessionListeners = new Set();
const machine = createSessionStateMachine();
let currentSnapshot = machine.getSnapshot();
let started = false;
let readySettled = false;
let readyResolve;
export const sessionReady = new Promise(resolve => { readyResolve = resolve; });

function sameSnapshot(left, right) {
  return left?.status === right?.status
    && (left?.user?.uid || null) === (right?.user?.uid || null)
    && left?.reason === right?.reason;
}

function publish(snapshot) {
  const previous = currentSnapshot;
  currentSnapshot = snapshot;
  if (!readySettled && snapshot.status !== AUTH_STATES.RESTORING) {
    readySettled = true;
    readyResolve(snapshot);
  }
  if (sameSnapshot(previous, snapshot)) return;
  sessionListeners.forEach(listener => {
    try { listener(snapshot); } catch (error) { console.error('[session-coordinator]', error); }
  });
  const known = snapshot.status === AUTH_STATES.AUTHENTICATED || snapshot.status === AUTH_STATES.UNAUTHENTICATED;
  if (!known) return;
  const previousKnown = previous.status === AUTH_STATES.AUTHENTICATED || previous.status === AUTH_STATES.UNAUTHENTICATED;
  const identityChanged = (previous.user?.uid || null) !== (snapshot.user?.uid || null);
  if (!previousKnown || identityChanged || previous.status !== snapshot.status) {
    listeners.forEach(listener => {
      try { listener(snapshot.user); } catch (error) { console.error('[session-coordinator]', error); }
    });
  }
}

function start() {
  if (started) return;
  started = true;
  let initialObserverSeen = false;
  let initialObserverUser = null;
  let initialSettled = false;

  // Firebase puede emitir null antes de terminar IndexedDB. Se observa desde
  // el principio, pero se publica sólo cuando authStateReady resolvió.
  onAuthStateChanged(auth, user => {
    if (!initialSettled) {
      initialObserverSeen = true;
      initialObserverUser = user || null;
      return;
    }
    publish(machine.authChanged(user || null));
  });

  const authReady = typeof auth.authStateReady === 'function'
    ? auth.authStateReady()
    : Promise.resolve();
  authReady.then(() => {
    initialSettled = true;
    if (initialObserverSeen) {
      publish(machine.restorationResolved(initialObserverUser));
    } else if (auth.currentUser) {
      publish(machine.restorationResolved(auth.currentUser, 'auth-current-user'));
    } else {
      // Sin una confirmación positiva de Firebase, el resultado es UNKNOWN,
      // nunca UNAUTHENTICATED. Así no hay redirects/clear-cart prematuros.
      publish(machine.restorationResolved(null));
    }
  }).catch(error => {
    initialSettled = true;
    if (initialObserverSeen && initialObserverUser) {
      publish(machine.restorationResolved(initialObserverUser, 'auth-observer-after-error'));
    } else {
      publish(machine.authError(error));
    }
  });
}

export function subscribeSession(listener) {
  if (typeof listener !== 'function') return () => {};
  start();
  sessionListeners.add(listener);
  queueMicrotask(() => listener(currentSnapshot));
  return () => sessionListeners.delete(listener);
}

// Compatibilidad con consumidores existentes: sólo expone estados conocidos.
// Los estados RESTORING/UNKNOWN se reciben exclusivamente mediante subscribeSession.
export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  start();
  listeners.add(listener);
  if (currentSnapshot.status === AUTH_STATES.AUTHENTICATED || currentSnapshot.status === AUTH_STATES.UNAUTHENTICATED) {
    queueMicrotask(() => listener(currentSnapshot.user));
  }
  return () => listeners.delete(listener);
}

export function getSessionSnapshot() { return currentSnapshot; }
export function getSessionStatus() { return currentSnapshot.status; }
export function getSessionUser() {
  return currentSnapshot.status === AUTH_STATES.AUTHENTICATED ? currentSnapshot.user : null;
}
export function waitForSession() { start(); return sessionReady; }
export function markExplicitLogout() { machine.markExplicitLogout(); }

export function createAuthHandoff(uid) {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return false;
  const value = JSON.stringify({ uid: cleanUid, createdAt: Date.now() });
  try {
    sessionStorage.setItem(SESSION_HANDOFF_KEY, value);
    // Compatibilidad con una pestaña vieja durante el despliegue escalonado.
    sessionStorage.setItem(LEGACY_HANDOFF_KEY, cleanUid);
    return true;
  } catch { return false; }
}

export function readAuthHandoff() {
  try {
    const raw = sessionStorage.getItem(SESSION_HANDOFF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.uid && Number.isFinite(parsed.createdAt) && Date.now() - parsed.createdAt <= HANDOFF_TTL_MS) {
        return { uid: String(parsed.uid), createdAt: parsed.createdAt };
      }
      sessionStorage.removeItem(SESSION_HANDOFF_KEY);
    }
    const legacyUid = sessionStorage.getItem(LEGACY_HANDOFF_KEY);
    return legacyUid ? { uid: String(legacyUid), createdAt: null, legacy: true } : null;
  } catch { return null; }
}

export function clearAuthHandoff() {
  try {
    sessionStorage.removeItem(SESSION_HANDOFF_KEY);
    sessionStorage.removeItem(LEGACY_HANDOFF_KEY);
  } catch {}
}
