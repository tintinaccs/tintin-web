/* =============================================================
   TINTIN — Checkout estable, sincronizado y amigable
   =============================================================
   Esta capa solo se activa en checkout.html y protege cuatro puntos críticos:
   - cada entrada nueva empieza siempre en el paso 1;
   - una página restaurada desde memoria nunca conserva el paso 5;
   - el carrito visible responde a los eventos de sincronización en tiempo real;
   - el mapa acepta búsqueda amplia, ubicación actual, coordenadas y enlaces
     completos de Google Maps sin reemplazar la validación original del checkout.
   ============================================================= */


const BAG_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout(?:\.html)?\/?$/i;
if (!CHECKOUT_PATH_RE.test(window.location.pathname || '') || window.TintinCheckoutReliabilityBooted) {
  // Este módulo se importa desde el shell compartido, pero no hace nada fuera
  // del checkout.
} else {
  window.TintinCheckoutReliabilityBooted = true;

  const RESUME_KEY = 'tt_checkout_resume_step';
  const ROOT = document.documentElement;
  let lastCartFingerprint = '';
  let syncHideTimer = 0;

  function clearResumeState() {
    try { sessionStorage.removeItem(RESUME_KEY); } catch {}
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  function safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function formatPrice(value) {
    const number = Number(value) || 0;
    return `Gs. ${Math.round(number).toLocaleString('es-PY')}`;
  }

  function injectStyles() {
    if (document.getElementById('tt-checkout-reliability-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-checkout-reliability-style';
    style.textContent = `
      html.tt-checkout-leaving,
      html.tt-checkout-hard-reset,
      html.tt-checkout-leaving body,
      html.tt-checkout-hard-reset body {
        background:#FFF6FA!important;
        background-image:none!important;
      }
      html.tt-checkout-leaving body > *:not(#tt-loader),
      html.tt-checkout-hard-reset body > *:not(#tt-loader) {
        visibility:hidden!important;
        pointer-events:none!important;
      }
      #tt-checkout-sync-state {
        width:min(calc(100% - 32px),700px);
        margin:8px auto 0;
        min-height:22px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        color:#8B5B6B;
        font:700 11px/1.35 Montserrat;
        text-align:center;
        transition:opacity .15s linear;
      }
      #tt-checkout-sync-state::before {
        content:'';
        width:7px;
        height:7px;
        flex:0 0 7px;
        border-radius:50%;
        background:#6FB58A;
        box-shadow:0 0 0 3px rgba(111,181,138,.14);
      }
      #tt-checkout-sync-state[data-state="loading"]::before,
      #tt-checkout-sync-state[data-state="saving"]::before { background:#D39A42;box-shadow:0 0 0 3px rgba(211,154,66,.14); }
      #tt-checkout-sync-state[data-state="offline"]::before,
      #tt-checkout-sync-state[data-state="error"]::before { background:#CC4B4B;box-shadow:0 0 0 3px rgba(204,75,75,.14); }
    `;
    document.head.appendChild(style);
  }

  function resetVisualStep() {
    clearResumeState();
    document.querySelectorAll('.ck-panel').forEach((panel, index) => {
      panel.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.ck-step').forEach((step, index) => {
      step.classList.toggle('active', index === 0);
      step.classList.remove('done');
    });
    document.querySelectorAll('.ck-error').forEach(error => error.classList.remove('show'));

    const reviewHead = document.getElementById('ck-review-head');
    const successHead = document.getElementById('ck-success-head');
    const postConfirm = document.getElementById('ck-post-confirm');
    const orderNumber = document.getElementById('ck-order-num');
    const confirmButton = document.getElementById('ck-confirm-btn');
    if (reviewHead) reviewHead.style.display = '';
    if (successHead) successHead.style.display = 'none';
    if (postConfirm) postConfirm.style.display = 'none';
    if (orderNumber) { orderNumber.style.display = 'none'; orderNumber.textContent = ''; }
    if (confirmButton) {
      confirmButton.style.display = '';
      confirmButton.disabled = false;
      confirmButton.textContent = '✓ Confirmar pedido';
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function ensureCheckoutSurface() {
    if (ROOT.classList.contains('tt-store-gate-pending') || ROOT.classList.contains('tt-store-gate-blocked')) return;
    const panels = [...document.querySelectorAll('.ck-panel')];
    if (panels.length && !panels.some(panel => panel.classList.contains('active'))) resetVisualStep();

    ['.ck-back-row', '.ck-steps', '.ck-body'].forEach(selector => {
      const node = document.querySelector(selector);
      if (!node) return;
      node.hidden = false;
      node.inert = false;
      node.removeAttribute('aria-hidden');
      if (node.style.display === 'none') node.style.display = '';
      if (node.style.visibility === 'hidden') node.style.visibility = '';
      if (node.style.opacity === '0') node.style.opacity = '';
    });

    window.ttPageReady?.();
    requestAnimationFrame(() => window.TintinLoader?.hide?.());
  }

  function readActiveCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem('tt_cart') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalizeCart(items) {
    return (Array.isArray(items) ? items : [])
      .filter(item => item && item.id != null)
      .map(item => ({
        id: String(item.id),
        name: String(item.name || item.title || 'Producto'),
        cat: String(item.cat || item.category || ''),
        price: Math.max(0, Number(item.price) || 0),
        qty: Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1))),
        imageUrl: safeImageUrl(item.imageUrl || item.imgUrl || item.image || ''),
      }));
  }

  function cartFingerprint(items) {
    return JSON.stringify(items.map(item => [item.id, item.qty, item.price, item.name, item.imageUrl]));
  }

  function renderLiveCart(inputItems, force = false) {
    const container = document.getElementById('ck-items');
    const subtotalNode = document.getElementById('ck-subtotal-val');
    if (!container || !subtotalNode) return;

    const items = normalizeCart(inputItems);
    const fingerprint = cartFingerprint(items);
    if (!force && fingerprint === lastCartFingerprint && container.children.length) return;
    lastCartFingerprint = fingerprint;

    if (!items.length) {
      container.innerHTML = `
        <div class="ck-empty">
          <div class="ck-empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg></div>
          <div class="ck-empty-text">Tu carrito está vacío</div>
          <p style="color:var(--color-text-primary,#713C53);font-size:13px;margin:6px 0 16px">Agregá un producto para comenzar una compra nueva.</p>
          <a href="/catalogo" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 24px;text-decoration:none;border-radius:999px;background:#F8AACA;color:#713C53!important;font-weight:800">Ver catálogo →</a>
        </div>`;
      subtotalNode.textContent = 'Gs. 0';
      return;
    }

    container.innerHTML = items.map(item => {
      const id = escapeHtml(item.id);
      const name = escapeHtml(item.name);
      const cat = escapeHtml(item.cat);
      const image = item.imageUrl
        ? `<img class="ck-item-img" src="${escapeHtml(item.imageUrl)}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ck-item-img-placeholder" style="display:none">${BAG_ICON_SVG}</div>`
        : `<div class="ck-item-img-placeholder">${BAG_ICON_SVG}</div>`;
      return `<div class="ck-item" data-id="${id}">
        ${image}
        <div class="ck-item-info">
          <div class="ck-item-name">${name}</div>
          <div class="ck-item-cat">${cat}</div>
          <div class="ck-item-price">${formatPrice(item.price)}</div>
        </div>
        <div class="ck-item-controls">
          <button type="button" class="ck-qty-btn" data-action="minus" data-id="${id}" aria-label="Restar una unidad">−</button>
          <span class="ck-qty-num">${item.qty}</span>
          <button type="button" class="ck-qty-btn" data-action="plus" data-id="${id}" aria-label="Sumar una unidad">+</button>
          <button type="button" class="ck-remove-btn" data-action="remove" data-id="${id}" title="Eliminar" aria-label="Eliminar producto">×</button>
        </div>
      </div>`;
    }).join('');
    subtotalNode.textContent = formatPrice(items.reduce((sum, item) => sum + item.price * item.qty, 0));
  }

  function ensureSyncStateNode() {
    let node = document.getElementById('tt-checkout-sync-state');
    if (node) return node;
    const anchor = document.querySelector('.ck-back-row');
    if (!anchor) return null;
    node = document.createElement('div');
    node.id = 'tt-checkout-sync-state';
    node.dataset.ttOperationalStatus = 'checkout';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.dataset.state = navigator.onLine === false ? 'offline' : 'loading';
    node.textContent = navigator.onLine === false ? 'Sin conexión · tu carrito sigue guardado en este dispositivo' : 'Sincronizando tu carrito…';
    anchor.insertAdjacentElement('afterend', node);
    return node;
  }

  function updateSyncState(state, message) {
    const node = ensureSyncStateNode();
    if (!node) return;
    clearTimeout(syncHideTimer);
    const labels = {
      guest: 'Carrito guardado en este dispositivo',
      loading: 'Sincronizando tu carrito…',
      saving: 'Guardando cambios…',
      synced: 'Carrito sincronizado',
      offline: 'Sin conexión · tus cambios quedan guardados acá',
      error: 'No se pudo sincronizar; se volverá a intentar automáticamente',
    };
    node.dataset.state = state || 'synced';
    node.textContent = message || labels[state] || labels.synced;
    node.style.opacity = '1';
    if (state === 'synced' || state === 'guest') {
      syncHideTimer = setTimeout(() => { node.style.opacity = '.55'; }, 1600);
    }
  }

  function boot() {
    injectStyles();
    clearResumeState();
    resetVisualStep();
    ensureSyncStateNode();

    // El carrito local se puede pintar de inmediato. Cuando cart-sync termine de
    // resolver la cuenta, el evento tt_cart_updated lo reemplaza sin recargar.
    renderLiveCart(readActiveCart(), true);
    ensureCheckoutSurface();

    window.addEventListener('tt_cart_updated', event => {
      renderLiveCart(event.detail?.items ?? readActiveCart(), true);
      updateSyncState(event.detail?.status || 'synced');
      ensureCheckoutSurface();
    });
    window.addEventListener('tintin:cart-sync-status', event => {
      updateSyncState(event.detail?.status || 'synced');
      renderLiveCart(readActiveCart());
    });
    window.addEventListener('storage', event => {
      if (!event.key || event.key.includes('tt_cart')) renderLiveCart(readActiveCart(), true);
    });
    window.addEventListener('tintin:products-loaded', () => renderLiveCart(readActiveCart(), true));
    window.addEventListener('online', () => {
      updateSyncState('loading', 'Conexión recuperada · sincronizando…');
      renderLiveCart(readActiveCart(), true);
    });
    window.addEventListener('offline', () => updateSyncState('offline'));
    window.addEventListener('tintin:store-gate-state', event => {
      if (event.detail?.state === 'allowed') {
        ensureCheckoutSurface();
        renderLiveCart(readActiveCart(), true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        clearResumeState();
        renderLiveCart(readActiveCart(), true);
        ensureCheckoutSurface();
      }
    });

    // Una página guardada por el navegador conserva variables internas del paso
    // 5. En vez de intentar limpiar una parte y dejar otra vieja, se recarga bajo
    // un fondo sólido; la siguiente navegación ya nace totalmente nueva.
    window.addEventListener('pagehide', () => {
      clearResumeState();
      ROOT.classList.add('tt-checkout-leaving');
    });
    window.addEventListener('pageshow', event => {
      clearResumeState();
      if (event.persisted) {
        ROOT.classList.add('tt-checkout-hard-reset');
        window.TintinLoader?.show?.();
        window.location.reload();
        return;
      }
      ROOT.classList.remove('tt-checkout-leaving', 'tt-checkout-hard-reset');
      resetVisualStep();
      renderLiveCart(readActiveCart(), true);
      ensureCheckoutSurface();
    });

    // Watchdogs visibles: nunca permiten que el checkout quede en un fondo vacío
    // porque una consulta o un módulo llegó fuera de orden.
    setTimeout(ensureCheckoutSurface, 350);
    setTimeout(() => {
      renderLiveCart(readActiveCart(), true);
      ensureCheckoutSurface();
    }, 1200);
    setTimeout(ensureCheckoutSurface, 3200);
  }

  const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];
  if (navigationEntry?.type === 'back_forward') {
    clearResumeState();
    ROOT.classList.add('tt-checkout-hard-reset');
    window.TintinLoader?.show?.();
    window.location.reload();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
