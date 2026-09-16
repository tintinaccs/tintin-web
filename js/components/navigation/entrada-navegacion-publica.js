import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js?v=tintin-20260915-session-shell-1';
import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js?v=tintin-20260915-session-shell-1';
import { renderMobileTabbar } from './movil/encabezado-movil.js?v=tintin-20260820-notifications-global-1';
import { renderSearchPanel } from './compartido/panel-busqueda.js';
import { renderCartDrawer } from './compartido/panel-carrito.js';
import { renderAccountDrawer } from './compartido/panel-cuenta.js?v=tintin-20260915-session-shell-1';
import { renderCollectionsSheet } from './compartido/panel-colecciones.js';
import { renderSurfaceLayer } from './compartido/capas-paneles.js';
import { applyActiveState, currentPage } from './compartido/estado-ruta.js';
import { ensureNavigationAssets } from './compartido/recursos-navegacion.js?v=tintin-20260916-premium-performance-1';
import { loadProductsRuntime, loadSharedRuntime } from './compartido/carga-navegacion.js?v=tintin-20260916-cache-bump-navigation-load-3';
import { enhanceMobileFooter } from './compartido/acordeon-pie-pagina.js';
import { registerNavigationSurfaces } from './compartido/registro-paneles.js';
import { fetchGlobalVisualStudioConfig, applyGlobalLayout } from './compartido/apariencia-global.js?v=tintin-20260817-footer-contrast-1';
import { applyGlobalVisualStudio } from '../../core/store/visual-studio-global-runtime.js?v=tintin-20260815-global-studio-10';

const LEGACY_SHELL_IDS = Object.freeze([
  'tt-header-desktop-tablet',
  'tt-header-tablet',
  'search-panel',
  'mobile-menu',
  'tt-tablet-menu',
  'tt-tabbar',
  'cart-overlay',
  'cart-drawer',
  'account-drawer',
  'collections-sheet',
  'sheet-backdrop',
  'tt-shared-backdrop',
  'tt-shared-morph',
  'notifications-drawer',
]);

let mountPromise = null;

function bootGlobalUiUx() {
  if (!document.getElementById('tt-phase8-ui-ux-css')) {
    const link = document.createElement('link');
    link.id = 'tt-phase8-ui-ux-css';
    link.rel = 'stylesheet';
    link.href = '/css/quality/experiencia-interfaz.css';
    document.head.appendChild(link);
  }
  if (!window.TintinUX?.booted) {
    import('../../quality/experiencia-interfaz.js?v=tintin-20260909-global-ui-ux-1')
      .catch(error => console.warn('[PublicShell] No se pudo iniciar la capa UI global.', error));
  }
}

function removeLegacyShell(root = document) {
  LEGACY_SHELL_IDS.forEach(id => root.getElementById(id)?.remove());
}

function renderTopShell() {
  return [
    renderDesktopHeader(),
    renderTabletHeader(),
    renderSearchPanel(),
    renderTabletMenu(),
  ].join('');
}

function renderBottomShell() {
  return [
    renderMobileTabbar(),
    renderCartDrawer(),
    renderAccountDrawer(),
    renderCollectionsSheet(),
    renderSurfaceLayer(),
  ].join('');
}

function hydrateCollectionVisualFallback(root = document) {
  root.querySelectorAll('img[data-tt-collection-image][data-src]').forEach(image => {
    image.src = image.dataset.src;
    image.removeAttribute('data-src');
    image.removeAttribute('data-tt-collection-image');
  });
}

function attachCollectionVisualFallback(root = document) {
  const activate = () => hydrateCollectionVisualFallback(root);
  root.querySelectorAll('#btn-tienda, #btn-tablet-tienda, #tabbar-tienda').forEach(control => {
    control.addEventListener('pointerenter', activate, { once: true, passive: true });
    control.addEventListener('focus', activate, { once: true });
    control.addEventListener('pointerdown', activate, { once: true, passive: true });
    control.addEventListener('click', activate, { once: true });
  });
}

function resolveWithCeiling(promise, ceilingMs, fallbackValue = null) {
  return new Promise(resolve => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallbackValue);
    }, ceilingMs);

    Promise.resolve(promise).then(
      value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(fallbackValue);
      }
    );
  });
}

function waitForImageReady(image, ceilingMs = 1600) {
  if (!image) return Promise.resolve();
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();

  return new Promise(resolve => {
    let settled = false;
    let timer = 0;

    function finish() {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    }

    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    timer = window.setTimeout(finish, ceilingMs);
  });
}

async function waitForShellBrandImages(root = document) {
  const images = [...root.querySelectorAll(
    '#tt-header-desktop-tablet img.tt-logo-img, #tt-header-tablet img.tt-tablet-logo-img, #tt-tablet-menu img.tt-tablet-menu-logo-img'
  )];
  await Promise.all(images.map(image => waitForImageReady(image, 1200)));
}

