// Autoridad única del estado de sesión para toda la tienda y el panel.
// RESTORING/UNKNOWN nunca se interpretan como una sesión ausente.
import {
  auth,
  authPersistenceReady,
  getAuthPersistenceBackend,
  inspectAuthPersistenceStorage
} from '../firebase/firebase.js?v=tintin-20260920-auth-persistence-all-users-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { AUTH_STATES, createSessionStateMachine } from './estado-sesion.mjs?v=tintin-20260920-auth-persistence-all-users-1';
import { recordAuthDiagnostic } from './diagnostico-sesion.js?v=tintin-20260918-auth-diagnostics-1';

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
      // Conservar el último valor observado evita convertir un null histórico
      // en la decisión final si Firebase publicó luego una identidad antes de
      // que authStateReady() terminara.
      initialObserverUser = user || null;
      return;
    }
    publish(machine.authChanged(user || null));
  });

  // En login.html Firebase elige explícitamente la persistencia local. Esa
  // configuración y authStateReady() son dos promesas independientes; si se
  // las inicia al mismo tiempo, authStateReady() puede resolver con null antes
  // de que la configuración termine de adoptar el backend local. En una
  // navegación inmediata a admin.html esa falsa ausencia se convierte en un
  // redirect al login. La persistencia debe quedar lista antes de tomar la
  // frontera autoritativa de restauración; no se usa un timeout ni un retry
  // como autoridad.
  const authReady = Promise.resolve(authPersistenceReady)
    .then(() => typeof auth.authStateReady === 'function'
      ? auth.authStateReady()
      : undefined);
  authReady.then(() => {
    initialSettled = true;
    // authStateReady() es la frontera autoritativa de la restauración inicial.
    // Al resolver, currentUser tiene prioridad sobre cualquier null temprano
    // que haya emitido el observer durante la lectura de IndexedDB.
    const restoredUser = auth.currentUser || (initialObserverSeen ? initialObserverUser : null);
    const source = auth.currentUser ? 'auth-current-user' : 'auth-state-ready-empty';
    recordAuthDiagnostic('PERSISTENCE_BACKEND', {
      source: 'session-coordinator',
      persistenceBackend: getAuthPersistenceBackend()
    });
    void inspectAuthPersistenceStorage().then(storage => {
      recordAuthDiagnostic('PERSISTENCE_RECORD_PRESENT', {
        source: 'session-coordinator',
        databaseExists: storage.databaseExists,
        recordPresent: storage.recordPresent,
        storageBackend: storage.storageBackend,
        objectStoreCount: storage.objectStores?.length || 0
      });
    }).catch(() => {
      recordAuthDiagnostic('PERSISTENCE_RECORD_PRESENT', {
        source: 'session-coordinator',
        databaseExists: null,
        recordPresent: null,
        storageBackend: 'unavailable',
        objectStoreCount: 0
      });
    });
    if (restoredUser) {
      recordAuthDiagnostic('RESTORE_AUTHENTICATED', {
        source: 'session-coordinator',
        authState: AUTH_STATES.AUTHENTICATED
      });
      publish(machine.restorationResolved(restoredUser, source));
    } else {
      recordAuthDiagnostic('AUTHORITATIVE_EMPTY', {
        source: 'session-coordinator',
        authState: AUTH_STATES.UNAUTHENTICATED,
        reason: 'AUTH_STATE_READY_EMPTY'
      });
      recordAuthDiagnostic('RESTORE_UNAUTHENTICATED', {
        source: 'session-coordinator',
        authState: AUTH_STATES.UNAUTHENTICATED
      });
      publish(machine.restorationResolved(null, source));
    }
  }).catch(error => {
    initialSettled = true;
    const recoveredUser = auth.currentUser || (initialObserverSeen ? initialObserverUser : null);
    if (recoveredUser) {
      recordAuthDiagnostic('RESTORE_AUTHENTICATED', {
        source: 'session-coordinator',
        authState: AUTH_STATES.AUTHENTICATED,
        reason: 'AUTH_RESTORE_ERROR_WITH_USER'
      });
      publish(machine.restorationResolved(recoveredUser, 'auth-observer-after-error'));
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
