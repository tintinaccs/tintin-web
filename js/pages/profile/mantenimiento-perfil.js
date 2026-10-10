const PROFILE_PATH_RE = /(?:^|\/)perfil(?:\.html)?\/?$/i;

if (PROFILE_PATH_RE.test(window.location.pathname || '') && !window.TintinProfileMaintenanceBooted) {
  window.TintinProfileMaintenanceBooted = true;

  function normalizeCanonical() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = new URL('/perfil', window.location.origin).href;
  }

  function improveFormSemantics() {
    const fields = [
      ['perfil-nombre', 'Nombre'],
      ['perfil-tel', 'Teléfono (opcional)'],
      ['perfil-dir', 'Dirección de entrega (opcional)'],
    ];
    fields.forEach(([id]) => {
      const input = document.getElementById(id);
      const label = input?.closest('.perfil-field')?.querySelector('.perfil-label');
      if (input && label) label.htmlFor = id;
    });
    const toast = document.getElementById('perfil-toast');
    if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
  }

  function ensureNetworkState() {
    const node = document.querySelector('.tt-profile-network-state');
    if (!node) return null;
    node.id = 'tt-profile-network';
    if (navigator.onLine === false) {
      node.dataset.state = 'offline';
      node.textContent = 'Sin conexión · conservamos la información disponible';
    }
    return node;
  }

  function guardAsyncActions() {
    const ids = ['btn-guardar-perfil','btn-logout','btn-borrar-ubicacion'];
    const timers = new Map();
    function release(button) {
      const timer = timers.get(button.id);
      if (timer) { window.clearTimeout(timer); timers.delete(button.id); }
      button.dataset.ttBusy = '0';
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !ids.includes(button.id) || button.dataset.ttBusy === '1') return;
      button.dataset.ttBusy = '1';
      button.setAttribute('aria-busy','true');
      button.disabled = true;
      // Tope de seguridad: si el handler real (perfil.html) nunca llama a
      // TintinReleaseProfileButton (promesa colgada, excepción no
      // capturada), el botón igual se reactiva a los 1800ms en vez de
      // quedar bloqueado para siempre — pero el camino normal ahora libera
      // apenas termina la operación real, en vez de esperar ese tope fijo
      // aunque el guardado/logout ya haya terminado hace rato.
      timers.set(button.id, window.setTimeout(() => release(button), 1800));
    }, true);
    window.TintinReleaseProfileButton = id => {
      const button = document.getElementById(id);
      if (button) release(button);
    };
  }

  function boot() {
    normalizeCanonical();
    improveFormSemantics();
    ensureNetworkState();
    guardAsyncActions();
    window.addEventListener('online', ensureNetworkState);
    window.addEventListener('offline', ensureNetworkState);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
