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
        ? next(AUTH_STATES.AUTHENTICATED, user, 'RESTORE_AUTHENTICATED', null, source)
        : next(AUTH_STATES.UNAUTHENTICATED, null, 'AUTHORITATIVE_EMPTY', null, source);
    },
    authChanged(user, source = 'auth-observer') {
      if (user) {
        explicitLogoutRequested = false;
        return next(AUTH_STATES.AUTHENTICATED, user, 'AUTH_CHANGED', null, source);
      }
      // Firebase puede emitir el primer null mientras IndexedDB todavía está
      // restaurando Auth. El coordinador conserva RESTORING hasta que
      // authStateReady() resuelva; sólo entonces un null puede ser una
      // ausencia autoritativa. Un logout explícito sí tiene autoridad
      // inmediata porque fue solicitado por la persona.
      if (snapshot.status === AUTH_STATES.RESTORING && !explicitLogoutRequested) {
        return snapshot;
      }
      const reason = explicitLogoutRequested ? 'EXPLICIT_LOGOUT' : 'AUTH_REVOKED_OR_SIGNED_OUT';
      explicitLogoutRequested = false;
      return next(AUTH_STATES.UNAUTHENTICATED, null, reason, null, source);
    },
    authError(error, source = 'auth-restore-error') {
      // Un fallo de almacenamiento/restauración no prueba que exista una
      // cuenta. Resolver como visitante permite que el panel redirija al
      // ingreso y que la tienda pública continúe; UNKNOWN no debe bloquear
      // toda la aplicación ni presentarse como una cuenta perdida.
      return next(AUTH_STATES.UNAUTHENTICATED, null, 'AUTH_RESTORE_FALLBACK', error, source);
    },
  };
}
