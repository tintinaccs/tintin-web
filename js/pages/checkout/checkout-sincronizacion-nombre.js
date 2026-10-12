import { auth } from '../../core/firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20261012-auth-privacy-1-coordinador-sesion-js';

(function () {
  'use strict';

  if (window.TintinCheckoutNameAuthSyncBooted) return;
  window.TintinCheckoutNameAuthSyncBooted = true;

  function apply(user) {
    const guard = window.TintinCheckoutNameGuard;
    if (!guard) return;
    guard.applyPreferredName(user?.displayName || '');
  }

  // onAuthStateChanged siempre dispara con el estado actual apenas se
  // suscribe (incluso si ya está resuelto), así que un apply(auth.currentUser)
  // adicional acá era redundante y, peor, podía ejecutarse ANTES de que
  // Firebase restaure una sesión persistida (auth.currentUser sigue null en
  // ese instante), pisando el nombre real con '' por un instante.
  subscribeAuthState(apply);
})();
