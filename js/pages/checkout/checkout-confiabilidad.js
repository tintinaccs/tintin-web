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


const CHECKOUT_PATH_RE = /(?:^|\/)checkout(?:\.html)?\/?$/i;
if (!CHECKOUT_PATH_RE.test(window.location.pathname || '') || window.TintinCheckoutReliabilityBooted) {
  // Este módulo se importa desde el shell compartido, pero no hace nada fuera
  // del checkout.
} else {
  window.TintinCheckoutReliabilityBooted = true;

  const RESUME_KEY = 'tt_checkout_resume_step';
  const ROOT = document.documentElement;
  let syncHideTimer = 0;

  function clearResumeState() {
    try { sessionStorage.removeItem(RESUME_KEY); } catch {}
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

  // La fiabilidad recupera la superficie, pero no posee un segundo renderer.
  // Mientras el runtime canónico restaura identidad se conserva su loading.
  function renderLiveCart() {
    return window.TintinCheckoutCartRenderer?.();
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
    // La hoja de estilo forma parte del HTML inicial.
    clearResumeState();
    resetVisualStep();
    ensureSyncStateNode();

    // El runtime canónico decide cuándo la identidad permite pintar el carrito.
    // La recuperación visual no lee ni sustituye su fuente de datos.
    renderLiveCart();
    ensureCheckoutSurface();

    window.addEventListener('tt_cart_updated', event => {
      updateSyncState(event.detail?.status || 'synced');
      ensureCheckoutSurface();
    });
    window.addEventListener('tintin:cart-sync-status', event => {
      updateSyncState(event.detail?.status || 'synced');
      renderLiveCart();
    });
    window.addEventListener('storage', event => {
      if (!event.key || event.key.includes('tt_cart')) renderLiveCart();
    });
    window.addEventListener('online', () => {
      updateSyncState('loading', 'Conexión recuperada · sincronizando…');
      renderLiveCart();
    });
    window.addEventListener('offline', () => updateSyncState('offline'));
    window.addEventListener('tintin:store-gate-state', event => {
      if (event.detail?.state === 'allowed') {
        ensureCheckoutSurface();
        renderLiveCart();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        clearResumeState();
        renderLiveCart();
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
      renderLiveCart();
      ensureCheckoutSurface();
    });

    // Watchdogs visibles: nunca permiten que el checkout quede en un fondo vacío
    // porque una consulta o un módulo llegó fuera de orden.
    setTimeout(ensureCheckoutSurface, 350);
    setTimeout(() => {
      renderLiveCart();
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
