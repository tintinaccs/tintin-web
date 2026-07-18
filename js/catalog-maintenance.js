/* TINTIN — Runtime integral del Catálogo */
const CATALOG_PATH_RE = /(?:^|\/)catalogo(?:\.html)?\/?$/i;

if (CATALOG_PATH_RE.test(location.pathname || '') && !window.TintinCatalogMaintenanceBooted) {
  window.TintinCatalogMaintenanceBooted = true;

  const body = document.body;
  const grid = document.getElementById('cat-grid');
  const count = document.getElementById('cat-count');
  const search = document.getElementById('cat-search');
  const sort = document.getElementById('cat-sort');
  const minPrice = document.getElementById('precio-min');
  const maxPrice = document.getElementById('precio-max');
  const stock = document.getElementById('filtro-stock');
  const sidebar = document.getElementById('cat-sidebar');
  const filterToggle = document.getElementById('filter-toggle');
  let loadingTimer = 0;
  let recoveryTimer = 0;
  let lastGridSignature = '';

  function appendStylesheet() {
    if (document.querySelector('link[data-tt-catalog-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/catalog-maintenance.css?v=20260718-1', import.meta.url).href;
    link.dataset.ttCatalogMaintenance = '1';
    document.head.appendChild(link);
  }

  function setReady() {
    body?.classList.add('tt-catalog-maintenance', 'tt-catalog-runtime-ready');
    grid?.setAttribute('aria-busy', 'false');
    window.ttPageReady?.();
    requestAnimationFrame(() => window.TintinLoader?.hide?.());
  }

  function ensureSyncNode() {
    let node = document.getElementById('tt-catalog-sync-state');
    if (node) return node;
    const top = document.querySelector('.cat-top');
    if (!top) return null;
    node = document.createElement('div');
    node.id = 'tt-catalog-sync-state';
    node.dataset.state = navigator.onLine === false ? 'offline' : 'loading';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    top.insertAdjacentElement('afterend', node);
    return node;
  }

  function setSync(state, text) {
    const node = ensureSyncNode();
    if (!node) return;
    const labels = {
      loading: 'Actualizando catálogo…',
      synced: 'Catálogo actualizado',
      offline: 'Sin conexión · mostrando datos guardados',
      error: 'No se pudo actualizar · reintentaremos automáticamente',
    };
    node.dataset.state = state;
    node.textContent = text || labels[state] || labels.synced;
  }

  function currentSignature() {
    if (!grid) return '';
    return `${grid.children.length}|${grid.textContent.trim().slice(0, 180)}`;
  }

  function hasRealCards() {
    return !!grid?.querySelector('.tt-card:not([aria-hidden="true"]), [data-product-id], .cat-empty');
  }

  function renderState(state, title, message) {
    if (!grid) return;
    grid.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    grid.innerHTML = `<div class="tt-catalog-runtime-state" data-state="${state}">
      <div><strong>${title}</strong><span>${message}</span>${state === 'error' ? '<button type="button" id="tt-catalog-retry">Reintentar</button>' : ''}</div>
    </div>`;
    document.getElementById('tt-catalog-retry')?.addEventListener('click', () => {
      setSync('loading');
      location.reload();
    });
  }

  function guardCatalogSurface() {
    if (!grid) return;
    const signature = currentSignature();
    if (signature && signature !== lastGridSignature) {
      lastGridSignature = signature;
      if (hasRealCards()) {
        clearTimeout(loadingTimer);
        setSync(navigator.onLine === false ? 'offline' : 'synced');
        setReady();
      }
    }

    if (!grid.children.length) {
      renderState('loading', 'Preparando catálogo', 'Estamos organizando los productos y filtros.');
    }
  }

  function normalizeUrlState() {
    const url = new URL(location.href);
    const params = url.searchParams;
    const query = search?.value.trim() || '';
    const sortValue = sort?.value || 'default';
    const min = minPrice?.value.trim() || '';
    const max = maxPrice?.value.trim() || '';
    const stockOnly = !!stock?.checked;

    if (query) params.set('q', query); else params.delete('q');
    if (sortValue && sortValue !== 'default') params.set('sort', sortValue); else params.delete('sort');
    if (min) params.set('min', min); else params.delete('min');
    if (max) params.set('max', max); else params.delete('max');
    if (stockOnly) params.set('stock', '1'); else params.delete('stock');

    history.replaceState({ tintinCatalog: true }, '', `${url.pathname}${params.size ? `?${params}` : ''}${url.hash}`);
  }

  function restoreControlsFromUrl() {
    const params = new URLSearchParams(location.search);
    if (search && params.has('q')) search.value = params.get('q') || '';
    if (sort && params.has('sort')) sort.value = params.get('sort') || 'default';
    if (minPrice && params.has('min')) minPrice.value = params.get('min') || '';
    if (maxPrice && params.has('max')) maxPrice.value = params.get('max') || '';
    if (stock) stock.checked = params.get('stock') === '1';
  }

  function dispatchControlChange(control, eventName = 'input') {
    control?.dispatchEvent(new Event(eventName, { bubbles: true }));
  }

  function replayUrlState() {
    restoreControlsFromUrl();
    dispatchControlChange(search, 'input');
    dispatchControlChange(sort, 'change');
    dispatchControlChange(stock, 'change');
    document.getElementById('btn-aplicar-precio')?.click();
    guardCatalogSurface();
  }

  function bindControls() {
    let timer = 0;
    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(normalizeUrlState, 180);
    });
    sort?.addEventListener('change', normalizeUrlState);
    stock?.addEventListener('change', normalizeUrlState);
    document.getElementById('btn-aplicar-precio')?.addEventListener('click', normalizeUrlState);
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => setTimeout(normalizeUrlState, 0));

    filterToggle?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        const open = sidebar?.classList.contains('open');
        filterToggle.setAttribute('aria-expanded', String(!!open));
        filterToggle.textContent = open ? 'Cerrar filtros' : 'Filtrar por categoría';
      });
    });

    document.addEventListener('click', event => {
      if (innerWidth > 768 || !sidebar?.classList.contains('open')) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.cat-filter-option, .tt-filtro-btn, #btn-aplicar-precio, #btn-limpiar-filtros')) {
        sidebar.classList.remove('open');
        filterToggle?.setAttribute('aria-expanded', 'false');
        if (filterToggle) filterToggle.textContent = 'Filtrar por categoría';
      }
    });
  }

  function normalizeMetadata() {
    const base = `${location.origin}/`;
    const page = `${base}catalogo.html`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', page);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', page);
    const image = `${base}assets/og-cover.jpg`;
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', image);
  }

  function normalizeFooterYear() {
    const node = document.querySelector('.tt-footer-bottom');
    if (!node) return;
    node.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
  }

  function installObservers() {
    if (grid) {
      new MutationObserver(guardCatalogSurface).observe(grid, { childList: true, subtree: true, characterData: true });
    }
    ['tintin:products-loaded', 'tintin:collections-updated', 'tt_cart_updated', 'tintin:cart-sync-status', 'tintin:color-scheme-applied'].forEach(name => {
      window.addEventListener(name, () => {
        setSync('loading');
        setTimeout(guardCatalogSurface, 0);
      });
    });
    window.addEventListener('online', () => {
      setSync('loading', 'Conexión recuperada · actualizando catálogo…');
      setTimeout(guardCatalogSurface, 250);
    });
    window.addEventListener('offline', () => setSync('offline'));
    window.addEventListener('popstate', replayUrlState);
    window.addEventListener('pageshow', event => {
      if (event.persisted) replayUrlState();
      guardCatalogSurface();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setSync(navigator.onLine === false ? 'offline' : 'loading');
        setTimeout(guardCatalogSurface, 150);
      }
    });
  }

  function boot() {
    appendStylesheet();
    body?.classList.add('tt-catalog-maintenance');
    restoreControlsFromUrl();
    normalizeMetadata();
    normalizeFooterYear();
    ensureSyncNode();
    bindControls();
    installObservers();
    guardCatalogSurface();

    loadingTimer = setTimeout(() => {
      if (!hasRealCards()) {
        if (navigator.onLine === false) {
          renderState('offline', 'Sin conexión', 'No pudimos descargar productos nuevos. Revisá tu conexión y volvé a intentar.');
          setSync('offline');
        } else {
          renderState('error', 'El catálogo tardó demasiado', 'Podés reintentar sin perder los filtros elegidos.');
          setSync('error');
        }
        setReady();
      }
    }, 6500);

    recoveryTimer = setInterval(guardCatalogSurface, 1200);
    window.addEventListener('pagehide', () => clearInterval(recoveryTimer), { once: true });
    setTimeout(setReady, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
