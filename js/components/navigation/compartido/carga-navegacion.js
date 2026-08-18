import { currentPage } from './estado-ruta.js';
import { versionedJsModule, versionedSiteAsset } from './configuracion.js';

let productsRuntimePromise = null;
let authRuntimePromise = null;
let cartRuntimePromise = null;
let notificationsRuntimePromise = null;
let collectionsRuntimePromise = null;

const FULL_COMMERCE_PAGES = new Set(['home', 'shop', 'cart', 'account']);
const CHECKOUT_IDENTITY_VERSION = 'tintin-20260818-checkout-identity-1';

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

function bindDemand(selector, loader) {
  let started = false;
  const load = () => {
    if (started) return;
    started = true;
    Promise.resolve(loader()).catch(error => {
      started = false;
      console.warn('[PublicShell] No se pudo cargar un runtime bajo demanda.', error);
    });
  };
  document.querySelectorAll(selector).forEach(control => {
    control.addEventListener('pointerenter', load, { once: true, passive: true });
    control.addEventListener('focus', load, { once: true });
    control.addEventListener('pointerdown', load, { once: true, passive: true });
    control.addEventListener('click', load, { once: true });
  });
}

function loadHomeMaintenance() {
  if (currentPage() !== 'home') return Promise.resolve();

  if (!document.getElementById('tt-home-maintenance-css')) {
    const link = document.createElement('link');
    link.id = 'tt-home-maintenance-css';
    link.rel = 'stylesheet';
    link.href = versionedSiteAsset('css/pages/home/mantenimiento-inicio.css');
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

function loadAuthRuntime() {
  if (!authRuntimePromise) {
    authRuntimePromise = import(versionedJsModule('core/auth/navegacion-autenticacion.js')).catch(error => {
      authRuntimePromise = null;
      throw error;
    });
  }
  return authRuntimePromise;
}

function loadCartRuntime() {
  if (!cartRuntimePromise) {
    cartRuntimePromise = import(versionedJsModule('components/cart/sincronizacion-carrito.js')).catch(error => {
      cartRuntimePromise = null;
      throw error;
    });
  }
  return cartRuntimePromise;
}

function loadNotificationsRuntime() {
  if (!notificationsRuntimePromise) {
    notificationsRuntimePromise = import(versionedJsModule('components/notifications/notificaciones-clientes.js'))
      .then(module => {
        module.initClientNotifications?.();
        return module;
      })
      .catch(error => {
        notificationsRuntimePromise = null;
        throw error;
      });
  }
  return notificationsRuntimePromise;
}

function loadCollectionsRuntime() {
  if (!collectionsRuntimePromise) {
    collectionsRuntimePromise = import(versionedJsModule('components/navigation/compartido/carga-colecciones.js'))
      .catch(error => {
        collectionsRuntimePromise = null;
        throw error;
      });
  }
  return collectionsRuntimePromise;
}

function loadCheckoutIdentityRuntime() {
  const url = new URL('../../../pages/checkout/checkout-identidad-navegacion.js', import.meta.url);
  url.searchParams.set('v', CHECKOUT_IDENTITY_VERSION);
  return import(url.href);
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

function attachLightweightCommerceDemand() {
  bindDemand(
    '[data-nav-action="account"],[data-shell-route="account"],#tabbar-account',
    loadAuthRuntime
  );
  bindDemand(
    '[data-nav-action="cart"],[data-shell-route="cart"],#tabbar-cart',
    loadCartRuntime
  );
  bindDemand(
    '#btn-tienda,#btn-tablet-tienda,[data-collections-nav],#collections-sheet',
    loadCollectionsRuntime
  );
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
      import(versionedJsModule('components/navigation/movil/navegacion-compacta-movil.js')),
      import(versionedJsModule('components/navigation/compartido/enrutador.js')),
      import(versionedJsModule('components/navigation/compartido/control-busqueda.js')),
    ]))
    .then(reportRuntimeFailures);
}

export function loadSharedRuntime() {
  const page = currentPage();
  attachProductsDemand();
  loadNavigationBehaviors();

  /* Las notificaciones son infraestructura en vivo, no una mejora bajo
     demanda. Se inicia el listener Firestore en TODAS las páginas públicas
     apenas el shell está listo, independientemente del tamaño de pantalla o
     del tipo de página. No usa polling ni espera a abrir la campana. */
  void loadNotificationsRuntime().catch(error => {
    console.warn('[PublicShell] No se pudieron iniciar las notificaciones realtime.', error);
  });

  // Páginas informativas mantienen catálogo, carrito, cuenta y colecciones
  // bajo demanda para no abrir trabajo que no necesitan. Solo notificaciones
  // permanece siempre conectada porque debe reaccionar en tiempo real.
  if (!FULL_COMMERCE_PAGES.has(page)) {
    attachLightweightCommerceDemand();
    return;
  }

  const critical = [loadAuthRuntime(), loadCartRuntime()];
  if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
  if (page === 'cart') {
    critical.push(import(versionedJsModule('pages/checkout/checkout-confiabilidad.js')));
    critical.push(loadCheckoutIdentityRuntime());
  }

  Promise.allSettled(critical).then(reportRuntimeFailures);

  scheduleNonCritical(() => {
    Promise.allSettled([
      loadCollectionsRuntime(),
      loadHomeMaintenance(),
    ]).then(reportRuntimeFailures);
  });
}
