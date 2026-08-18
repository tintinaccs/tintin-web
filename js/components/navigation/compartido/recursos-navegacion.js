import { versionedSiteAsset } from './configuracion.js?v=tintin-20260818-responsive-shell-realtime-1';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/components/navigation/escritorio/encabezado-escritorio.css'],
  ['tt-navigation-tablet-css', 'css/components/navigation/tableta/encabezado-tableta.css'],
  ['tt-navigation-mobile-css', 'css/components/navigation/movil/encabezado-movil.css'],
  ['tt-navigation-shared-css', 'css/components/navigation/compartido/transiciones-navegacion.css'],
  ['tt-surface-controller-css', 'css/components/navigation/compartido/paneles.css'],
  ['tt-navigation-search-css', 'css/components/navigation/compartido/busqueda.css'],
  ['tt-navigation-responsive-hardening-css', 'css/components/navigation/compartido/responsive-shell-hardening.css'],
]);

function ensureStylesheet(id, path) {
  const existing = document.getElementById(id);
  if (existing) {
    const expectedHref = versionedSiteAsset(path);
    if (existing.href !== expectedHref) existing.href = expectedHref;
    return Promise.resolve(existing);
  }

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
