import { currentPage } from './estado-ruta.js?v=tintin-20260909-navigation-atomic-1';
import { versionedJsModule, versionedSiteAsset } from './configuracion.js?v=tintin-20260909-navigation-atomic-1';

let productsRuntimePromise = null;
let authRuntimePromise = null;
let cartRuntimePromise = null;
let notificationsRuntimePromise = null;
let collectionsRuntimePromise = null;

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

function bindDemand(selector, loader, { prefetchOnPointer = true } = {}) {
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
    if (prefetchOnPointer) control.addEventListener('pointerenter', load, { once: true, passive: true });
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

function attachNotificationsDemand() {
  bindDemand(NOTIFICATION_TRIGGER_SELECTOR, loadNotificationsRuntime);

  window.addEventListener('tintin:auth-nav-updated', event => {
    const authenticated = Boolean(event.detail?.authenticated);
    if (!authenticated) {
      setNotificationTriggersVisible(false);
      return;
    }

    // La campana se muestra solo después de registrar su superficie. Así un
    // clic inmediato tras resolver Auth nunca cae en un trigger visible que
    // todavía no tenga drawer/controlador disponible.
    void loadNotificationsRuntime()
      .then(() => setNotificationTriggersVisible(true))
      .catch(error => {
        setNotificationTriggersVisible(false);
        console.warn('[PublicShell] No se pudieron iniciar las notificaciones.', error);
      });
  });

  // Auth es una dependencia global del header incluso en páginas informativas.
  // Resolver la sesión aquí no descarga el feed de notificaciones para un
  // visitante: ese módulo y sus lecturas se activan solo cuando hay sesión.
  void loadAuthRuntime().catch(error => {
    console.warn('[PublicShell] No se pudo resolver la sesión global del header.', error);
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
    loadCollectionsRuntime,
    // El menú ya ofrece enlaces e imágenes locales. En páginas informativas,
    // un simple paso del puntero no debe generar una lectura remota.
    { prefetchOnPointer: false }
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
      import('./control-busqueda.js?v=tintin-20260908-public-activity-auth-2'),
    ]))
    .then(results => {
      // Dynamic imports are cached, but the shell DOM is remounted on every
      // navigation. Re-run geometry-dependent indicators against that DOM.
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
  attachNotificationsDemand();
  loadNavigationBehaviors();

  // Las páginas informativas resuelven Auth globalmente para que el header
  // conozca la sesión en cualquier ruta. El menú ya tiene el mismo respaldo
  // local de imágenes y enlaces en las tres superficies; actualizar datos
  // remotos de colecciones queda bajo demanda, al abrir Tienda. Así no se
  // convierte Contacto/Nosotros en una carga comercial completa.
  if (!FULL_COMMERCE_PAGES.has(page)) {
    attachLightweightCommerceDemand();
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
