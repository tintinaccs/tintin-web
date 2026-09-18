import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_STATES, createSessionStateMachine } from '../../js/core/auth/estado-sesion.mjs';

test('null transitorio durante cold restore nunca se publica como logout', () => {
  const machine = createSessionStateMachine();
  assert.equal(machine.getSnapshot().status, AUTH_STATES.RESTORING);
  assert.equal(machine.restorationResolved(null).status, AUTH_STATES.UNKNOWN);
  assert.notEqual(machine.getSnapshot().status, AUTH_STATES.UNAUTHENTICATED);
});

test('ruta protegida permanece RESTORING hasta la resolución autoritativa', () => {
  const machine = createSessionStateMachine();
  const redirects = [];
  const decideProtectedRoute = snapshot => {
    if (snapshot.status === AUTH_STATES.RESTORING || snapshot.status === AUTH_STATES.UNKNOWN) return 'wait';
    if (snapshot.status === AUTH_STATES.UNAUTHENTICATED) {
      redirects.push(snapshot.reason);
      return 'login';
    }
    return 'allow';
  };

  assert.equal(decideProtectedRoute(machine.getSnapshot()), 'wait');
  assert.equal(decideProtectedRoute(machine.restorationResolved(null)), 'wait');
  assert.deepEqual(redirects, []);
  assert.equal(decideProtectedRoute(machine.restorationResolved({ uid: 'user-1' })), 'allow');
  assert.deepEqual(redirects, []);
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
