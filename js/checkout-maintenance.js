/* TINTIN — Mantenimiento integral 05: Checkout */
const CHECKOUT_RE = /(?:^|\/)checkout(?:\.html)?\/?$/i;

if (CHECKOUT_RE.test(location.pathname || '') && !window.TintinCheckoutMaintenanceBooted) {
  window.TintinCheckoutMaintenanceBooted = true;

  const body = document.body;
  let confirmLocked = false;

  function loadStyles() {
    if (document.querySelector('link[data-tt-checkout-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/checkout-maintenance.css?v=20260718-1', import.meta.url).href;
    link.dataset.ttCheckoutMaintenance = '1';
    document.head.appendChild(link);
  }

  function normalizeMetadata() {
    const canonical = new URL('checkout.html', location.href);
    canonical.search = '';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical.href);
  }

  function improveFormSemantics() {
    const labels = [
      ['#ck-city', 'Ciudad'],
      ['#ck-address', 'Dirección de entrega'],
      ['#ck-referencia', 'Referencia'],
      ['#ck-map-search', 'Buscar ubicación'],
      ['#ck-location-name', 'Nombre de la ubicación'],
      ['#ck-name', 'Nombre completo'],
      ['#ck-phone-country', 'Código de país'],
      ['#ck-phone-number', 'Teléfono o WhatsApp'],
      ['#ck-email', 'Correo electrónico'],
      ['#ck-notes', 'Notas del pedido'],
    ];
    labels.forEach(([selector, label]) => {
      const input = document.querySelector(selector);
      if (!input) return;
      if (!input.id) input.id = `tt-checkout-field-${Math.random().toString(36).slice(2)}`;
      input.setAttribute('aria-label', label);
      input.setAttribute('aria-invalid', 'false');
    });

    document.querySelectorAll('.ck-error').forEach(node => {
      node.setAttribute('role', 'alert');
      node.setAttribute('aria-live', 'assertive');
    });

    document.querySelectorAll('.ck-panel').forEach((panel, index) => {
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', `Paso ${index + 1} del checkout`);
    });
  }

  function setNetworkState() {
    const offline = navigator.onLine === false;
    body?.classList.toggle('tt-checkout-offline', offline);
    if (offline) {
      document.getElementById('tt-checkout-sync-state')?.setAttribute('data-state', 'offline');
    }
  }

  function lockConfirmation() {
    const button = document.getElementById('ck-confirm-btn');
    if (!button || button.dataset.ttMaintenanceBound) return;
    button.dataset.ttMaintenanceBound = '1';
    button.addEventListener('click', event => {
      if (confirmLocked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      confirmLocked = true;
      body?.classList.add('tt-checkout-submitting');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const unlock = () => {
        const successVisible = document.getElementById('ck-success-head')?.style.display !== 'none';
        if (successVisible) return;
        confirmLocked = false;
        body?.classList.remove('tt-checkout-submitting');
        button.disabled = false;
        button.removeAttribute('aria-busy');
      };
      window.setTimeout(unlock, 12000);
    }, true);

    window.addEventListener('tintin:order-created', () => {
      confirmLocked = true;
      body?.classList.add('tt-checkout-submitting');
    });
  }

  function watchErrors() {
    document.querySelectorAll('.ck-error').forEach(error => {
      new MutationObserver(() => {
        const visible = error.classList.contains('show') || (error.textContent || '').trim().length > 0;
        error.closest('.ck-panel')?.querySelectorAll('input, select, textarea').forEach(control => {
          if (visible && !control.value) control.setAttribute('aria-invalid', 'true');
          else control.setAttribute('aria-invalid', 'false');
        });
      }).observe(error, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    });
  }

  function ensureReady() {
    const panels = [...document.querySelectorAll('.ck-panel')];
    if (!panels.length) return;
    if (!panels.some(panel => panel.classList.contains('active'))) panels[0].classList.add('active');
    window.ttPageReady?.();
    requestAnimationFrame(() => window.TintinLoader?.hide?.());
  }

  function boot() {
    loadStyles();
    normalizeMetadata();
    improveFormSemantics();
    setNetworkState();
    lockConfirmation();
    watchErrors();
    ensureReady();

    window.addEventListener('online', () => { setNetworkState(); ensureReady(); });
    window.addEventListener('offline', setNetworkState);
    window.addEventListener('pageshow', ensureReady);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureReady(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
