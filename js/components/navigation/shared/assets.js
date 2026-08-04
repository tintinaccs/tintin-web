import { versionedSiteAsset } from './config.js';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/navigation-desktop.css'],
  ['tt-navigation-tablet-css', 'css/navigation-tablet.css'],
  ['tt-navigation-mobile-css', 'css/navigation-mobile.css'],
  ['tt-navigation-shared-css', 'css/navigation-shared.css'],
  ['tt-surface-controller-css', 'css/surface-controller.css'],
]);

function ensureStylesheet(id, path) {
  const existing = document.getElementById(id);
  if (existing) return Promise.resolve(existing);

  return new Promise(resolve => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = versionedSiteAsset(path);
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => resolve(link), { once: true });
    document.head.appendChild(link);
  });
}

export function ensureNavigationAssets() {
  document.documentElement.classList.add('tt-navigation-styles-loading');
  const pending = NAVIGATION_STYLES.map(([id, path]) => ensureStylesheet(id, path));
  return Promise.all(pending).finally(() => {
    document.documentElement.classList.remove('tt-navigation-styles-loading');
    document.documentElement.classList.add('tt-navigation-styles-ready');
  });
}
