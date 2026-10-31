import { currentPage } from './estado-ruta.js?v=tintin-20260916-final-production-stability-state-1';
import { BREAKPOINTS, versionedJsModule, versionedSiteAsset } from './configuracion.js?v=tintin-20261010-whatsapp-release-5';

let productsRuntimePromise = null;
let authRuntimePromise = null;
let cartRuntimePromise = null;
let notificationsRuntimePromise = null;
let collectionsRuntimePromise = null;
let navigationBehaviorsPromise = null;
let searchControllerPromise = null;

const FULL_COMMERCE_PAGES = new Set(['home', 'shop', 'cart', 'account']);
const NOTIFICATION_TRIGGER_SELECTOR = '[data-nav-action="notifications"],#tabbar-notifications';
const IS_VISUAL_PREVIEW_FRAME = new URLSearchParams(window.location.search).get('ttVisualPreview') === '1'
  && window.parent !== window;
// Debe compartir identidad con los imports estáticos de catálogo/checkout.
const CART_RUNTIME_URL = '../../../components/cart/sincronizacion-carrito.js?v=tintin-20261030-home-history-5';
const COLLECTIONS_RUNTIME_URL = './carga-colecciones.js?v=tintin-20261030-home-history-5';
const PRODUCTS_RUNTIME_URL = '../../../core/store/estado-productos.js?v=tintin-20261031-ficha-en-vivo-1';

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
    link.href = new URL('/css/pages/home/mantenimiento-inicio.css?v=tintin-20261019-footer-spacing-1', location.href).href;
    document.head.appendChild(link);
  }

  return import(new URL('/js/pages/home/mantenimiento-inicio.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href);
}

export function loadProductsRuntime({ forSearch = false } = {}) {
  if (!productsRuntimePromise) {
    productsRuntimePromise = Promise.all([
      window.TintinProductMedia ? Promise.resolve() : import('../../../components/images/galeria-producto.js?v=tintin-20261019-variant-links-1'),
      import(PRODUCTS_RUNTIME_URL),
    ]).then(([, module]) => module).catch(error => {
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
    authRuntimePromise = import('../../../core/auth/navegacion-autenticacion.js?v=tintin-20261030-home-history-5').catch(error => {
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
    notificationsRuntimePromise = import('../../../components/notifications/notificaciones-clientes.js?v=tintin-20261030-notificaciones-explicitas-1')
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

function loadCollectionsRuntime({ withProducts = false } = {}) {
  if (!collectionsRuntimePromise) {
    collectionsRuntimePromise = import(COLLECTIONS_RUNTIME_URL)
      .then(async module => { await module.initNavCollections?.(); return module; })
      .catch(error => { collectionsRuntimePromise = null; throw error; });
  }
  return collectionsRuntimePromise.then(async module => {
    // El respaldo por producto sólo hace falta al abrir el menú. La carga
    // inicial de una página informativa usa las imágenes locales canónicas.
    if (withProducts) await loadProductsRuntime({ forSearch: true });
    return module;
  });
}

// En páginas informativas, la búsqueda se inicia al usarla. Conserva la
// consulta escrita mientras termina de cargar el controlador compartido.
function loadSearchRuntime() {
  if (!searchControllerPromise) {
    searchControllerPromise = import('./control-busqueda.js?v=tintin-20261031-ficha-en-vivo-1')
      .then(module => {
        module.initSearchController();
        window.TintinSearchController?.renderCurrentQuery();
        return module;
      })
      .catch(error => { searchControllerPromise = null; throw error; });
  }
  return searchControllerPromise;
}

function attachProductsDemand() {
  let started = false;

  const load = () => {
    if (started) return;
    started = true;
    Promise.all([loadSearchRuntime(), loadProductsRuntime({ forSearch: true })]).then(() => {
      const input = document.getElementById('search-input');
      if (input?.value) input.dispatchEvent(new Event('input', { bubbles: true }));
    }).catch(error => {
      started = false;
      console.warn('[PublicShell] No se pudo cargar el catálogo para la búsqueda.', error);
    });
  };

  window.addEventListener('tintin:surface-change', event => {
    if (event.detail?.surface === 'search' && event.detail.state === 'opening') {
      started = false;
      load(); // Reutiliza TTL y single-flight del store en cada apertura.
    }
  });
  document.querySelectorAll('[data-nav-action="search"],#tabbar-search,#search-input').forEach(control => {
    control.addEventListener('pointerenter', load, { once: true, passive: true });
    control.addEventListener('focus', load, { once: true });
    control.addEventListener('click', load, { once: true });
  });
}

function attachFooterCollectionsDemand() {
  const footer = document.querySelector('[data-collections-nav="footer"]');
  if (!footer) return;
  // Al llegar al footer basta la metadata compartida; no se necesitan productos.
  const load = () => import(COLLECTIONS_RUNTIME_URL)
    .then(module => module.initNavCollections())
    .catch(error => console.warn('[PublicShell] No se pudieron actualizar las colecciones del footer.', error));
  if (!('IntersectionObserver' in window)) { void load(); return; }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    void load();
  }, { rootMargin: '200px' });
  observer.observe(footer);
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
}

function attachCollectionsProductsDemand() {
  bindDemand(
    '#btn-tienda,#btn-tablet-tienda,#tabbar-tienda,[data-collections-nav],#collections-sheet',
    () => loadCollectionsRuntime({ withProducts: true }),
    // El catálogo de Inicio es parcial. El menú pide su respaldo completo
    // sólo al usarse, en cualquier ruta; pasar el puntero no consulta datos.
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
    import(new URL('/js/components/navigation/movil/indicador-navegacion-movil.js?v=tintin-20261010-whatsapp-release-5', location.href).href),
    import(new URL('/js/components/navigation/movil/navegacion-compacta-movil.js?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2', location.href).href),
  ],
});

function currentSurface() {
  if (window.matchMedia(`(max-width: ${BREAKPOINTS.mobileMax}px)`).matches) return 'mobile';
  if (window.matchMedia(`(max-width: ${BREAKPOINTS.tabletMax}px)`).matches) return 'tablet';
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
      FULL_COMMERCE_PAGES.has(currentPage()) ? loadSearchRuntime() : Promise.resolve(),
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
  attachFooterCollectionsDemand();
  attachCollectionsProductsDemand();

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
  if (page === 'cart') critical.push(import('../../../pages/checkout/checkout-confiabilidad.js?v=tintin-20261021-commerce-review-1'));

  Promise.allSettled(critical).then(reportRuntimeFailures);

  scheduleNonCritical(() => {
    Promise.allSettled([loadCollectionsRuntime()]).then(reportRuntimeFailures);
    Promise.allSettled([loadHomeMaintenance()]).then(reportRuntimeFailures);
  });
}
