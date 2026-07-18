/* TINTIN — Runtime de mantenimiento para collections.html */
const COLLECTIONS_PATH_RE = /(?:^|\/)collections(?:\.html)?\/?$/i;

if (COLLECTIONS_PATH_RE.test(location.pathname || '') && !window.TintinCollectionsMaintenanceBooted) {
  window.TintinCollectionsMaintenanceBooted = true;

  const body = document.body;
  const collectionsGrid = document.getElementById('colls-page-grid');
  const featuredGrid = document.getElementById('collections-featured-grid');
  const collectionsStatus = document.getElementById('collections-grid-status');
  const featuredStatus = document.getElementById('collections-featured-status');
  let collectionsResolved = false;
  let featuredResolved = false;
  let watchdog = 0;

  function hasRealCollections() {
    return !!collectionsGrid?.querySelector('.tt-coll-page-card:not([aria-hidden="true"]), .tt-collections-state');
  }

  function hasRealFeatured() {
    return !!featuredGrid?.querySelector('.tt-product-card:not(.tt-skeleton-card), .tt-collections-state');
  }

  function ensureSyncNode() {
    let node = document.getElementById('tt-collections-sync-state');
    if (node) return node;
    const section = document.querySelector('.tt-colls-page-section');
    if (!section) return null;
    node = document.createElement('div');
    node.id = 'tt-collections-sync-state';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.dataset.state = navigator.onLine === false ? 'offline' : 'loading';
    section.insertAdjacentElement('beforebegin', node);
    return node;
  }

  function setSync(state, message) {
    const node = ensureSyncNode();
    if (!node) return;
    const labels = {
      loading: 'Actualizando colecciones…',
      synced: 'Colecciones actualizadas',
      offline: 'Sin conexión · mostrando contenido disponible',
      error: 'No se pudo actualizar todo el contenido',
    };
    node.dataset.state = state;
    node.textContent = message || labels[state] || labels.synced;
  }

  function renderRuntimeState(grid, state, title, message) {
    if (!grid) return;
    grid.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    grid.innerHTML = `<div class="tt-collections-runtime-state" data-state="${state}">
      <div><strong>${title}</strong><span>${message}</span>${state === 'error' ? '<button type="button" class="tt-btn" data-collections-retry>Reintentar</button>' : ''}</div>
    </div>`;
    grid.querySelector('[data-collections-retry]')?.addEventListener('click', () => location.reload());
  }

  function normalizeMetadata() {
    const base = `${location.origin}/`;
    const page = `${base}collections.html`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', page);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', page);
    const image = `${base}assets/og-cover.jpg`;
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', image);
  }

  function normalizeFooterYear() {
    const node = document.querySelector('.tt-footer-bottom');
    if (node) node.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
  }

  function releasePage() {
    body?.classList.add('tt-collections-runtime-ready');
    window.ttPageReady?.();
    requestAnimationFrame(() => window.TintinLoader?.hide?.());
  }

  function inspectCollections() {
    if (!collectionsGrid) {
      collectionsResolved = true;
      return;
    }
    if (hasRealCollections()) {
      collectionsResolved = true;
      collectionsGrid.setAttribute('aria-busy', 'false');
      return;
    }
    if (!collectionsGrid.children.length) {
      renderRuntimeState(collectionsGrid, 'loading', 'Preparando colecciones', 'Estamos organizando las colecciones disponibles.');
    }
  }

  function inspectFeatured() {
    if (!featuredGrid) {
      featuredResolved = true;
      return;
    }
    if (hasRealFeatured()) {
      featuredResolved = true;
      featuredGrid.setAttribute('aria-busy', 'false');
      return;
    }
    if (!featuredGrid.children.length) {
      renderRuntimeState(featuredGrid, 'loading', 'Preparando productos destacados', 'Estamos seleccionando productos disponibles.');
    }
  }

  function inspectAll() {
    inspectCollections();
    inspectFeatured();
    if (collectionsResolved && featuredResolved) {
      setSync(navigator.onLine === false ? 'offline' : 'synced');
      releasePage();
    }
  }

  function installObservers() {
    if (collectionsGrid) {
      new MutationObserver(inspectAll).observe(collectionsGrid, { childList: true, subtree: true, characterData: true });
    }
    if (featuredGrid) {
      new MutationObserver(inspectAll).observe(featuredGrid, { childList: true, subtree: true, characterData: true });
    }

    ['tintin:collections-phase4-ready', 'tintin:products-loaded', 'tintin:color-scheme-applied', 'tt_cart_updated'].forEach(name => {
      window.addEventListener(name, () => {
        setSync('loading');
        setTimeout(inspectAll, 0);
      });
    });

    window.addEventListener('tintin:products-error', () => {
      if (!featuredResolved && featuredGrid) {
        renderRuntimeState(featuredGrid, 'error', 'No se pudieron cargar los productos', 'Podés seguir explorando colecciones o reintentar.');
        featuredResolved = true;
      }
      setSync('error');
      inspectAll();
    });

    window.addEventListener('online', () => {
      setSync('loading', 'Conexión recuperada · actualizando…');
      collectionsResolved = hasRealCollections();
      featuredResolved = hasRealFeatured();
      setTimeout(inspectAll, 250);
    });

    window.addEventListener('offline', () => setSync('offline'));
    window.addEventListener('pageshow', () => inspectAll());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setSync(navigator.onLine === false ? 'offline' : 'loading');
        setTimeout(inspectAll, 100);
      }
    });
  }

  function boot() {
    body?.classList.add('tt-collections-page');
    normalizeMetadata();
    normalizeFooterYear();
    ensureSyncNode();
    installObservers();
    inspectAll();

    setTimeout(() => {
      if (!collectionsResolved && collectionsGrid) {
        if (navigator.onLine === false) {
          renderRuntimeState(collectionsGrid, 'offline', 'Sin conexión', 'No pudimos actualizar las colecciones. Revisá tu conexión.');
        } else {
          renderRuntimeState(collectionsGrid, 'error', 'Las colecciones tardaron demasiado', 'Podés reintentar sin perder tu navegación.');
        }
        collectionsResolved = true;
      }
      inspectAll();
    }, 7000);

    setTimeout(() => {
      if (!featuredResolved && featuredGrid) {
        if (navigator.onLine === false) {
          renderRuntimeState(featuredGrid, 'offline', 'Sin conexión', 'No pudimos actualizar los productos destacados.');
        } else {
          renderRuntimeState(featuredGrid, 'error', 'Los destacados tardaron demasiado', 'Podés reintentar o abrir el catálogo completo.');
        }
        featuredResolved = true;
      }
      inspectAll();
    }, 8000);

    watchdog = setInterval(inspectAll, 1400);
    window.addEventListener('pagehide', () => clearInterval(watchdog), { once: true });
    setTimeout(releasePage, 1100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
