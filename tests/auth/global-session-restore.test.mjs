import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUTH_STATES, createSessionStateMachine } from '../../js/core/auth/estado-sesion.mjs';

const authNavigationSource = fs.readFileSync(
  new URL('../../js/core/auth/navegacion-autenticacion.js', import.meta.url),
  'utf8'
);
const sessionCoordinatorSource = fs.readFileSync(
  new URL('../../js/core/auth/coordinador-sesion.js', import.meta.url),
  'utf8'
);
const firebaseSource = fs.readFileSync(
  new URL('../../js/core/firebase/firebase.js', import.meta.url),
  'utf8'
);

test('null transitorio durante cold restore nunca se publica como logout', () => {
  const machine = createSessionStateMachine();
  assert.equal(machine.getSnapshot().status, AUTH_STATES.RESTORING);
  assert.equal(machine.authChanged(null).status, AUTH_STATES.RESTORING);
  assert.equal(machine.getSnapshot().status, AUTH_STATES.RESTORING);
});

test('authStateReady vacío resuelve ausencia autoritativa sin UNKNOWN permanente', () => {
  const machine = createSessionStateMachine();
  const resolved = machine.restorationResolved(null, 'auth-state-ready-empty');
  assert.equal(resolved.status, AUTH_STATES.UNAUTHENTICATED);
  assert.equal(resolved.reason, 'AUTHORITATIVE_EMPTY');
  assert.equal(machine.getSnapshot().status, AUTH_STATES.UNAUTHENTICATED);
});

test('la restauración nunca convierte un observer obsoleto en sesión válida', () => {
  assert.match(sessionCoordinatorSource, /const restoredUser = auth\.currentUser \|\| null;/);
  assert.match(sessionCoordinatorSource, /const recoveredUser = auth\.currentUser \|\| null;/);
  assert.doesNotMatch(sessionCoordinatorSource, /initialObserver(User|Seen)/);
  assert.doesNotMatch(sessionCoordinatorSource, /auth-observer-after-error/);
});

test('Firebase Auth initializes the browser persistence hierarchy before restoration without migrating an active session', () => {
  assert.match(firebaseSource, /persistence:\s*\[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence\]/);
  assert.match(firebaseSource, /persistenceWasConfiguredAtInitialization/);
  assert.doesNotMatch(firebaseSource, /\bsetPersistence\s*\(/);
});

test('un error de restauración cae a visitante y no bloquea la aplicación', () => {
  const machine = createSessionStateMachine();
  const failed = machine.authError(new Error('restore failed'));
  assert.equal(failed.status, AUTH_STATES.UNAUTHENTICATED);
  assert.equal(failed.reason, 'AUTH_RESTORE_FALLBACK');
  assert.equal(machine.getSnapshot().status, AUTH_STATES.UNAUTHENTICATED);
});

test('ruta protegida espera durante restoring y sólo redirige ante ausencia autoritativa', () => {
  const machine = createSessionStateMachine();
  const decideProtectedRoute = snapshot => {
    if (snapshot.status === AUTH_STATES.RESTORING) return 'wait';
    if (snapshot.status === AUTH_STATES.UNAUTHENTICATED) return 'login';
    if (snapshot.status === AUTH_STATES.UNKNOWN) return 'retry';
    return 'allow';
  };

  assert.equal(decideProtectedRoute(machine.getSnapshot()), 'wait');
  assert.equal(decideProtectedRoute(machine.restorationResolved(null)), 'login');
  assert.equal(decideProtectedRoute(machine.restorationResolved({ uid: 'user-1' })), 'allow');
});

test('cold restore con usuario autenticado publica identidad y luego logout real', () => {
  const machine = createSessionStateMachine();
  const user = { uid: 'user-1', email: 'client@example.com' };
  assert.equal(machine.restorationResolved(user).status, AUTH_STATES.AUTHENTICATED);
  const loggedOut = machine.authChanged(null);
  assert.equal(loggedOut.status, AUTH_STATES.UNAUTHENTICATED);
  assert.equal(loggedOut.reason, 'AUTH_REVOKED_OR_SIGNED_OUT');
});

test('logout explícito y cambio de cuenta conservan metadata sin usar timers', () => {
  const machine = createSessionStateMachine();
  machine.restorationResolved({ uid: 'user-1' });
  machine.markExplicitLogout();
  assert.equal(machine.authChanged(null).reason, 'EXPLICIT_LOGOUT');
  assert.equal(machine.authChanged({ uid: 'user-2' }).user.uid, 'user-2');
});

test('revocación posterior a una sesión restaurada es una ausencia no explícita', () => {
  const machine = createSessionStateMachine();
  machine.restorationResolved({ uid: 'user-1' });
  const revoked = machine.authChanged(null);
  assert.equal(revoked.status, AUTH_STATES.UNAUTHENTICATED);
  assert.equal(revoked.reason, 'AUTH_REVOKED_OR_SIGNED_OUT');
});

test('la navegación conserva la identidad visual sin usar el handoff como autorización', () => {
  assert.match(sessionCoordinatorSource, /photoURL/);
  assert.match(sessionCoordinatorSource, /displayName/);
  assert.match(authNavigationSource, /captureNavigationHandoff/);
  assert.match(authNavigationSource, /PROFILE_READ_TIMEOUT_MS = 5000/);
  assert.match(authNavigationSource, /provisional:Boolean\(user\)/);
});
