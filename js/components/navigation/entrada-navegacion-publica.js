import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js?v=tintin-20260818-shell-unified-1';
import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js?v=tintin-20260818-shell-unified-1';
import { renderMobileTabbar } from './movil/encabezado-movil.js?v=tintin-20260815-routes-clean-1';
import { renderSearchPanel } from './compartido/panel-busqueda.js';
import { renderCartDrawer } from './compartido/panel-carrito.js';
import { renderAccountDrawer } from './compartido/panel-cuenta.js';
import { renderCollectionsSheet } from './compartido/panel-colecciones.js';
import { renderSurfaceLayer } from './compartido/capas-paneles.js';
import { applyActiveState, currentPage } from './compartido/estado-ruta.js';
import { ensureNavigationAssets } from './compartido/recursos-navegacion.js?v=tintin-20260818-shell-unified-1';
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

function safeInitialHeaderLogo(config) {
  const source = String(config?.layout?.header?.logo || '').trim();
  if (/^assets-tintin\/[A-Za-z0-9_./-]+$/.test(source)) return source;
  if (/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+$/i.test(source)) return source;
  return undefined;
}

function renderTopShell(initialLogo) {
  return [
    renderDesktopHeader(initialLogo),
    renderTabletHeader(initialLogo),
    renderSearchPanel(),
    renderTabletMenu(initialLogo),
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
    '#tt-header-desktop-tablet img, #tt-header-tablet img, #tt-tablet-menu img'
  )];
  await Promise.all(images.map(image => waitForImageReady(image)));
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

  mountPromise = Promise.all([navigationAssetsPromise, globalConfigPromise]).then(async ([, globalConfig]) => {
    if (document.body.classList.contains('tt-public-shell-mounted')) return;

    // El header se monta una sola vez con el logo final ya resuelto. Antes se
    // insertaba una imagen transparente y luego se cambiaba primero al logo
    // local y finalmente al logo configurado, lo que producía el parpadeo
    // visible en desktop/tablet. El loader permanece activo durante esta fase.
    const initialLogo = safeInitialHeaderLogo(globalConfig);
    removeLegacyShell();
    document.body.insertAdjacentHTML('afterbegin', renderTopShell(initialLogo));
    document.body.insertAdjacentHTML('beforeend', renderBottomShell());

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

    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
      detail: {
        architecture: 'modular-navigation-v1',
        socialNotifications: 'firestore-realtime-always-on',
        responsiveSurfaces: 'viewport-fit-v2',
        globalConfigRequests: 1,
        sharedLogoRequests: 0,
        initialHeaderLogoStable: true,
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
