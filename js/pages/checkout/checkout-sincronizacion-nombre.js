import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

(function () {
  'use strict';

  if (window.TintinCheckoutNameAuthSyncBooted) return;
  window.TintinCheckoutNameAuthSyncBooted = true;

  function apply(user) {
    const guard = window.TintinCheckoutNameGuard;
    if (!guard) return;
    guard.applyPreferredName(user?.displayName || '');
  }

  onAuthStateChanged(auth, apply);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(auth.currentUser), { once: true });
  } else {
    apply(auth.currentUser);
  }
})();
