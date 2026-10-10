import { currentPage } from './estado-ruta.js?v=tintin-20260916-final-production-stability-state-1';
import { versionedJsModule, versionedSiteAsset } from './configuracion.js?v=tintin-20261010-whatsapp-release-4';

let productsRuntimePromise = null;
let authRuntimePromise = null;
let cartRuntimePromise = null;
let notificationsRuntimePromise = null;
let collectionsRuntimePromise = null;
let navigationBehaviorsPromise = null;

const FULL_COMMERCE_PAGES = new Set(['home', 'shop', 'cart', 'account']);
const NOTIFICATION_TRIGGER_SELECTOR = '[data-nav-action="notifications"],#tabbar-notifications';
const IS_VISUAL_PREVIEW_FRAME = new URLSearchParams(window.location.search).get('ttVisualPreview') === '1'
  && window.parent !== window;
// Debe compartir identidad con los imports estáticos de catálogo/checkout.
const CART_RUNTIME_URL = '../../../components/cart/sincronizacion-carrito.js?v=tintin-20261010-whatsapp-release-4';
const COLLECTIONS_RUNTIME_URL = './carga-colecciones.js?v=tintin-20261007-public-consistency-1-master-20261007-1-encomienda-20261008-1';
const PRODUCTS_RUNTIME_URL = '../../../core/store/estado-productos.js?v=tintin-20261010-whatsapp-release-4';

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
    setNotificationTriggersVisible(true);
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
    link.href = new URL('/css/pages/home/mantenimiento-inicio.css?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href;
    document.head.appendChild(link);
  }

  return import(new URL('/js/pages/home/mantenimiento-inicio.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href);
}

export function loadProductsRuntime({ forSearch = false } = {}) {
  if (!productsRuntimePromise) {
    productsRuntimePromise = import(PRODUCTS_RUNTIME_URL).catch(error => {
      productsRuntimePromise = null;
      window.dispatchEvent(new CustomEvent('tintin:products-error', { detail: { error } }));
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
  if (IS_VISUAL_PREVIEW_FRAME) return Promise.resolve(null);
  if (!authRuntimePromise) {
    authRuntimePromise = import('../../../core/auth/navegacion-autenticacion.js?v=tintin-20261010-whatsapp-release-4').catch(error => {
      authRuntimePromise = null;
      throw error;
    });
  }
  return authRuntimePromise;
}

function loadCartRuntime() {
  if (!cartRuntimePromise) {
    cartRuntimePromise = import(CART_RUNTIME_URL).catch(error => {
      cartRuntimePromise = null;
      throw error;
    });
  }
  return cartRuntimePromise;
}

function loadNotificationsRuntime() {
  if (!notificationsRuntimePromise) {
    notificationsRuntimePromise = import('../../../components/notifications/notificaciones-clientes.js?v=tintin-20261010-whatsapp-release-4')
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
    collectionsRuntimePromise = import(COLLECTIONS_RUNTIME_URL)
      .then(module => {
        // Informational pages do not auto-start this module. Initialize it
        // after the idle import so the first open uses the canonical snapshot.
        // La foto de respaldo depende del catálogo, también en Nosotros,
        // Contacto y cualquier otra ruta. La misma API edge/cache alimenta
        // todas las superficies; nunca se abre un listener público de Firestore.
        // Inicio y las páginas de catálogo ya inician su propia lectura.
        // Reutilizarla evita otra petición desde la búsqueda del menú.
        const path = window.location.pathname.toLowerCase();
        const pageLoadsCatalog = path.endsWith('/') || /(?:^|\/)(?:index|catalogo|collections)(?:\.html)?$/.test(path);
        return Promise.allSettled([
          module.initNavCollections?.(),
          loadProductsRuntime({ forSearch: !pageLoadsCatalog }),
        ]).then(results => {
          reportRuntimeFailures(results);
          return module;
        });
      })
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
    '#btn-tienda,#btn-tablet-tienda,#tabbar-tienda,[data-collections-nav],#collections-sheet',
    loadCollectionsRuntime,
    // El menú ya ofrece enlaces e imágenes locales. En páginas informativas,
    // un simple paso del puntero no debe generar una lectura remota.
    { prefetchOnPointer: false }
  );
}

let activeSurface = null;
const surfaceLoads = new Map();

// Keep import() behind a factory: object literals evaluate every property
// before the selected surface is read, which defeated the viewport-only
// loading contract and surfaced unrelated module failures as navigation
// errors.
const navigationSurfaceImportFactories = Object.freeze({
  desktop: () => [
    import(new URL('/js/components/navigation/escritorio/indicador-navegacion-escritorio.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href),
  ],
  tablet: () => [
    import(new URL('/js/components/navigation/tableta/control-menu-tableta.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href),
  ],
  mobile: () => [
    import(new URL('/js/components/navigation/movil/indicador-navegacion-movil.js?v=tintin-20261010-whatsapp-release-4', location.href).href),
    import(new URL('/js/components/navigation/movil/navegacion-compacta-movil.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href),
  ],
});

function currentSurface() {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1120px)').matches) return 'tablet';
  return 'desktop';
}

function loadNavigationSurface(surface) {
  if (surfaceLoads.has(surface)) return surfaceLoads.get(surface);
  const imports = navigationSurfaceImportFactories[surface]?.() || [];
  const promise = Promise.allSettled(imports).then(results => {
    if (surface === 'desktop') {
      results[0].status === 'fulfilled' && results[0].value.initDesktopNavigationIndicator?.();
    } else if (surface === 'mobile') {
      results[0].status === 'fulfilled' && results[0].value.initMobileNavigationIndicator?.();
    }
    reportRuntimeFailures(results);
    return results;
  });
  surfaceLoads.set(surface, promise);
  return promise;
}

function loadNavigationBehaviors() {
  if (navigationBehaviorsPromise) return navigationBehaviorsPromise;
  // Start the viewport-specific behavior immediately. The shell can be visible
  // before the shared controller resolves, so mobile scroll compaction must not
  // depend on an unrelated readiness promise.
  const initialSurface = currentSurface();
  const initialSurfacePromise = loadNavigationSurface(initialSurface);
  const controllerReady = window.TintinSurfaceControllerReady || Promise.resolve(window.TintinSurfaceController);
  navigationBehaviorsPromise = Promise.resolve(controllerReady)
    .catch(error => {
      console.warn('[PublicShell] El controlador de superficies no inició.', error);
      return null;
    })
    .then(() => Promise.allSettled([
      initialSurfacePromise,
      import(new URL('/js/components/navigation/compartido/enrutador.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href),
      import('./control-busqueda.js?v=tintin-20261010-whatsapp-release-4'),
    ]))
    .then(results => {
      reportRuntimeFailures(results);
      activeSurface = initialSurface;
      return loadNavigationSurface(activeSurface);
    })
    .then(() => {
      const onViewportChange = () => {
        const nextSurface = currentSurface();
        if (nextSurface === activeSurface) return;
        activeSurface = nextSurface;
        void loadNavigationSurface(nextSurface);
      };
      window.addEventListener('resize', onViewportChange, { passive: true });
      window.addEventListener('orientationchange', onViewportChange, { passive: true });
    })
    .catch(error => {
      navigationBehaviorsPromise = null;
      console.warn('[PublicShell] No se pudo iniciar navegación compartida.', error);
    });
  return navigationBehaviorsPromise;
}

export function loadSharedRuntime() {
  const page = currentPage();
  attachProductsDemand();
  loadNavigationBehaviors();

  // La previsualización usa el shell y los estilos reales, pero no necesita
  // sesión, carrito, perfil ni notificaciones. Evitar esos runtimes elimina
  // listeners de Firestore y conserva aislada la autenticación del administrador.
  if (IS_VISUAL_PREVIEW_FRAME) return;

  attachNotificationsDemand();

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
  if (page === 'cart') critical.push(import('../../../pages/checkout/checkout-confiabilidad.js?v=tintin-20261004-final-integration-1-loads-20261007-1'));

  Promise.allSettled(critical).then(reportRuntimeFailures);

  scheduleNonCritical(() => {
    Promise.allSettled([loadCollectionsRuntime()]).then(reportRuntimeFailures);
    Promise.allSettled([loadHomeMaintenance()]).then(reportRuntimeFailures);
  });
}
