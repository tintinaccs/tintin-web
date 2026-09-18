export const AUTH_STATES = Object.freeze({
  RESTORING: 'RESTORING',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNKNOWN: 'UNKNOWN',
});

function makeSnapshot(status, user = null, reason = 'initial', error = null, source = 'coordinator') {
  return Object.freeze({
    status,
    user: user || null,
    reason,
    error: error || null,
    source,
    ready: status !== AUTH_STATES.RESTORING,
  });
}

export function createSessionStateMachine() {
  let snapshot = makeSnapshot(AUTH_STATES.RESTORING);
  let explicitLogoutRequested = false;

  const next = (status, user, reason, error, source) => {
    snapshot = makeSnapshot(status, user, reason, error, source);
    return snapshot;
  };

  return {
    getSnapshot: () => snapshot,
    markExplicitLogout: () => { explicitLogoutRequested = true; },
    restorationResolved(user, source = 'auth-restore') {
      return user
        ? next(AUTH_STATES.AUTHENTICATED, user, 'RESTORED', null, source)
        : next(AUTH_STATES.UNKNOWN, null, 'RESTORE_EMPTY', null, source);
    },
    authChanged(user, source = 'auth-observer') {
      if (user) {
        explicitLogoutRequested = false;
        return next(AUTH_STATES.AUTHENTICATED, user, 'AUTH_CHANGED', null, source);
      }
      const reason = explicitLogoutRequested ? 'EXPLICIT_LOGOUT' : 'AUTH_REVOKED_OR_SIGNED_OUT';
      explicitLogoutRequested = false;
      return next(AUTH_STATES.UNAUTHENTICATED, null, reason, null, source);
    },
    authError(error, source = 'auth-restore-error') {
      return next(AUTH_STATES.UNKNOWN, null, 'AUTH_RESTORE_ERROR', error, source);
    },
  };
}
