import { currentPage } from './estado-ruta.js';
import { versionedJsModule, versionedSiteAsset } from './configuracion.js?v=tintin-20260831-instant-auth-reveal-once-1';

let productsRuntimePromise = null;
let authRuntimePromise = null;
let cartRuntimePromise = null;
let notificationsRuntimePromise = null;
let collectionsRuntimePromise = null;
let notificationsIdentityBound = false;

const FULL_COMMERCE_PAGES = new Set(['home', 'shop', 'cart', 'account']);
const NOTIFICATION_TRIGGER_SELECTOR = '[data-nav-action="notifications"],#tabbar-notifications';

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

function setNotificationTriggersVisible(visible) {
  document.querySelectorAll(NOTIFICATION_TRIGGER_SELECTOR).forEach(trigger => {
    trigger.hidden = !visible;
  });
}

function applyNotificationIdentity(authenticated) {
  if (!authenticated) {
    setNotificationTriggersVisible(false);
    return;
  }

  // La identidad ya está confirmada. El feed se inicia inmediatamente, sin
  // esperar rol, hover, click ni requestIdleCallback. La campana se muestra
  // únicamente cuando el drawer/runtime ya quedó registrado para evitar un
  // trigger visible que todavía no tenga superficie asociada.
  void loadNotificationsRuntime()
    .then(() => setNotificationTriggersVisible(true))
    .catch(error => {
      setNotificationTriggersVisible(false);
      console.warn('[PublicShell] No se pudieron iniciar las notificaciones.', error);
    });
}

export function activateIdentityNotifications() {
  if (!notificationsIdentityBound) {
    notificationsIdentityBound = true;
    window.addEventListener('tintin:auth-identity', event => {
      applyNotificationIdentity(Boolean(event.detail?.authenticated));
    });
    // Compatibilidad defensiva: si otro runtime solo publica el evento
    // enriquecido de rol, no perdemos el estado de sesión.
    window.addEventListener('tintin:auth-nav-updated', event => {
      if (window.TintinAuthIdentity?.resolved) return;
      applyNotificationIdentity(Boolean(event.detail?.authenticated));
    });
  }

  // Auth puede haber resuelto mientras el shell todavía montaba logo/config.
  // Consumir el snapshot global evita esperar un segundo evento que no llegará.
  if (window.TintinAuthIdentity?.resolved) {
    applyNotificationIdentity(Boolean(window.TintinAuthIdentity.authenticated));
  } else {
    setNotificationTriggersVisible(false);
  }

  return primeAuthRuntime();
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

export function loadAuthRuntime() {
  if (!authRuntimePromise) {
    authRuntimePromise = import(versionedJsModule('core/auth/navegacion-autenticacion.js')).catch(error => {
      authRuntimePromise = null;
      throw error;
    });
  }
  return authRuntimePromise;
}

export function primeAuthRuntime() {
  return loadAuthRuntime().catch(error => {
    console.warn('[PublicShell] No se pudo resolver la sesión global del header.', error);
    throw error;
  });
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
      import('./control-busqueda.js?v=tintin-20260831-product-loading-3'),
    ]))
    .then(results => {
      const desktop = results[0].status === 'fulfilled' ? results[0].value : null;
      const mobile = results[2].status === 'fulfilled' ? results[2].value : null;
      desktop?.initDesktopNavigationIndicator?.();
      mobile?.initMobileNavigationIndicator?.();
      return results;
    })
    .then(reportRuntimeFailures);
}

export function loadSharedRuntime() {
  const page = currentPage();
  attachProductsDemand();
  activateIdentityNotifications();
  loadNavigationBehaviors();

  if (!FULL_COMMERCE_PAGES.has(page)) {
    attachLightweightCommerceDemand();
    scheduleNonCritical(() => {
      Promise.allSettled([loadCollectionsRuntime()]).then(reportRuntimeFailures);
    });
    return;
  }

  const critical = [loadAuthRuntime(), loadCartRuntime()];
  if (page === 'home' || page === 'shop') critical.push(loadProductsRuntime());
  if (page === 'cart') critical.push(import(versionedJsModule('pages/checkout/checkout-confiabilidad.js')));

  Promise.allSettled(critical).then(reportRuntimeFailures);

  scheduleNonCritical(() => {
    Promise.allSettled([
      loadCollectionsRuntime(),
      loadHomeMaintenance(),
    ]).then(reportRuntimeFailures);
  });
}
