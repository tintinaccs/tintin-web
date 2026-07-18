const LOGIN_RE = /(?:^|\/)login(?:\.html)?\/?$/i;

if (LOGIN_RE.test(location.pathname || '') && !window.TintinLoginMaintenanceBooted) {
  window.TintinLoginMaintenanceBooted = true;

  function loadStyles() {
    if (document.querySelector('link[data-tt-login-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/login-maintenance.css?v=20260718-1', import.meta.url).href;
    link.dataset.ttLoginMaintenance = '1';
    document.head.appendChild(link);
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
    const canonical = new URL('login.html', location.href);
    canonical.search = '';
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
    window.ttPageReady?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
