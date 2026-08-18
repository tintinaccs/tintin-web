import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js?v=tintin-20260818-logo-no-flash-1';
import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js?v=tintin-20260818-logo-no-flash-1';
import { renderMobileTabbar } from './movil/encabezado-movil.js?v=tintin-20260815-routes-clean-1';
import { renderSearchPanel } from './compartido/panel-busqueda.js';
import { renderCartDrawer } from './compartido/panel-carrito.js';
import { renderAccountDrawer } from './compartido/panel-cuenta.js';
import { renderCollectionsSheet } from './compartido/panel-colecciones.js';
import { renderSurfaceLayer } from './compartido/capas-paneles.js';
import { applyActiveState, currentPage } from './compartido/estado-ruta.js';
import { ensureNavigationAssets } from './compartido/recursos-navegacion.js?v=tintin-20260818-responsive-shell-realtime-1';
import { loadSharedRuntime } from './compartido/carga-navegacion.js?v=tintin-20260818-responsive-shell-realtime-1';
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

function waitForImageReady(image, ceilingMs = 1800) {
  if (!image) return Promise.resolve(false);
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);

  return new Promise(resolve => {
    let settled = false;
    let timer = 0;

    function finish(loaded) {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve(Boolean(loaded));
    }

    function onLoad() { finish(image.naturalWidth > 0); }
    function onError() { finish(false); }

    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    timer = window.setTimeout(() => finish(image.complete && image.naturalWidth > 0), ceilingMs);
  });
}

async function settleShellBrandImage(image) {
  if (!image) return;
  let loaded = await waitForImageReady(image);
  const fallback = image.dataset.ttFallbackLogo || '';

  if (!loaded && fallback && image.src !== fallback) {
    image.src = fallback;
    loaded = await waitForImageReady(image, 1200);
  }

  // El logo queda oculto hasta que Visual Studio ya decidió la fuente final.
  // Así nunca se ve el logo local/default y luego el personalizado encima.
  image.style.removeProperty('visibility');
  image.removeAttribute('data-tt-shell-logo-pending');
}

async function finalizeShellBrandImages(root = document) {
  const images = [...root.querySelectorAll(
    '#tt-header-desktop-tablet img[data-tt-shell-logo-pending], #tt-header-tablet img[data-tt-shell-logo-pending], #tt-tablet-menu img[data-tt-shell-logo-pending]'
  )];
  await Promise.all(images.map(settleShellBrandImage));
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

function mountPublicShell() {
  if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return Promise.resolve();
  if (mountPromise) return mountPromise;

  document.body.classList.add('tt-public-shell-mounting');
  window.TintinLoader?.beginWait?.();

  const navigationAssetsPromise = ensureNavigationAssets();
  const globalConfigPromise = resolveWithCeiling(
    fetchGlobalVisualStudioConfig(),
    3500,
    null
  );

  mountPromise = navigationAssetsPromise.then(async () => {
    if (document.body.classList.contains('tt-public-shell-mounted')) return;

    removeLegacyShell();
    document.body.insertAdjacentHTML('afterbegin', renderTopShell());
    document.body.insertAdjacentHTML('beforeend', renderBottomShell());

    // Primero se resuelve la configuración global y recién después se revela
    // el logo. El usuario nunca ve una imagen provisional durante ese tiempo.
    const globalConfig = await globalConfigPromise;
    if (globalConfig?.layout) applyGlobalLayout(globalConfig.layout);
    else document.documentElement.dataset.ttGlobalLayout = 'fallback';
    if (globalConfig) applyGlobalVisualStudio(globalConfig);
    else document.documentElement.dataset.ttGlobalStudio = 'fallback';

    await finalizeShellBrandImages();

    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');

    applyActiveState();
    enhanceMobileFooter();
    await registerNavigationSurfaces();
    loadSharedRuntime();

    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
      detail: {
        architecture: 'modular-navigation-v1',
        socialNotifications: 'firestore-realtime-always-on',
        responsiveSurfaces: 'viewport-fit-v2',
        globalConfigRequests: 1,
        sharedLogoRequests: 0,
        brandPaint: 'configured-logo-first',
      },
    }));
  }).catch(error => {
    console.error('[PublicShell] No se pudo montar la navegación.', error);
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
