/* =============================================================
   TINTIN — Boot tutorial de bienvenida en home
   =============================================================
   Solo corre en index/home. No muestra nada a visitantes sin login.
   El modal real vive en js/onboarding.js.
   ============================================================= */

import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getUserRole } from './roles.js';
import { initOnboarding } from './onboarding.js';

(function () {
  'use strict';
  if (window.TintinWelcomeTutorialInitBooted) return;
  window.TintinWelcomeTutorialInitBooted = true;

  function isHomePage() {
    const path = (location.pathname || '').replace(/\/+/g, '/').toLowerCase();
    return path.endsWith('/') || path.endsWith('/index.html') || path === '';
  }

  if (!isHomePage()) return;

  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const role = await getUserRole(user.uid, user.email);
      await initOnboarding(user, role);
    } catch (e) {
      console.warn('[welcome-tutorial-init] No se pudo iniciar tutorial:', e);
    }
  });
})();
