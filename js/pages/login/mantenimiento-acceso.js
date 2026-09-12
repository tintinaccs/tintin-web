const LOGIN_RE = /(?:^|\/)login(?:\.html)?\/?$/i;

if (LOGIN_RE.test(location.pathname || '') && !window.TintinLoginMaintenanceBooted) {
  window.TintinLoginMaintenanceBooted = true;

  let canonicalProfileReady = Promise.resolve();
  const replayingProfileSave = new WeakSet();

  function ensureStyle(selector, href, datasetName) {
    if (document.querySelector(selector)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(href, import.meta.url).href;
    link.dataset[datasetName] = '1';
    document.head.appendChild(link);
  }

  function loadStyles() {
    ensureStyle(
      'link[data-tt-login-maintenance]',
      '../../../css/pages/login/login-maintenance.css?v=tintin-20260811-cls-desktop-stable-2',
      'ttLoginMaintenance'
    );
    ensureStyle(
      'link[data-tt-login-fluid]',
      '../../../css/pages/login/login-fluid-responsive.css?v=tintin-20260803-login-fluid-1',
      'ttLoginFluid'
    );
    ensureStyle(
      'link[data-tt-login-onboarding-flow]',
      '../../../css/pages/login/login-onboarding-flow.css?v=tintin-20260904-login-surface-no-card-1',
      'ttLoginOnboardingFlow'
    );
  }

  function normalizeLocation() {
    const url = new URL(location.href);
    const from = url.searchParams.get('from');
    if (from) {
      try {
        const target = new URL(from, location.origin);
        if (target.origin !== location.origin) url.searchParams.delete('from');
        else url.searchParams.set('from', `${target.pathname}${target.search}${target.hash}`);
      } catch {
        url.searchParams.delete('from');
      }
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    const canonical = new URL('/login', location.origin);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical.href);
  }

  function improveSemantics() {
    const error = document.getElementById('login-error');
    const success = document.getElementById('login-success');
    error?.setAttribute('role', 'alert');
    error?.setAttribute('aria-live', 'assertive');
    success?.setAttribute('role', 'status');
    success?.setAttribute('aria-live', 'polite');
    document.getElementById('btn-google')?.setAttribute('aria-describedby', 'login-heading-sub');
    document.getElementById('login-email-input')?.setAttribute('aria-describedby', 'login-heading-sub');
  }

  function setNetworkState() {
    document.body?.classList.toggle('tt-login-offline', navigator.onLine === false);
  }

  function authMethodForUser(user, AUTH_METHOD) {
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    return providers.some(provider => provider?.providerId === 'google.com')
      ? AUTH_METHOD.GOOGLE
      : AUTH_METHOD.EMAIL;
  }

  async function repairCanonicalProfileIfNeeded() {
    const [{ auth, db }, profileModule, firestoreApi] = await Promise.all([
      import('../../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1'),
      import('../../core/store/perfil-usuario.js?v=tintin-20260903-accounts-phase-a-4'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
    ]);

    try { await auth.authStateReady?.(); } catch {}
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return { repaired: false, reason: 'signed_out' };

    const ref = firestoreApi.doc(db, 'users', user.uid);
    const snapshot = await firestoreApi.getDoc(ref);
    if (snapshot.exists()) return { repaired: false, reason: 'exists' };

    // Una sesión Auth restaurada puede sobrevivir a una creación de perfil
    // interrumpida. El formulario de onboarding no puede crear por sí solo ese
    // documento porque firestore.rules exige el contrato completo de identidad
    // (email/customerId/profileStatus/provider/etc.). Reutilizamos la única
    // función canónica de creación; luego el formulario sólo completa los datos
    // comerciales que falten, como siempre.
    const method = authMethodForUser(user, profileModule.AUTH_METHOD);
    await profileModule.ensureUserProfile(db, user, method);
    return { repaired: true, reason: 'missing_profile' };
  }

  function startCanonicalProfileRepair() {
    canonicalProfileReady = repairCanonicalProfileIfNeeded().catch(error => {
      console.warn('[login-maintenance] No se pudo reparar el perfil canónico:', error);
      // No se cierra la sesión. El guardado queda libre para mostrar su error
      // normal y un reintento posterior podrá volver a reparar el documento.
      return { repaired: false, reason: 'repair_failed', error };
    });
    window.TintinCanonicalProfileReady = canonicalProfileReady;
  }

  function guardOnboardingSaveUntilCanonicalProfile() {
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#btn-save-profile');
      if (!button || replayingProfileSave.has(button)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      const previousDisabled = button.disabled;
      button.disabled = true;

      canonicalProfileReady.then(result => {
        if (result?.reason === 'repair_failed') {
          button.disabled = previousDisabled;
          const error = document.getElementById('login-error');
          if (error) {
            error.textContent = 'No pudimos preparar tu perfil para guardar los datos. Revisá tu conexión e intentá de nuevo.';
            error.classList.add('show');
          }
          return;
        }
        button.disabled = previousDisabled;
        replayingProfileSave.add(button);
        try { button.click(); }
        finally { queueMicrotask(() => replayingProfileSave.delete(button)); }
      });
    }, true);
  }

  function boot() {
    loadStyles();
    normalizeLocation();
    improveSemantics();
    setNetworkState();
    window.addEventListener('online', setNetworkState);
    window.addEventListener('offline', setNetworkState);
    guardOnboardingSaveUntilCanonicalProfile();
    startCanonicalProfileRepair();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
