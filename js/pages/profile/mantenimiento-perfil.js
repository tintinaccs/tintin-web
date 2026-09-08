const PROFILE_PATH_RE = /(?:^|\/)perfil(?:\.html)?\/?$/i;

if (PROFILE_PATH_RE.test(window.location.pathname || '') && !window.TintinProfileMaintenanceBooted) {
  window.TintinProfileMaintenanceBooted = true;

  function injectStyles() {
    if (document.getElementById('tt-profile-maintenance-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-profile-maintenance-style';
    style.textContent = `
      body:has(.perfil-wrap) {
        background:var(--page-bg,var(--pink-pale,#fff6fa))!important;
        color:var(--text,#382d31)!important;
      }
      .perfil-wrap { width:min(100% - 32px,760px)!important; }
      .perfil-card,
      .perfil-input,
      .perfil-wa-box,
      .perfil-order-row,
      .tt-profile-state {
        background:var(--surface,#fff)!important;
        border-color:var(--border,#ecd5de)!important;
      }
      .perfil-header { background:var(--surface-soft,var(--pink-pale,#fff6fa))!important; }
      .perfil-input { color:var(--text,#382d31)!important; }
      .perfil-input:focus-visible,
      .perfil-btn:focus-visible,
      .perfil-back:focus-visible,
      .perfil-wa-box:focus-visible {
        outline:3px solid color-mix(in srgb,var(--pink-dark,#ad3f67) 34%,transparent)!important;
        outline-offset:3px!important;
      }
      .perfil-wa-box { color:var(--text,#382d31)!important; }
      .perfil-wa-desc { color:var(--text-muted,#755f67)!important; }
      .perfil-btn-danger {
        border-color:var(--danger,#b42345)!important;
        color:var(--danger,#b42345)!important;
      }
      .perfil-btn-danger:hover { background:var(--danger,#b42345)!important;color:#fff!important; }
      .perfil-order-row { padding:14px!important;border-radius:14px;margin-bottom:10px;border:1px solid var(--border,#ecd5de)!important; }
      .perfil-order-row.tt-profile-order-focus { box-shadow:0 0 0 4px rgba(199,154,59,.24),0 18px 38px rgba(173,63,103,.14)!important; }
      .tt-profile-order-head { display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px; }
      .tt-profile-order-meta { font-size:11px;color:var(--text-muted,#755f67);font-weight:750; }
      .tt-profile-order-items { font-size:13px;color:var(--text,#382d31);line-height:1.55; }
      .tt-profile-order-total { font-size:14px;font-weight:850;color:var(--pink-dark,#ad3f67);margin-top:4px; }
      .tt-profile-order-details{margin-top:10px;border-top:1px solid var(--border,#ecd5de);padding-top:10px}.tt-profile-order-details summary{cursor:pointer;font-size:12px;font-weight:800;color:var(--pink-dark,#ad3f67)}
      .tt-profile-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:14px 0}.tt-profile-step{font-size:10px;text-align:center;color:var(--text-muted,#755f67);border-top:3px solid var(--border,#ecd5de);padding-top:7px}.tt-profile-step.is-done{border-color:var(--success,#267a41);color:var(--success,#267a41);font-weight:800}
      .tt-profile-order-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;line-height:1.55}.tt-profile-order-grid strong{display:block}.tt-profile-order-lines{grid-column:1/-1;border-top:1px solid var(--border,#ecd5de);padding-top:8px}.tt-profile-order-line{display:flex;justify-content:space-between;gap:10px;padding:3px 0}
      .tt-profile-status { display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.04em;border:1px solid currentColor; }
      .tt-profile-status--pendiente { color:var(--warning,#946200);background:var(--warning-soft,#fff4cf); }
      .tt-profile-status--confirmado { color:var(--info,#245b98);background:var(--info-soft,#eaf3ff); }
      .tt-profile-status--enviado { color:var(--purple,#7147a8);background:var(--purple-soft,#f2eaff); }
      .tt-profile-status--entregado { color:var(--success,#267a41);background:var(--success-soft,#eaf7ee); }
      .tt-profile-status--cancelado { color:var(--danger,#b42345);background:var(--danger-soft,#fff0f3); }
      .tt-profile-state { padding:24px 16px;border:1px solid var(--border,#ecd5de);border-radius:14px;text-align:center;color:var(--text-muted,#755f67);font-size:13px;line-height:1.6; }
      .tt-profile-state .perfil-btn { margin-top:12px; }
      #tt-profile-network { width:min(100% - 32px,760px);margin:76px auto -78px;min-height:24px;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--text-muted,#755f67);font-size:11px;font-weight:750;text-align:center; }
      #tt-profile-network::before { content:'';width:7px;height:7px;border-radius:50%;background:var(--success,#267a41);box-shadow:0 0 0 3px color-mix(in srgb,var(--success,#267a41) 15%,transparent); }
      #tt-profile-network[data-state='offline']::before,
      #tt-profile-network[data-state='error']::before { background:var(--danger,#b42345);box-shadow:0 0 0 3px color-mix(in srgb,var(--danger,#b42345) 15%,transparent); }
      .perfil-toast { max-width:min(420px,calc(100vw - 32px));right:16px!important;bottom:max(88px,env(safe-area-inset-bottom))!important; }
      @media (min-width:1440px) { .perfil-wrap { width:min(100% - 48px,820px)!important;padding-top:112px!important; } }
      @media (min-width:1024px) and (max-width:1439px) { .perfil-wrap { width:min(100% - 48px,760px)!important; } }
      @media (min-width:769px) and (max-width:1023px) { .perfil-wrap { width:min(100% - 40px,720px)!important;padding-top:94px!important; } }
      @media (min-width:601px) and (max-width:768px) { .perfil-wrap { width:min(100% - 32px,680px)!important;padding-top:88px!important; } }
      @media (max-width:600px) { .perfil-wrap { width:calc(100% - 24px)!important;padding:82px 0 108px!important; } .perfil-card{border-radius:16px!important;} .perfil-header{align-items:flex-start!important;} .perfil-btn{width:100%;}.tt-profile-order-grid{grid-template-columns:1fr}.tt-profile-order-lines{grid-column:1}.tt-profile-timeline{grid-template-columns:repeat(2,1fr)} }
      @media (max-width:360px) { .perfil-wrap { width:calc(100% - 16px)!important; } .perfil-header,.perfil-body{padding:14px!important;} .perfil-avatar{width:58px!important;height:58px!important;font-size:22px!important;} .perfil-name{font-size:16px!important;} }
      @media (prefers-reduced-motion:reduce) { .perfil-btn,.perfil-card,.perfil-toast{transition:none!important;} }
    `;
    document.head.appendChild(style);
  }

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
    let node = document.getElementById('tt-profile-network');
    if (!node) {
      node = document.createElement('div');
      node.id = 'tt-profile-network';
      node.dataset.ttOperationalStatus = 'profile';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.querySelector('.perfil-wrap')?.insertAdjacentElement('beforebegin', node);
    }
    const offline = navigator.onLine === false;
    node.dataset.state = offline ? 'offline' : 'online';
    node.textContent = offline ? 'Sin conexión · mostraremos la información guardada y reintentaremos automáticamente' : 'Perfil y pedidos sincronizados';
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
    injectStyles();
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