async function prepareHomeHeroAtomicReveal() {
  if (currentPage() !== 'home') return 'not-home';
  const image = document.getElementById('tt-hero-img');
  if (!(image instanceof HTMLImageElement)) return 'missing';

  document.body.classList.add('tt-hero-atomic-pending');
  document.body.classList.remove('tt-hero-atomic-ready');

  const decoded = (async () => {
    try {
      if (typeof image.decode === 'function') await image.decode();
      else await waitForImageReady(image, 2200);
      return true;
    } catch {
      await waitForImageReady(image, 650);
      return image.complete && image.naturalWidth > 0;
    }
  })();

  const ready = await resolveWithCeiling(decoded, 2400, false);
  document.body.classList.remove('tt-hero-atomic-pending');
  document.body.classList.add('tt-hero-atomic-ready');
  return ready ? 'decoded' : 'ceiling';
}

async function loadFinalStability() {
  if (document.getElementById('product-detail')) {
    await import('../../quality/estabilidad-producto.js?v=tintin-20260831-product-stability-2');
    return 'tintin-20260831-product-stability-2';
  }
  await import('../../quality/estabilidad-final-publica.js?v=tintin-20260829-final-stability-3');
  return 'tintin-20260829-final-stability-1';
}

function mountPublicShell() {
  if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return Promise.resolve();
  if (mountPromise) return mountPromise;

  document.body.classList.add('tt-public-shell-mounting');
  window.TintinLoader?.beginWait?.();

  // Producto y catálogo tienen una dependencia de datos crítica propia. Se
  // inicia en paralelo; nunca bloquea el montaje visual del header.
  const pageDataPromise = currentPage() === 'shop'
    ? loadProductsRuntime().catch(error => {
      console.warn('[PublicShell] No se pudo iniciar el catálogo crítico.', error);
      return null;
    })
    : Promise.resolve(null);

  // ensureNavigationAssets inserta los <link> de inmediato. El DOM del shell
  // también se monta de inmediato, debajo del loader, para que al revelarse la
  // página el header ya exista y no aparezca varios frames después.
  const navigationAssetsPromise = ensureNavigationAssets();
  const globalConfigPromise = resolveWithCeiling(
    fetchGlobalVisualStudioConfig(),
    1400,
    null
  );

  removeLegacyShell();
  document.body.insertAdjacentHTML('afterbegin', renderTopShell());
  document.body.insertAdjacentHTML('beforeend', renderBottomShell());
  attachCollectionVisualFallback();
  bootGlobalUiUx();

  // Auth y carrito empiezan apenas existen sus superficies. Antes se iniciaban
  // después de logo/configuración/registro de paneles, lo que dejaba una
  // ventana visible donde la cuenta parecía invitada y el carrito vacío.
  loadSharedRuntime();
  const heroReadyPromise = prepareHomeHeroAtomicReveal();

  mountPromise = (async () => {
    await navigationAssetsPromise;

    const globalConfig = await globalConfigPromise;
    if (globalConfig?.layout) applyGlobalLayout(globalConfig.layout);
    else document.documentElement.dataset.ttGlobalLayout = 'fallback';
    if (globalConfig) applyGlobalVisualStudio(globalConfig);
    else document.documentElement.dataset.ttGlobalStudio = 'fallback';

    await Promise.all([
      resolveWithCeiling(waitForShellBrandImages(), 1250, null),
      heroReadyPromise,
    ]);

    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');

    applyActiveState();
    enhanceMobileFooter();
    await registerNavigationSurfaces();
    void pageDataPromise;

    // La capa de estabilidad continúa cargando, pero ya no retiene el loader
    // global: no forma parte del primer frame ni del contrato de sesión/header.
    void loadFinalStability()
      .then(finalStability => {
        document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
          detail: {
            architecture: 'modular-navigation-v1',
            socialNotifications: 'global',
            globalConfigRequests: 1,
            sharedLogoRequests: 0,
            heroReveal: currentPage() === 'home' ? 'atomic' : 'not-applicable',
            finalStability,
          },
        }));
      })
      .catch(error => {
        console.warn('[PublicShell] La estabilidad final no pudo cargarse.', error);
        document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
          detail: {
            architecture: 'modular-navigation-v1',
            socialNotifications: 'global',
            globalConfigRequests: 1,
            sharedLogoRequests: 0,
            heroReveal: currentPage() === 'home' ? 'atomic' : 'not-applicable',
            finalStability: 'error',
          },
        }));
      });
  })().catch(error => {
    console.error('[PublicShell] No se pudo montar la navegación.', error);
    document.body?.classList.remove('tt-hero-atomic-pending');
    document.body?.classList.add('tt-hero-atomic-ready');
    document.dispatchEvent(new CustomEvent('tintin:public-shell-error', { detail: { error } }));
    throw error;
  }).finally(() => {
    document.body?.classList.remove('tt-public-shell-mounting');
    window.TintinLoader?.endWait?.();
  });

  return mountPromise;
}

function startPublicExperience() {
  void mountPublicShell();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPublicExperience, { once: true });
} else {
  startPublicExperience();
}
