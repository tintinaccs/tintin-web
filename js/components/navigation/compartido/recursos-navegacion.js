import { LEGACY_NAV_STYLE_VERSION, SHELL_VERSION, versionedSiteAsset } from './configuracion.js';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/components/navigation/escritorio/encabezado-escritorio.css', SHELL_VERSION],
  ['tt-navigation-tablet-css', 'css/components/navigation/tableta/encabezado-tableta.css', SHELL_VERSION],
  ['tt-navigation-mobile-css', 'css/components/navigation/movil/encabezado-movil.css', SHELL_VERSION],
  ['tt-navigation-shared-css', 'css/components/navigation/compartido/transiciones-navegacion.css', LEGACY_NAV_STYLE_VERSION],
  ['tt-surface-controller-css', 'css/components/navigation/compartido/paneles.css', LEGACY_NAV_STYLE_VERSION],
  ['tt-navigation-search-css', 'css/components/navigation/compartido/busqueda.css', LEGACY_NAV_STYLE_VERSION],
]);

function ensureStylesheet(id, path, version) {
  const expectedHref = versionedSiteAsset(path, version);
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.href !== expectedHref) existing.href = expectedHref;
    return Promise.resolve(existing);
  }

  return new Promise(resolve => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = expectedHref;
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => resolve(link), { once: true });
    document.head.appendChild(link);
  });
}

export function ensureNavigationAssets() {
  document.documentElement.classList.add('tt-navigation-styles-loading');
  const pending = NAVIGATION_STYLES.map(([id, path, version]) => ensureStylesheet(id, path, version));
  return Promise.all(pending).finally(() => {
    document.documentElement.classList.remove('tt-navigation-styles-loading');
    document.documentElement.classList.add('tt-navigation-styles-ready');
  });
}
