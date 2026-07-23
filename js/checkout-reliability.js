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

import { apiUrl } from './function-origin.js?v=tintin-20260723-geo-proxy-1';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout(?:\.html)?\/?$/i;
if (!CHECKOUT_PATH_RE.test(window.location.pathname || '') || window.TintinCheckoutReliabilityBooted) {
  // Este módulo se importa desde el shell compartido, pero no hace nada fuera
  // del checkout.
} else {
  window.TintinCheckoutReliabilityBooted = true;

  const RESUME_KEY = 'tt_checkout_resume_step';
  const ROOT = document.documentElement;
  let lastCartFingerprint = '';
  let checkoutMap = null;
  let mapSearchTimer = 0;
  let mapSearchGeneration = 0;
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
      .tt-map-smart-tools {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:9px;
        margin:10px 0 8px;
      }
      .tt-map-smart-button {
        min-height:44px;
        border:1.5px solid #F1C8D5;
        border-radius:999px;
        background:#FFFFFF;
        color:#8B2642;
        font:800 12px/1.2 Montserrat;
        padding:10px 14px;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        text-decoration:none;
        text-align:center;
      }
      .tt-map-smart-button:hover,
      .tt-map-smart-button:focus-visible { border-color:#AD3F67;box-shadow:0 0 0 3px rgba(173,63,103,.10);outline:0; }
      .tt-map-smart-help {
        margin:0 2px 8px;
        color:#755F67;
        font:600 11px/1.55 Montserrat;
      }
      #tt-map-smart-results {
        display:none;
        position:relative;
        z-index:500;
        margin:4px 0 10px;
        max-height:280px;
        overflow:auto;
        background:#FFFFFF;
        border:1.5px solid #F1C8D5;
        border-radius:16px;
        box-shadow:0 14px 34px rgba(82,27,49,.15);
      }
      #tt-map-smart-results.show { display:block; }
      .tt-map-smart-result {
        width:100%;
        border:0;
        border-bottom:1px solid #F8E6EC;
        background:#FFFFFF;
        color:#2B2B2B;
        padding:12px 14px;
        text-align:left;
        cursor:pointer;
        font-family:Montserrat;
      }
      .tt-map-smart-result:last-child { border-bottom:0; }
      .tt-map-smart-result:hover,
      .tt-map-smart-result:focus-visible { background:#FFF6FA;outline:0; }
      .tt-map-smart-result-name { font-size:12px;font-weight:800;line-height:1.35; }
      .tt-map-smart-result-address { margin-top:3px;font-size:10px;line-height:1.45;color:#7B6F72; }
      .tt-map-smart-empty { padding:14px;color:#755F67;font:600 11px/1.5 Montserrat;text-align:center; }
      @media(max-width:600px) {
        .tt-map-smart-tools { grid-template-columns:1fr;gap:8px; }
        .tt-map-smart-button { width:100%; }
        #tt-map-smart-results { max-height:240px; }
      }
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
          <div class="ck-empty-icon">🛒</div>
          <div class="ck-empty-text">Tu carrito está vacío</div>
          <p style="color:#8B5B6B;font-size:13px;margin:6px 0 16px">Agregá un producto para comenzar una compra nueva.</p>
          <a href="catalogo.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 24px;text-decoration:none;border-radius:999px;background:#AD3F67;color:#fff!important;font-weight:800">Ver catálogo →</a>
        </div>`;
      subtotalNode.textContent = 'Gs. 0';
      return;
    }

    container.innerHTML = items.map(item => {
      const id = escapeHtml(item.id);
      const name = escapeHtml(item.name);
      const cat = escapeHtml(item.cat);
      const image = item.imageUrl
        ? `<img class="ck-item-img" src="${escapeHtml(item.imageUrl)}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ck-item-img-placeholder" style="display:none">🛍️</div>`
        : '<div class="ck-item-img-placeholder">🛍️</div>';
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

  function hookLeafletLibrary(leaflet) {
    if (!leaflet?.map || leaflet.map.__ttCheckoutCapture) return;
    const originalMap = leaflet.map;
    const wrappedMap = function (...args) {
      const instance = originalMap.apply(this, args);
      const target = args[0];
      const targetId = typeof target === 'string' ? target : target?.id;
      if (targetId === 'ck-map') checkoutMap = instance;
      return instance;
    };
    Object.assign(wrappedMap, originalMap);
    wrappedMap.__ttCheckoutCapture = true;
    wrappedMap.__ttOriginal = originalMap;
    leaflet.map = wrappedMap;
  }

  function installLeafletCapture() {
    if (window.L) {
      hookLeafletLibrary(window.L);
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window, 'L');
    if (descriptor && descriptor.configurable === false) return;
    let storedLeaflet = descriptor?.get ? descriptor.get.call(window) : descriptor?.value;
    Object.defineProperty(window, 'L', {
      configurable: true,
      enumerable: true,
      get() { return storedLeaflet; },
      set(value) {
        storedLeaflet = value;
        hookLeafletLibrary(value);
      },
    });
  }

  function waitForCheckoutMap(timeoutMs = 4500) {
    if (checkoutMap) return Promise.resolve(checkoutMap);
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (checkoutMap || Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve(checkoutMap);
        }
      }, 60);
    });
  }

  function parseGoogleMapsInput(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return null;
    const coordinatePatterns = [
      /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
      /(?:query|q|ll)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i,
      /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
    ];
    for (const pattern of coordinatePatterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng, label: 'Ubicación de Google Maps', address: raw };
      }
    }
    try {
      const url = new URL(raw);
      const placeMatch = decodeURIComponent(url.pathname).match(/\/place\/([^/]+)/i);
      const query = url.searchParams.get('query') || url.searchParams.get('q') || (placeMatch ? placeMatch[1].replace(/\+/g, ' ') : '');
      if (query && !/^-?\d+(?:\.\d+)?\s*,/.test(query)) return { query };
      if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url.hostname + url.pathname)) return { shortGoogleUrl: true };
    } catch {}
    return null;
  }

  async function searchPlaces(query) {
    try {
      const response = await fetch(`${apiUrl('geo-search')}?q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data?.places) ? data.places : [];
    } catch (error) {
      console.warn('[Checkout] No se pudo buscar direcciones:', error?.code || error);
      return [];
    }
  }

  async function applyMapPlace(place) {
    const map = await waitForCheckoutMap();
    const results = document.getElementById('tt-map-smart-results');
    if (!map || !window.L) {
      if (results) {
        results.innerHTML = '<div class="tt-map-smart-empty">El mapa todavía se está preparando. Esperá un instante y volvé a tocar la ubicación.</div>';
        results.classList.add('show');
      }
      return;
    }
    const latlng = window.L.latLng(place.lat, place.lng);
    map.setView(latlng, 17, { animate: false });
    map.fire('click', { latlng, originalEvent: null });

    const searchInput = document.getElementById('ck-map-search');
    const nameInput = document.getElementById('ck-location-name');
    const addressInput = document.getElementById('ck-address');
    if (searchInput) searchInput.value = place.name || place.address || '';
    if (nameInput && (!nameInput.value.trim() || nameInput.dataset.ttAutoFilled === '1')) {
      nameInput.value = place.name || 'Mi ubicación';
      nameInput.dataset.ttAutoFilled = '1';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (addressInput && !addressInput.value.trim() && place.address) {
      addressInput.value = place.address;
      addressInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    results?.classList.remove('show');
    document.getElementById('ck-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderSmartResults(places, message = '') {
    const results = document.getElementById('tt-map-smart-results');
    if (!results) return;
    if (message) {
      results.innerHTML = `<div class="tt-map-smart-empty">${escapeHtml(message)}</div>`;
      results.classList.add('show');
      return;
    }
    if (!places.length) {
      results.innerHTML = '<div class="tt-map-smart-empty">No encontramos ese nombre. Podés mover el mapa y tocar el punto exacto; después escribí el nombre que quieras en “Nombre de esta ubicación”.</div>';
      results.classList.add('show');
      return;
    }
    results.innerHTML = places.map((place, index) => `
      <button type="button" class="tt-map-smart-result" data-smart-place="${index}">
        <div class="tt-map-smart-result-name">📍 ${escapeHtml(place.name)}</div>
        <div class="tt-map-smart-result-address">${escapeHtml(place.address)} · ${escapeHtml(place.source || '')}</div>
      </button>`).join('');
    results.classList.add('show');
    results.querySelectorAll('[data-smart-place]').forEach(button => {
      button.addEventListener('click', () => applyMapPlace(places[Number(button.dataset.smartPlace)]));
    });
  }

  async function runSmartSearch(rawValue) {
    const generation = ++mapSearchGeneration;
    const raw = String(rawValue || '').trim();
    const existingResults = document.getElementById('ck-map-search-results');
    existingResults?.classList.remove('show');
    if (raw.length < 3) {
      document.getElementById('tt-map-smart-results')?.classList.remove('show');
      return;
    }

    const parsed = parseGoogleMapsInput(raw);
    if (parsed?.lat != null) {
      await applyMapPlace(parsed);
      return;
    }
    if (parsed?.shortGoogleUrl) {
      renderSmartResults([], 'Ese es un enlace corto de Google Maps. Abrilo y copiá el enlace completo que contiene las coordenadas, o buscá el nombre directamente acá.');
      return;
    }

    const query = parsed?.query || raw;
    renderSmartResults([], 'Buscando lugares, negocios, calles y puntos de referencia…');
    try {
      const places = await searchPlaces(query);
      if (generation !== mapSearchGeneration) return;
      renderSmartResults(places);
    } catch (error) {
      console.warn('[checkout-map] No se pudo completar la búsqueda ampliada:', error);
      if (generation === mapSearchGeneration) {
        renderSmartResults([], 'No pudimos consultar el buscador ahora. Igual podés tocar directamente el punto exacto en el mapa.');
      }
    }
  }

  function enhanceMapSearch() {
    const searchWrap = document.querySelector('.ck-map-search-wrap');
    const input = document.getElementById('ck-map-search');
    if (!searchWrap || !input || document.getElementById('tt-map-smart-tools')) return;

    input.placeholder = 'Buscar negocio, local, calle, barrio, referencia o pegar enlace de Google Maps…';
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'tt-map-smart-results');

    const tools = document.createElement('div');
    tools.id = 'tt-map-smart-tools';
    tools.className = 'tt-map-smart-tools';
    tools.innerHTML = `
      <button type="button" class="tt-map-smart-button" id="tt-use-current-location">📍 Usar mi ubicación actual</button>
      <a class="tt-map-smart-button" id="tt-open-google-maps" href="https://www.google.com/maps/search/?api=1&query=Paraguay" target="_blank" rel="noopener">🗺️ Buscar en Google Maps</a>`;

    const help = document.createElement('div');
    help.className = 'tt-map-smart-help';
    help.textContent = 'Podés buscar por nombre —por ejemplo un negocio o local—, pegar coordenadas o un enlace completo de Google Maps. También podés tocar cualquier punto del mapa y escribir el nombre que prefieras.';

    const results = document.createElement('div');
    results.id = 'tt-map-smart-results';
    results.setAttribute('role', 'listbox');

    searchWrap.insertAdjacentElement('afterend', results);
    results.insertAdjacentElement('beforebegin', help);
    help.insertAdjacentElement('beforebegin', tools);

    input.addEventListener('input', event => {
      event.stopImmediatePropagation();
      clearTimeout(mapSearchTimer);
      const value = input.value;
      const googleLink = document.getElementById('tt-open-google-maps');
      if (googleLink) googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value || 'Paraguay')}`;
      mapSearchTimer = setTimeout(() => runSmartSearch(value), 320);
    }, { capture: true });

    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') results.classList.remove('show');
    });

    document.addEventListener('click', event => {
      if (event.target !== input && !results.contains(event.target) && !tools.contains(event.target)) results.classList.remove('show');
    });

    document.getElementById('tt-use-current-location')?.addEventListener('click', () => {
      const button = document.getElementById('tt-use-current-location');
      if (!navigator.geolocation) {
        renderSmartResults([], 'Este navegador no permite obtener la ubicación actual. Podés buscarla o marcarla manualmente en el mapa.');
        return;
      }
      if (button) { button.disabled = true; button.textContent = '📍 Obteniendo ubicación…'; }
      navigator.geolocation.getCurrentPosition(
        position => {
          if (button) { button.disabled = false; button.textContent = '📍 Usar mi ubicación actual'; }
          applyMapPlace({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Mi ubicación actual',
            address: 'Ubicación obtenida desde este dispositivo',
          });
        },
        () => {
          if (button) { button.disabled = false; button.textContent = '📍 Usar mi ubicación actual'; }
          renderSmartResults([], 'No pudimos obtener tu ubicación. Revisá el permiso del navegador o marcá el punto manualmente.');
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
      );
    });
  }

  function boot() {
    injectStyles();
    clearResumeState();
    resetVisualStep();
    installLeafletCapture();
    enhanceMapSearch();
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
