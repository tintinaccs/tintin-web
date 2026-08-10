import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js';
import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js';
import { renderMobileTabbar } from './movil/encabezado-movil.js';
import { renderSearchPanel } from './compartido/panel-busqueda.js';
import { renderCartDrawer } from './compartido/panel-carrito.js';
import { renderAccountDrawer } from './compartido/panel-cuenta.js';
import { renderCollectionsSheet } from './compartido/panel-colecciones.js';
import { renderSurfaceLayer } from './compartido/capas-paneles.js';
import { applyActiveState, currentPage } from './compartido/estado-ruta.js';
import { ensureNavigationAssets } from './compartido/recursos-navegacion.js';
import { loadSharedRuntime } from './compartido/carga-navegacion.js';
import { enhanceMobileFooter } from './compartido/acordeon-pie-pagina.js';
import { registerNavigationSurfaces } from './compartido/registro-paneles.js';
import { initGlobalVisualStudio } from '../../core/store/visual-studio-global-runtime.js?v=tintin-20260810-global-studio-1';

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

function mountPublicShell() {
  if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return Promise.resolve();
  if (mountPromise) return mountPromise;

  document.body.classList.add('tt-public-shell-mounting');
  mountPromise = ensureNavigationAssets().then(async () => {
    if (document.body.classList.contains('tt-public-shell-mounted')) return;

    removeLegacyShell();
    document.body.insertAdjacentHTML('afterbegin', renderTopShell());
    document.body.insertAdjacentHTML('beforeend', renderBottomShell());
    document.body.classList.add('tt-public-shell-mounted');
    document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');

    applyActiveState();
    enhanceMobileFooter();
    await registerNavigationSurfaces();
    loadSharedRuntime();

    document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
      detail: { architecture: 'modular-navigation-v1' },
    }));
  }).catch(error => {
    console.error('[PublicShell] No se pudo montar la navegación.', error);
    document.dispatchEvent(new CustomEvent('tintin:public-shell-error', { detail: { error } }));
    throw error;
  }).finally(() => {
    document.body?.classList.remove('tt-public-shell-mounting');
  });

  return mountPromise;
}

function startPublicExperience() {
  void initGlobalVisualStudio();
  void mountPublicShell();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPublicExperience, { once: true });
} else {
  startPublicExperience();
}
