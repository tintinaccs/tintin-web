const PROFILE_PATH_RE = /(?:^|\/)perfil(?:\.html)?\/?$/i;

if (PROFILE_PATH_RE.test(window.location.pathname || '') && !window.TintinProfileMaintenanceBooted) {
  window.TintinProfileMaintenanceBooted = true;

  const VERSION = 'tintin-20260718-profile-maintenance-1';
  let unsubscribeOrders = null;
  let retryTimer = 0;

  const escapeHtml = value => {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  };

  const formatPrice = value => `Gs. ${Math.round(Number(value) || 0).toLocaleString('es-PY')}`;

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
      .tt-profile-order-head { display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px; }
      .tt-profile-order-meta { font-size:11px;color:var(--text-muted,#755f67);font-weight:750; }
      .tt-profile-order-items { font-size:13px;color:var(--text,#382d31);line-height:1.55; }
      .tt-profile-order-total { font-size:14px;font-weight:850;color:var(--pink-dark,#ad3f67);margin-top:4px; }
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
      @media (max-width:600px) { .perfil-wrap { width:calc(100% - 24px)!important;padding:82px 0 108px!important; } .perfil-card{border-radius:16px!important;} .perfil-header{align-items:flex-start!important;} .perfil-btn{width:100%;} }
      @media (max-width:360px) { .perfil-wrap { width:calc(100% - 16px)!important; } .perfil-header,.perfil-body{padding:14px!important;} .perfil-avatar{width:58px!important;height:58px!important;font-size:22px!important;} .perfil-name{font-size:16px!important;} }
      @media (prefers-reduced-motion:reduce) { .perfil-btn,.perfil-card,.perfil-toast{transition:none!important;} }
    `;
    document.head.appendChild(style);
  }

  function normalizeCanonical() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = new URL('perfil.html', window.location.origin + '/').href;
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
    const orders = document.getElementById('perfil-orders-list');
    if (orders) { orders.setAttribute('aria-live', 'polite'); orders.setAttribute('aria-busy', 'true'); }
  }

  function ensureNetworkState() {
    let node = document.getElementById('tt-profile-network');
    if (!node) {
      node = document.createElement('div');
      node.id = 'tt-profile-network';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.querySelector('.perfil-wrap')?.insertAdjacentElement('beforebegin', node);
    }
    const offline = navigator.onLine === false;
    node.dataset.state = offline ? 'offline' : 'online';
    node.textContent = offline ? 'Sin conexión · mostraremos la información guardada y reintentaremos automáticamente' : 'Perfil y pedidos sincronizados';
    return node;
  }

  function statusClass(status) {
    const value = String(status || 'pendiente').toLowerCase().trim();
    return ['pendiente','confirmado','enviado','entregado','cancelado'].includes(value) ? value : 'pendiente';
  }

  function orderTimestamp(order) {
    const raw = order?.createdAt;
    if (raw?.toDate) return raw.toDate().getTime();
    const date = raw instanceof Date ? raw : new Date(raw || 0);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  function renderOrders(orders) {
    const list = document.getElementById('perfil-orders-list');
    if (!list) return;
    list.setAttribute('aria-busy', 'false');
    const sorted = [...orders].sort((a,b) => orderTimestamp(b) - orderTimestamp(a));
    if (!sorted.length) {
      list.innerHTML = `<div class="tt-profile-state">Todavía no tenés pedidos.<br><a href="catalogo.html" class="perfil-btn perfil-btn-outline">Ver productos →</a></div>`;
      return;
    }
    const visible = sorted.slice(0, 10);
    list.innerHTML = visible.map(order => {
      const date = new Date(orderTimestamp(order) || Date.now());
      const dateText = date.toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric'});
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsText = items.slice(0,3).map(item => `${Math.max(1,Number(item.qty)||1)}x ${escapeHtml(item.name || 'Producto')}`).join(', ');
      const more = items.length > 3 ? ` +${items.length - 3} más` : '';
      const status = statusClass(order.status);
      const shortId = escapeHtml(String(order.id || '').slice(-6).toUpperCase() || 'PEDIDO');
      return `<article class="perfil-order-row">
        <div class="tt-profile-order-head"><span class="tt-profile-order-meta">#${shortId} · ${dateText}</span><span class="tt-profile-status tt-profile-status--${status}">${escapeHtml(order.status || 'pendiente')}</span></div>
        <div class="tt-profile-order-items">${itemsText || 'Sin detalle de productos'}${more}</div>
        <div class="tt-profile-order-total">Total: ${formatPrice(order.total)}</div>
      </article>`;
    }).join('') + (sorted.length > visible.length ? `<div class="tt-profile-state">Mostrando los 10 pedidos más recientes de ${sorted.length}.</div>` : '');
  }

  function renderOrdersError(message) {
    const list = document.getElementById('perfil-orders-list');
    if (!list) return;
    list.setAttribute('aria-busy','false');
    list.innerHTML = `<div class="tt-profile-state" role="alert">${escapeHtml(message)}<br><button type="button" class="perfil-btn perfil-btn-outline" id="tt-profile-orders-retry">Reintentar</button></div>`;
    document.getElementById('tt-profile-orders-retry')?.addEventListener('click', () => startRealtimeOrders(true), { once:true });
  }

  async function startRealtimeOrders(force = false) {
    if (unsubscribeOrders && !force) return;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    clearTimeout(retryTimer);
    const list = document.getElementById('perfil-orders-list');
    if (list) { list.setAttribute('aria-busy','true'); list.innerHTML = '<div class="tt-profile-state">Sincronizando pedidos…</div>'; }
    try {
      const [{ auth, db }, firestore, authApi] = await Promise.all([
        import(`./firebase.js?v=${VERSION}`),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
      ]);
      const user = auth.currentUser || await new Promise(resolve => {
        const stop = authApi.onAuthStateChanged(auth, current => { stop(); resolve(current); });
      });
      if (!user) return;
      const q = firestore.query(firestore.collection(db,'orders'), firestore.where('userId','==',user.uid));
      unsubscribeOrders = firestore.onSnapshot(q, snapshot => {
        renderOrders(snapshot.docs.map(doc => ({ id:doc.id,...doc.data() })));
        ensureNetworkState();
      }, error => {
        console.warn('[profile-maintenance] orders listener failed', error);
        renderOrdersError(navigator.onLine === false ? 'No podemos actualizar tus pedidos sin conexión.' : 'No pudimos sincronizar tus pedidos ahora.');
        ensureNetworkState().dataset.state = 'error';
        retryTimer = window.setTimeout(() => startRealtimeOrders(true), 6000);
      });
    } catch (error) {
      console.warn('[profile-maintenance] runtime failed', error);
      renderOrdersError('No pudimos preparar la actualización de pedidos.');
    }
  }

  function guardAsyncActions() {
    const ids = ['btn-guardar-perfil','btn-logout','btn-borrar-ubicacion'];
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !ids.includes(button.id) || button.dataset.ttBusy === '1') return;
      button.dataset.ttBusy = '1';
      button.setAttribute('aria-busy','true');
      button.disabled = true;
      window.setTimeout(() => {
        button.dataset.ttBusy = '0';
        button.removeAttribute('aria-busy');
        button.disabled = false;
      }, 1800);
    }, true);
  }

  function boot() {
    injectStyles();
    normalizeCanonical();
    improveFormSemantics();
    ensureNetworkState();
    guardAsyncActions();
    startRealtimeOrders();
    window.addEventListener('online', () => { ensureNetworkState(); startRealtimeOrders(true); });
    window.addEventListener('offline', ensureNetworkState);
    window.addEventListener('pageshow', event => { if (event.persisted) startRealtimeOrders(true); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) startRealtimeOrders(true); });
    window.addEventListener('beforeunload', () => unsubscribeOrders?.(), { once:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
