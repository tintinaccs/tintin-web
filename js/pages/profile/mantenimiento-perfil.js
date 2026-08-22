const PROFILE_PATH_RE = /(?:^|\/)perfil(?:\.html)?\/?$/i;

if (PROFILE_PATH_RE.test(window.location.pathname || '') && !window.TintinProfileMaintenanceBooted) {
  window.TintinProfileMaintenanceBooted = true;

  const VERSION = 'tintin-20260822-account-invariants-1';
  let unsubscribeOrders = null;
  let startingOrders = false;
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
      .perfil-input[readonly] { background:var(--surface-soft,#f7f2f4)!important;color:var(--text-muted,#755f67)!important;cursor:not-allowed; }
      .tt-profile-immutable-note { margin:4px 0 0;font-size:11px;line-height:1.45;color:var(--text-muted,#755f67); }
      .tt-profile-identity-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
      .tt-profile-identity-value { min-height:44px;display:flex;align-items:center;padding:11px 16px;border:1.5px solid var(--border,#ecd5de);border-radius:var(--radius-sm,12px);background:var(--surface-soft,#f7f2f4);font-size:14px;color:var(--text,#382d31);overflow-wrap:anywhere; }
      .tt-profile-username-actions { display:flex;gap:8px;align-items:center; }
      .tt-profile-username-actions .perfil-input { flex:1;min-width:0; }
      .tt-profile-username-actions .perfil-btn { flex:0 0 auto; }
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
      @media (max-width:600px) { .perfil-wrap { width:calc(100% - 24px)!important;padding:82px 0 108px!important; } .perfil-card{border-radius:16px!important;} .perfil-header{align-items:flex-start!important;} .perfil-btn{width:100%;}.tt-profile-order-grid,.tt-profile-identity-grid{grid-template-columns:1fr}.tt-profile-order-lines{grid-column:1}.tt-profile-timeline{grid-template-columns:repeat(2,1fr)}.tt-profile-username-actions{align-items:stretch;flex-direction:column}.tt-profile-username-actions .perfil-btn{width:100%;} }
      @media (max-width:360px) { .perfil-wrap { width:calc(100% - 16px)!important; } .perfil-header,.perfil-body{padding:14px!important;} .perfil-avatar{width:58px!important;height:58px!important;font-size:22px!important;} .perfil-name{font-size:16px!important;} }
      @media (prefers-reduced-motion:reduce) { .perfil-btn,.perfil-card,.perfil-toast{transition:none!important;} }
    `;
    document.head.appendChild(style);
  }

  function normalizeCanonical() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = new URL('perfil.html', window.location.origin + '/').href;
  }

  function lockImmutablePhone() {
    const input = document.getElementById('perfil-tel');
    if (!input) return;
    input.readOnly = true;
    input.setAttribute('aria-readonly', 'true');
    input.title = 'El teléfono queda vinculado a la cuenta después del registro.';
    const field = input.closest('.perfil-field');
    const label = field?.querySelector('.perfil-label');
    if (label) label.textContent = 'Teléfono';
    if (field && !field.querySelector('.tt-profile-immutable-note')) {
      const note = document.createElement('p');
      note.className = 'tt-profile-immutable-note';
      note.textContent = 'Dato verificado de la cuenta. No se puede modificar desde el perfil.';
      field.appendChild(note);
    }
  }

  function improveFormSemantics() {
    const fields = [
      ['perfil-nombre', 'Nombre'],
      ['perfil-tel', 'Teléfono'],
      ['perfil-dir', 'Dirección de entrega (opcional)'],
    ];
    fields.forEach(([id]) => {
      const input = document.getElementById(id);
      const label = input?.closest('.perfil-field')?.querySelector('.perfil-label');
      if (input && label) label.htmlFor = id;
    });
    lockImmutablePhone();
    const toast = document.getElementById('perfil-toast');
    if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
    const orders = document.getElementById('perfil-orders-list');
    if (orders) { orders.setAttribute('aria-live', 'polite'); orders.setAttribute('aria-busy', 'true'); }
  }

  function ensureIdentityCard() {
    let card = document.getElementById('tt-profile-identity-card');
    if (card) return card;
    const firstCard = document.querySelector('.perfil-wrap .perfil-card');
    if (!firstCard) return null;
    card = document.createElement('section');
    card.className = 'perfil-card';
    card.id = 'tt-profile-identity-card';
    card.innerHTML = `
      <div class="perfil-body">
        <div class="perfil-section-title">Identidad de mi cuenta</div>
        <div class="tt-profile-identity-grid">
          <div class="perfil-field">
            <label class="perfil-label" for="tt-profile-username">@Username</label>
            <div class="tt-profile-username-actions">
              <input class="perfil-input" id="tt-profile-username" autocomplete="username" maxlength="20" placeholder="tu_usuario" />
              <button type="button" class="perfil-btn perfil-btn-outline" id="tt-profile-save-username">Guardar</button>
            </div>
            <p class="tt-profile-immutable-note" id="tt-profile-username-note">Cargando información del @username…</p>
          </div>
          <div class="perfil-field">
            <span class="perfil-label">Cédula</span>
            <div class="tt-profile-identity-value" id="tt-profile-ci">—</div>
            <p class="tt-profile-immutable-note">Se registra al utilizar encomienda y queda vinculada a la cuenta.</p>
          </div>
        </div>
      </div>`;
    firstCard.insertAdjacentElement('afterend', card);
    return card;
  }

  function showProfileToast(message) {
    const toast = document.getElementById('perfil-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  async function loadIdentityControls() {
    const card = ensureIdentityCard();
    if (!card) return;
    const usernameInput = document.getElementById('tt-profile-username');
    const usernameButton = document.getElementById('tt-profile-save-username');
    const usernameNote = document.getElementById('tt-profile-username-note');
    const ciValue = document.getElementById('tt-profile-ci');

    try {
      const [{ auth, db }, firestore, authApi] = await Promise.all([
        import(`../../core/firebase/firebase.js?v=${VERSION}`),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      ]);
      const user = auth.currentUser || await new Promise(resolve => {
        const stop = authApi.onAuthStateChanged(auth, current => { stop(); resolve(current); });
      });
      if (!user) return;

      const snapshot = await firestore.getDoc(firestore.doc(db, 'users', user.uid));
      const profile = snapshot.exists() ? snapshot.data() : {};
      const username = String(profile.username || '').trim().toLowerCase();
      const usedChanges = Math.max(0, Number(profile.usernameChangeCount || 0));
      usernameInput.value = username;
      ciValue.textContent = profile.ci ? String(profile.ci) : 'Todavía no registrada';

      const refreshState = (nextUsername, remainingChanges) => {
        usernameInput.value = nextUsername || '';
        if (!nextUsername) {
          usernameNote.textContent = 'Podés crear tu @username. La asignación inicial no consume tu único cambio posterior.';
          usernameInput.readOnly = false;
          usernameButton.hidden = false;
          usernameButton.textContent = 'Crear @';
          return;
        }
        if (remainingChanges > 0) {
          usernameNote.textContent = 'Podés cambiar tu @username una sola vez. Después quedará bloqueado.';
          usernameInput.readOnly = false;
          usernameButton.hidden = false;
          usernameButton.textContent = 'Cambiar @';
        } else {
          usernameNote.textContent = 'Tu único cambio de @username ya fue utilizado. Este dato queda bloqueado.';
          usernameInput.readOnly = true;
          usernameButton.hidden = true;
        }
      };

      refreshState(username, usedChanges >= 1 ? 0 : 1);

      usernameButton.addEventListener('click', async () => {
        if (usernameButton.dataset.busy === '1') return;
        const requested = String(usernameInput.value || '').trim().toLowerCase();
        usernameButton.dataset.busy = '1';
        usernameButton.disabled = true;
        usernameInput.disabled = true;
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/account-username-change', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${idToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ username: requested }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.ok) throw new Error(result.error || 'No pudimos actualizar tu @username.');
          refreshState(result.username, Number(result.remainingChanges || 0));
          showProfileToast(result.initialAssignment ? '✅ @username creado' : (result.changed ? '✅ @username actualizado' : '✅ @username confirmado'));
        } catch (error) {
          showProfileToast(`❌ ${String(error?.message || 'No pudimos actualizar tu @username.').slice(0, 180)}`);
        } finally {
          usernameButton.dataset.busy = '0';
          usernameButton.disabled = false;
          usernameInput.disabled = false;
        }
      });
    } catch (error) {
      console.warn('[profile-maintenance] identity controls failed', error);
      if (usernameNote) usernameNote.textContent = 'No pudimos cargar los datos de identidad ahora.';
      if (usernameInput) usernameInput.readOnly = true;
      if (usernameButton) usernameButton.hidden = true;
    }
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
      list.innerHTML = `<div class="tt-profile-state">Todavía no tenés pedidos.<br><a href="/catalogo" class="perfil-btn perfil-btn-outline">Ver productos →</a></div>`;
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
      const stages = ['pendiente','confirmado','enviado','entregado'];
      const currentIndex = order.status === 'cancelado' ? -1 : Math.max(0, stages.indexOf(status));
      const timeline = stages.map((stage,index) => `<span class="tt-profile-step ${index <= currentIndex ? 'is-done' : ''}">${stage}</span>`).join('');
      const itemLines = items.map(item => `<div class="tt-profile-order-line"><span>${Math.max(1,Number(item.qty)||1)}x ${escapeHtml(item.name || 'Producto')}</span><strong>${formatPrice((Number(item.price)||0) * Math.max(1,Number(item.qty)||1))}</strong></div>`).join('');
      const payment = escapeHtml(order.paymentMethod || order.payment || 'A confirmar');
      const delivery = escapeHtml(order.shippingMethod || order.deliveryMethod || 'A coordinar');
      const address = escapeHtml(order.address || order.deliveryAddress || order.city || 'Sin direccion registrada');
      const orderAnchor = String(order.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 220);
      return `<article class="perfil-order-row" id="pedido-${orderAnchor}" data-order-id="${orderAnchor}">
        <div class="tt-profile-order-head"><span class="tt-profile-order-meta">#${shortId} · ${dateText}</span><span class="tt-profile-status tt-profile-status--${status}">${escapeHtml(order.status || 'pendiente')}</span></div>
        <div class="tt-profile-order-items">${itemsText || 'Sin detalle de productos'}${more}</div>
        <div class="tt-profile-order-total">Total: ${formatPrice(order.total)}</div>
        <details class="tt-profile-order-details"><summary>Ver seguimiento y detalle</summary>
          <div class="tt-profile-timeline" aria-label="Seguimiento del pedido">${timeline}</div>
          ${status === 'cancelado' ? '<p class="tt-profile-status tt-profile-status--cancelado">Pedido cancelado</p>' : ''}
          <div class="tt-profile-order-grid"><div><strong>Pago</strong>${payment}</div><div><strong>Entrega</strong>${delivery}</div><div><strong>Direcci&oacute;n</strong>${address}</div><div><strong>N&uacute;mero de pedido</strong>${escapeHtml(order.id)}</div><div class="tt-profile-order-lines"><strong>Productos</strong>${itemLines || 'Sin detalle de productos'}<div class="tt-profile-order-line"><span>Total</span><strong>${formatPrice(order.total)}</strong></div></div></div>
        </details>
      </article>`;
    }).join('') + (sorted.length > visible.length ? `<div class="tt-profile-state">Mostrando los 10 pedidos más recientes de ${sorted.length}.</div>` : '');

    const requested = String(location.hash || '').match(/^#pedido-([A-Za-z0-9_-]+)$/)?.[1];
    if (requested) {
      requestAnimationFrame(() => {
        const target = document.getElementById(`pedido-${requested}`);
        if (!target) return;
        target.querySelector('details')?.setAttribute('open', '');
        target.classList.add('tt-profile-order-focus');
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        window.setTimeout(() => target.classList.remove('tt-profile-order-focus'), 2200);
      });
    }
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
    if (startingOrders && !force) return;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    startingOrders = true;
    clearTimeout(retryTimer);
    const list = document.getElementById('perfil-orders-list');
    if (list) { list.setAttribute('aria-busy','true'); list.innerHTML = '<div class="tt-profile-state">Sincronizando pedidos…</div>'; }
    try {
      const [{ auth, db }, firestore, authApi] = await Promise.all([
        import(`../../core/firebase/firebase.js?v=${VERSION}`),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
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
    } finally {
      startingOrders = false;
    }
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
    ensureIdentityCard();
    loadIdentityControls();
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
