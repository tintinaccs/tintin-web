import { renderDesktopHeader } from './desktop/header-desktop.js';
import { renderTabletHeader, renderTabletMenu } from './tablet/header-tablet.js';
import { renderMobileTabbar } from './mobile/header-mobile.js';
import { renderSearchPanel } from './shared/search-panel.js';
import { renderCartDrawer } from './shared/cart-drawer.js';
import { renderAccountDrawer } from './shared/account-drawer.js';
import { renderCollectionsSheet } from './shared/collections-sheet.js';
import { renderSurfaceLayer } from './shared/surface-layer.js';
import { applyActiveState, currentPage } from './shared/route-state.js';
import { ensureNavigationAssets } from './shared/assets.js';
import { loadSharedRuntime } from './shared/runtime.js';
import { enhanceMobileFooter } from './shared/footer-accordion.js';

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
  if (!document.body || document.body.classList.contains('tt-public-shell-mounted')) return;

  ensureNavigationAssets();
  removeLegacyShell();
  document.body.insertAdjacentHTML('afterbegin', renderTopShell());
  document.body.insertAdjacentHTML('beforeend', renderBottomShell());
  document.body.classList.add('tt-public-shell-mounted');
  document.body.classList.toggle('tt-public-shell-home', currentPage() === 'home');

  applyActiveState();
  enhanceMobileFooter();
  loadSharedRuntime();

  document.dispatchEvent(new CustomEvent('tintin:public-shell-ready', {
    detail: { architecture: 'modular-navigation-v1' },
  }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPublicShell, { once: true });
} else {
  mountPublicShell();
}
