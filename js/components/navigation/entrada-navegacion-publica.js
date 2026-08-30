import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js?v=tintin-20260824-header-logo-fallback-1';
import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js?v=tintin-20260824-header-logo-fallback-1';
import { renderMobileTabbar } from './movil/encabezado-movil.js?v=tintin-20260820-notifications-global-1';
import { renderSearchPanel } from './compartido/panel-busqueda.js';
import { renderCartDrawer } from './compartido/panel-carrito.js';
import { renderAccountDrawer } from './compartido/panel-cuenta.js';
import { renderCollectionsSheet } from './compartido/panel-colecciones.js';
import { renderSurfaceLayer } from './compartido/capas-paneles.js';
import { applyActiveState, currentPage } from './compartido/estado-ruta.js';
import { ensureNavigationAssets } from './compartido/recursos-navegacion.js';
import { loadProductsRuntime, loadSharedRuntime } from './compartido/carga-navegacion.js?v=tintin-20260827-responsive-indicators-1';
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
let sharedLogoDataPromise = null;

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

function blobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el logo.'));
    reader.readAsDataURL(blob);
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
  if (image.complete) return Promise.resolve();

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
    '#tt-header-desktop-tablet img, #tt-header-tablet img, #tt-tablet-menu img'
  )];
  await Promise.all(images.map(image => waitForImageReady(image)));
}

function clearSharedLogoErrorState(image) {
  if (!(image instanceof HTMLImageElement)) return;
  image.classList.remove('tt-img-error');
  const label = image.nextElementSibling;
  if (label?.classList.contains('tt-img-error-label')) label.remove();
}

function hydrateSharedLogos(root = document) {
  const images = [...root.querySelectorAll('img[data-tt-shared-logo]')];
  const source = images.find(image => image.dataset.ttSharedLogo)?.dataset.ttSharedLogo;
  if (!images.length || !source) return Promise.resolve();

  if (!sharedLogoDataPromise) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), 1800);

    sharedLogoDataPromise = fetch(source, {
      cache: 'force-cache',
      credentials: 'same-origin',
      ...(controller ? { signal: controller.signal } : {}),
    })
      .then(response => {
        if (!response.ok) throw new Error(`Logo HTTP ${response.status}`);
        return response.blob();
      })
      .then(blobAsDataUrl)
      .catch(error => {
        console.warn('[PublicShell] No se pudo compartir el logo en memoria.', error);
        return source;
      })
      .finally(() => window.clearTimeout(timer));
  }

  return sharedLogoDataPromise.then(async value => {
    images.forEach(image => {
      clearSharedLogoErrorState(image);
      image.src = value;
      image.removeAttribute('data-tt-shared-logo');
    });
    await Promise.all(images.map(image => waitForImageReady(image)));
    images.forEach(clearSharedLogoErrorState);
  });
}

function mountPublicShell() {
  if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return Promise.resolve();
  if (mountPromise) return mountPromise;

  document.body.classList.add('tt-public-shell-mounting');
  window.TintinLoader?.beginWait?.();

  // Producto y catálogo tienen una dependencia de datos crítica propia. Se
  // inicia antes del montaje visual del shell para que una demora de logo,
  // configuración o paneles no deje la ficha detrás del loader indefinido.
  // `loadSharedRuntime()` reutiliza la misma promesa y no duplica lecturas.
  const pageDataPromise = currentPage() === 'shop'
    ? loadProductsRuntime().catch(error => {
      console.warn('[PublicShell] No se pudo iniciar el catálogo crítico.', error);
      return null;
    })
    : Promise.resolve(null);

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
    await hydrateSharedLogos();

    const globalConfig = await globalConfigPromise;
    if (globalConfig?.layout) applyGlobalLayout(globalConfig.layout);
    else document.documentElement.dataset.ttGlobalLayout = 'fallback';
    if (globalConfig) applyGlobalVisualStudio(globalConfig);
    else document.documentElement.dataset.ttGlobalStudio = 'fallback';

    await waitForShellBrandImages();

    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');

    applyActiveState();
    enhanceMobileFooter();
    await registerNavigationSurfaces();
    loadSharedRuntime();
    void pageDataPromise;
    await import('../../quality/estabilidad-final-publica.js?v=tintin-20260829-final-stability-1');

    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
      detail: {
        architecture: 'modular-navigation-v1',
        socialNotifications: 'global',
        globalConfigRequests: 1,
        sharedLogoRequests: 1,
        finalStability: 'tintin-20260829-final-stability-1',
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
