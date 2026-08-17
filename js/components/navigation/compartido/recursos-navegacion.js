import { HEADER_BRAND_VERSION, versionedSiteAsset } from './configuracion.js?v=tintin-20260817-header-logo-mobilebar-1';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/components/navigation/escritorio/encabezado-escritorio.css', HEADER_BRAND_VERSION],
  ['tt-navigation-tablet-css', 'css/components/navigation/tableta/encabezado-tableta.css'],
  ['tt-navigation-mobile-css', 'css/components/navigation/movil/encabezado-movil.css', HEADER_BRAND_VERSION],
  ['tt-navigation-shared-css', 'css/components/navigation/compartido/transiciones-navegacion.css'],
  ['tt-surface-controller-css', 'css/components/navigation/compartido/paneles.css'],
  ['tt-navigation-search-css', 'css/components/navigation/compartido/busqueda.css'],
]);

function ensureStylesheet(id, path, version) {
  const existing = document.getElementById(id);
  const expectedHref = versionedSiteAsset(path, version);
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
