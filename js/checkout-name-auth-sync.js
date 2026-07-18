import { auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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
