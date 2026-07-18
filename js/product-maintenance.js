/* TINTIN — Runtime integral de product.html */
const PRODUCT_PATH_RE = /(?:^|\/)product(?:\.html)?\/?$/i;

if (PRODUCT_PATH_RE.test(location.pathname || '') && !window.TintinProductMaintenanceBooted) {
  window.TintinProductMaintenanceBooted = true;

  const body = document.body;
  const loading = document.getElementById('product-loading');
  const notFound = document.getElementById('product-not-found');
  const loadError = document.getElementById('product-load-error');
  const detailGrid = document.getElementById('product-grid');
  const relatedGrid = document.getElementById('related-grid');
  const selectionRoot = document.getElementById('tinsel-root');
  const productStatus = document.getElementById('product-status');
  let productResolved = false;
  let relatedResolved = false;
  let selectionResolved = false;
  let watchdog = 0;

  function appendStylesheet() {
    if (document.querySelector('link[data-tt-product-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/product-maintenance.css?v=20260718-1', import.meta.url).href;
    link.dataset.ttProductMaintenance = '1';
    document.head.appendChild(link);
  }

  function ensureSyncNode() {
    let node = document.getElementById('tt-product-sync-state');
    if (node) return node;
    const page = document.querySelector('.tt-product-page');
    if (!page) return null;
    node = document.createElement('div');
    node.id = 'tt-product-sync-state';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.dataset.state = navigator.onLine === false ? 'offline' : 'loading';
    page.insertAdjacentElement('beforebegin', node);
    return node;
  }

  function setSync(state, message) {
    const node = ensureSyncNode();
    if (!node) return;
    const labels = {
      loading: 'Actualizando producto…',
      synced: 'Producto actualizado',
      offline: 'Sin conexión · mostrando información disponible',
      error: 'No se pudo actualizar todo el contenido',
    };
    node.dataset.state = state;
    node.textContent = message || labels[state] || labels.synced;
  }

  function isVisible(node) {
    if (!node) return false;
    return !node.hidden && node.style.display !== 'none' && getComputedStyle(node).display !== 'none';
  }

  function inspectProduct() {
    productResolved = isVisible(detailGrid) || isVisible(notFound) || isVisible(loadError);
    if (productResolved) {
      loading?.setAttribute('aria-hidden', 'true');
      detailGrid?.setAttribute('aria-busy', 'false');
    }

    if (productStatus) {
      const out = /sin stock/i.test(productStatus.textContent || '');
      productStatus.dataset.stockState = out ? 'out' : 'available';
      productStatus.style.removeProperty('background');
      productStatus.style.removeProperty('color');
      productStatus.style.removeProperty('--dot-color');
    }
  }

  function inspectRelated() {
    if (!relatedGrid) {
      relatedResolved = true;
      return;
    }
    relatedResolved = !!relatedGrid.querySelector(':scope > *') && relatedGrid.getAttribute('aria-busy') !== 'true';
    if (!relatedResolved && !relatedGrid.children.length) {
      relatedGrid.innerHTML = '<div class="tt-product-runtime-state"><div><strong>Preparando recomendaciones</strong><span>Estamos buscando otros productos disponibles.</span></div></div>';
    }
  }

  function inspectSelection() {
    if (!selectionRoot) {
      selectionResolved = true;
      return;
    }
    const skeleton = document.getElementById('tinsel-skeleton');
    const items = document.getElementById('tinsel-items');
    selectionResolved = !isVisible(skeleton) || isVisible(items);
  }

  function releasePage() {
    body?.classList.add('tt-product-runtime-ready');
    window.ttPageReady?.();
    requestAnimationFrame(() => window.TintinLoader?.hide?.());
  }

  function inspectAll() {
    inspectProduct();
    inspectRelated();
    inspectSelection();
    if (productResolved) {
      setSync(navigator.onLine === false ? 'offline' : 'synced');
      releasePage();
    }
  }

  function normalizeGenericMetadata() {
    const base = `${location.origin}/`;
    const current = new URL('product.html', base);
    const id = new URLSearchParams(location.search).get('id');
    if (id) current.searchParams.set('id', id);
    document.getElementById('link-canonical')?.setAttribute('href', current.href);
    document.getElementById('meta-og-url')?.setAttribute('content', current.href);
    const fallback = `${base}assets/og-cover.jpg`;
    const ogImage = document.getElementById('meta-og-image');
    const twImage = document.getElementById('meta-twitter-image');
    if (ogImage && /github\.io/.test(ogImage.content || '')) ogImage.content = fallback;
    if (twImage && /github\.io/.test(twImage.content || '')) twImage.content = fallback;
  }

  function normalizeFooterYear() {
    const node = document.querySelector('.tt-footer-bottom');
    if (node) node.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
  }

  function installObservers() {
    [loading, notFound, loadError, detailGrid, relatedGrid, selectionRoot, productStatus].filter(Boolean).forEach(node => {
      new MutationObserver(inspectAll).observe(node, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ['style', 'hidden', 'class', 'aria-busy'],
      });
    });

    ['tintin:products-loaded', 'tintin:product-unavailable', 'tt_cart_updated', 'tintin:cart-sync-status', 'tintin:color-scheme-applied'].forEach(name => {
      window.addEventListener(name, () => {
        setSync('loading');
        setTimeout(inspectAll, 0);
      });
    });

    window.addEventListener('tintin:products-error', () => {
      setSync('error');
      setTimeout(inspectAll, 0);
    });

    window.addEventListener('online', () => {
      setSync('loading', 'Conexión recuperada · actualizando producto…');
      setTimeout(inspectAll, 250);
    });
    window.addEventListener('offline', () => setSync('offline'));
    window.addEventListener('pageshow', inspectAll);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setSync(navigator.onLine === false ? 'offline' : 'loading');
        setTimeout(inspectAll, 120);
      }
    });
  }

  function boot() {
    appendStylesheet();
    body?.classList.add('tt-product-maintenance');
    normalizeGenericMetadata();
    normalizeFooterYear();
    ensureSyncNode();
    installObservers();
    inspectAll();

    setTimeout(() => {
      inspectProduct();
      if (!productResolved) {
        setSync(navigator.onLine === false ? 'offline' : 'error');
      }
      releasePage();
    }, 1200);

    setTimeout(() => {
      inspectRelated();
      if (!relatedResolved && relatedGrid) {
        relatedGrid.setAttribute('aria-busy', 'false');
        relatedGrid.innerHTML = '<div class="tt-product-runtime-state"><div><strong>No pudimos cargar las recomendaciones</strong><span>La ficha del producto sigue disponible. Podés abrir el catálogo completo.</span></div></div>';
        relatedResolved = true;
      }
    }, 8500);

    setTimeout(() => {
      inspectSelection();
      if (!selectionResolved) {
        document.getElementById('tinsel-skeleton')?.setAttribute('hidden', '');
        selectionResolved = true;
      }
    }, 5000);

    watchdog = setInterval(inspectAll, 1300);
    window.addEventListener('pagehide', () => clearInterval(watchdog), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
