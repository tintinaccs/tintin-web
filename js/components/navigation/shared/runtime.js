import { currentPage } from './route-state.js';
import { versionedJsModule, versionedSiteAsset } from './config.js';

let productsRuntimePromise = null;

function reportRuntimeFailures(results) {
  const failed = results.filter(result => result.status === 'rejected');
  if (!failed.length) return;
  console.warn('[PublicShell] Algunos datos en vivo no pudieron cargarse.', failed.map(item => item.reason));
}

function scheduleNonCritical(task) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 1400 });
    return;
  }
  window.setTimeout(task, 450);
}

function loadHomeMaintenance() {
  if (currentPage() !== 'home') return Promise.resolve();

  if (!document.getElementById('tt-home-maintenance-css')) {
    const link = document.createElement('link');
    link.id = 'tt-home-maintenance-css';
    link.rel = 'stylesheet';
    link.href = versionedSiteAsset('css/home-maintenance.css');
    document.head.appendChild(link);
  }

  return import(versionedJsModule('home-maintenance.js'));
}

export function loadProductsRuntime({ forSearch = false } = {}) {
  if (!productsRuntimePromise) {
    productsRuntimePromise = import(versionedJsModule('products-store.js')).catch(error => {
      productsRuntimePromise = null;
      document.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
      throw error;
    });
  }

  return productsRuntimePromise.then(module => {
    if (!forSearch) return module;
    const ensureSearch = window.TintinProductsStore?.ensureSearch || module.ensureProductsForSearch;
    return typeof ensureSearch === 'function' ? ensureSearch() : module;
  });
}

function attachProductsDemand() {
  let started = false;

  const load = () => {
    if (started) return;
    started = true;
    loadProductsRuntime({ forSearch: true }).then(() => {
      const input = document.getElementById('search-input');
      if (input?.value) input.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(error => {
      started = false;
      console.warn('[PublicShell] No se pudo cargar el catálogo para la búsqueda.', error);
    });
  };

  document.querySelectorAll('[data-nav-action="search"],#tabbar-search').forEach(control => {
    control.addEventListener('pointerenter', load, { once: true, passive: true });
    control.addEventListener('focus', load, { once: true });
    control.addEventListener('click', load, { once: true });
  });
}

export function loadSharedRuntime() {
  const page = currentPage();
  const critical = [
    import(versionedJsModule('auth-nav.js')),
    import(versionedJsModule('cart-sync.js')),
  ];

  if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
  if (page === 'cart') critical.push(import(versionedJsModule('checkout-reliability.js')));

  Promise.allSettled(critical).then(reportRuntimeFailures);
  attachProductsDemand();

  Promise.allSettled([
    import(versionedJsModule('navigation-desktop.js')),
    import(versionedJsModule('navigation-tablet.js')),
    import(versionedJsModule('navigation-mobile.js')),
    import(versionedJsModule('navigation-shared.js')),
  ]).then(reportRuntimeFailures);

  scheduleNonCritical(() => {
    Promise.allSettled([
      import(versionedJsModule('nav-collections.js')),
      loadHomeMaintenance(),
    ]).then(reportRuntimeFailures);
  });
}
