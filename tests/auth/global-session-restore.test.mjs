import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_STATES, createSessionStateMachine } from '../../js/core/auth/estado-sesion.mjs';

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

test('un error de restauración conserva UNKNOWN y nunca se interpreta como logout', () => {
  const machine = createSessionStateMachine();
  const failed = machine.authError(new Error('restore failed'));
  assert.equal(failed.status, AUTH_STATES.UNKNOWN);
  assert.equal(failed.reason, 'AUTH_RESTORE_ERROR');
  assert.equal(machine.getSnapshot().status, AUTH_STATES.UNKNOWN);
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
