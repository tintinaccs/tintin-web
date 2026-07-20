/* TINTIN — Runtime integral de product.html */
const PRODUCT_PATH_RE = /(?:^|\/)product(?:\.html)?\/?$/i;

function isProductPage() {
  let pathname = location.pathname || '';
  try { pathname = decodeURIComponent(pathname); } catch {}
  return PRODUCT_PATH_RE.test(pathname) || Boolean(document.getElementById('product-detail'));
}

if (isProductPage() && !window.TintinProductMaintenanceBooted) {
  window.TintinProductMaintenanceBooted = true;
  window.TintinProductPageRecognized = true;

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
  let inspectQueued = false;
  let pageReleased = false;
  let watchdog = 0;

  function setAttributeIfChanged(node, name, value) {
    if (!node || node.getAttribute(name) === value) return false;
    node.setAttribute(name, value);
    return true;
  }

  function setDatasetIfChanged(node, name, value) {
    if (!node || node.dataset[name] === value) return false;
    node.dataset[name] = value;
    return true;
  }

  function removeStylePropertyIfPresent(node, name) {
    if (!node?.style?.getPropertyValue(name)) return false;
    node.style.removeProperty(name);
    return true;
  }

  function setTextIfChanged(node, value) {
    if (!node || node.textContent === value) return false;
    node.textContent = value;
    return true;
  }

  function appendStylesheet() {
    if (document.querySelector('link[data-tt-product-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/product-maintenance.css?v=20260720-2', import.meta.url).href;
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
    setDatasetIfChanged(node, 'state', state);
    setTextIfChanged(node, message || labels[state] || labels.synced);
  }

  function isVisible(node) {
    if (!node) return false;
    return !node.hidden && node.style.display !== 'none' && getComputedStyle(node).display !== 'none';
  }

  function inspectProduct() {
    productResolved = isVisible(detailGrid) || isVisible(notFound) || isVisible(loadError);
    if (productResolved) {
      setAttributeIfChanged(loading, 'aria-hidden', 'true');
      setAttributeIfChanged(detailGrid, 'aria-busy', 'false');
    }

    if (productStatus) {
      const out = /sin stock/i.test(productStatus.textContent || '');
      setDatasetIfChanged(productStatus, 'stockState', out ? 'out' : 'available');
      removeStylePropertyIfPresent(productStatus, 'background');
      removeStylePropertyIfPresent(productStatus, 'color');
      removeStylePropertyIfPresent(productStatus, '--dot-color');
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
    if (pageReleased) return;
    pageReleased = true;
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

  function queueInspect() {
    if (inspectQueued) return;
    inspectQueued = true;
    const run = () => {
      inspectQueued = false;
      inspectAll();
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(run);
    else Promise.resolve().then(run);
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
    const observer = new MutationObserver(queueInspect);
    const commonConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['style', 'hidden', 'class'],
    };

    [loading, notFound, loadError, detailGrid, selectionRoot, productStatus]
      .filter(Boolean)
      .forEach(node => observer.observe(node, commonConfig));

    if (relatedGrid) {
      observer.observe(relatedGrid, {
        ...commonConfig,
        attributeFilter: ['style', 'hidden', 'class', 'aria-busy'],
      });
    }

    ['tintin:products-loaded', 'tintin:product-unavailable', 'tt_cart_updated', 'tintin:cart-sync-status', 'tintin:color-scheme-applied'].forEach(name => {
      window.addEventListener(name, () => {
        setSync('loading');
        queueInspect();
      });
    });

    window.addEventListener('tintin:products-error', () => {
      setSync('error');
      queueInspect();
    });

    window.addEventListener('online', () => {
      setSync('loading', 'Conexión recuperada · actualizando producto…');
      setTimeout(queueInspect, 250);
    });
    window.addEventListener('offline', () => setSync('offline'));
    window.addEventListener('pageshow', queueInspect);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setSync(navigator.onLine === false ? 'offline' : 'loading');
        setTimeout(queueInspect, 120);
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
        setAttributeIfChanged(relatedGrid, 'aria-busy', 'false');
        relatedGrid.innerHTML = '<div class="tt-product-runtime-state"><div><strong>No pudimos cargar las recomendaciones</strong><span>La ficha del producto sigue disponible. Podés abrir el catálogo completo.</span></div></div>';
        relatedResolved = true;
      }
    }, 8500);

    setTimeout(() => {
      inspectSelection();
      if (!selectionResolved) {
        setAttributeIfChanged(document.getElementById('tinsel-skeleton'), 'hidden', '');
        selectionResolved = true;
      }
    }, 5000);

    watchdog = setInterval(queueInspect, 1300);
    window.addEventListener('pagehide', () => clearInterval(watchdog), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
