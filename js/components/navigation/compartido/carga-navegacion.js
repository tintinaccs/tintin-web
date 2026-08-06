import { currentPage } from './estado-ruta.js';
import { versionedJsModule, versionedSiteAsset } from './configuracion.js';

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
    link.href = versionedSiteAsset('css/pages/home/home-maintenance.css');
    document.head.appendChild(link);
  }

  return import(versionedJsModule('pages/home/mantenimiento-inicio.js'));
}

export function loadProductsRuntime({ forSearch = false } = {}) {
  if (!productsRuntimePromise) {
    productsRuntimePromise = import(versionedJsModule('core/store/estado-productos.js')).catch(error => {
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

function loadNavigationBehaviors() {
  const controllerReady = window.TintinSurfaceControllerReady || Promise.resolve(window.TintinSurfaceController);
  return Promise.resolve(controllerReady)
    .catch(error => {
      console.warn('[PublicShell] El controlador de superficies no inició.', error);
      return null;
    })
    .then(() => Promise.allSettled([
      import(versionedJsModule('components/navigation/escritorio/indicador-navegacion-escritorio.js')),
      import(versionedJsModule('components/navigation/tableta/control-menu-tableta.js')),
      import(versionedJsModule('components/navigation/movil/indicador-navegacion-movil.js')),
      import(versionedJsModule('components/navigation/compartido/enrutador.js')),
      import(versionedJsModule('components/navigation/compartido/control-busqueda.js')),
    ]))
    .then(reportRuntimeFailures);
}

export function loadSharedRuntime() {
  const page = currentPage();
  const critical = [
    import(versionedJsModule('core/auth/navegacion-autenticacion.js')),
    import(versionedJsModule('components/cart/sincronizacion-carrito.js')),
  ];

  if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
  if (page === 'cart') critical.push(import(versionedJsModule('pages/checkout/checkout-confiabilidad.js')));

  Promise.allSettled(critical).then(reportRuntimeFailures);
  attachProductsDemand();
  loadNavigationBehaviors();

  scheduleNonCritical(() => {
    Promise.allSettled([
      import(versionedJsModule('components/navigation/compartido/carga-colecciones.js')),
      loadHomeMaintenance(),
    ]).then(reportRuntimeFailures);
  });
}
