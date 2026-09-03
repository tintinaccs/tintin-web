const LOGIN_RE = /(?:^|\/)login(?:\.html)?\/?$/i;

if (LOGIN_RE.test(location.pathname || '') && !window.TintinLoginMaintenanceBooted) {
  window.TintinLoginMaintenanceBooted = true;

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
      '../../../css/pages/login/login-onboarding-flow.css?v=tintin-20260903-login-brand-responsive-2',
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

  function boot() {
    loadStyles();
    normalizeLocation();
    improveSemantics();
    setNetworkState();
    window.addEventListener('online', setNetworkState);
    window.addEventListener('offline', setNetworkState);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
