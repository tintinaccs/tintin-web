import { versionedSiteAsset } from './configuracion.js';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/components/navigation/escritorio/encabezado-escritorio.css'],
  ['tt-navigation-tablet-css', 'css/components/navigation/tableta/encabezado-tableta.css'],
  ['tt-navigation-mobile-css', 'css/components/navigation/movil/encabezado-movil.css'],
  ['tt-navigation-mobile-solid-css', 'css/components/navigation/movil/fondos-solidos-movil.css'],
  ['tt-navigation-notifications-css', 'css/components/notifications/notificaciones-sociales.css'],
  ['tt-navigation-shared-css', 'css/components/navigation/compartido/transiciones-navegacion.css'],
  ['tt-surface-controller-css', 'css/components/navigation/compartido/paneles.css'],
  ['tt-navigation-search-css', 'css/components/navigation/compartido/busqueda.css'],
]);

function stylesheetForPath(path) {
  const expectedPath = new URL(path, window.location.href).pathname;
  return [...document.querySelectorAll('link[rel~="stylesheet"][href]')].find(link => {
    try {
      return new URL(link.href, window.location.href).pathname === expectedPath;
    } catch {
      return false;
    }
  }) || null;
}

function markStylesheet(link, id) {
  if (!link.id) link.id = id;
  if (id === 'tt-navigation-notifications-css') link.dataset.ttSocialNotifications = '1';
  return link;
}

function waitForStylesheet(link) {
  if (link.sheet) return Promise.resolve(link);
  return new Promise(resolve => {
    const finish = () => resolve(link);
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
  });
}

function ensureStylesheet(id, path) {
  const expectedHref = versionedSiteAsset(path);
  const existing = document.getElementById(id) || stylesheetForPath(path);
  if (existing) {
    markStylesheet(existing, id);
    if (existing.href === expectedHref) return waitForStylesheet(existing);

    return new Promise(resolve => {
      const finish = () => resolve(existing);
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', finish, { once: true });
      existing.href = expectedHref;
    });
  }

  return new Promise(resolve => {
    const link = markStylesheet(document.createElement('link'), id);
    link.rel = 'stylesheet';
    link.href = expectedHref;
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
