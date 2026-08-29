import { versionedSiteAsset } from './configuracion.js';

const HEADER_RESPONSIVE_VERSION = 'tintin-20260824-header-responsive-sync-1';
const NAVIGATION_SHARED_VERSION = 'tintin-20260825-responsive-css-budget-2';
const MOBILE_SOLID_VERSION = 'tintin-20260817-cls-desktop-stable-3';
const NOTIFICATIONS_VERSION = 'tintin-20260825-notifications-badge-external-1';

const NAVIGATION_STYLES = Object.freeze([
  ['tt-navigation-desktop-css', 'css/components/navigation/escritorio/encabezado-escritorio.css', HEADER_RESPONSIVE_VERSION],
  ['tt-navigation-tablet-css', 'css/components/navigation/tableta/encabezado-tableta.css', HEADER_RESPONSIVE_VERSION],
  ['tt-navigation-mobile-css', 'css/components/navigation/movil/encabezado-movil.css', HEADER_RESPONSIVE_VERSION],
  ['tt-navigation-mobile-solid-css', 'css/components/navigation/movil/fondos-solidos-movil.css', MOBILE_SOLID_VERSION],
  ['tt-navigation-notifications-css', 'css/components/notifications/notificaciones-sociales.css', NOTIFICATIONS_VERSION],
  ['tt-navigation-shared-css', 'css/components/navigation/compartido/transiciones-navegacion.css', NAVIGATION_SHARED_VERSION],
  ['tt-surface-controller-css', 'css/components/navigation/compartido/paneles.css', NAVIGATION_SHARED_VERSION],
  ['tt-navigation-notification-surface-css', 'css/components/navigation/compartido/superficie-notificaciones.css', HEADER_RESPONSIVE_VERSION],
  ['tt-navigation-search-css', 'css/components/navigation/compartido/busqueda.css', NAVIGATION_SHARED_VERSION],
]);

function versionedStyleHref(path, version) {
  const url = new URL(versionedSiteAsset(path));
  url.searchParams.set('v', version);
  return url.href;
}

function stylesheetForPath(path) {
  const expectedPath = new URL(versionedSiteAsset(path)).pathname;
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

function awaitStylesheetEvent(link, ceilingMs = 2200) {
  return new Promise(resolve => {
    let settled = false;
    let timer = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve(link);
    };
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
    timer = window.setTimeout(finish, ceilingMs);
  });
}

function waitForStylesheet(link, ceilingMs = 2200) {
  if (link.sheet) return Promise.resolve(link);
  return awaitStylesheetEvent(link, ceilingMs);
}

function reloadStylesheet(link, href) {
  const ready = awaitStylesheetEvent(link);
  link.href = href;
  return ready;
}

function ensureStylesheet(id, path, version) {
  const expectedHref = versionedStyleHref(path, version);
  const existing = document.getElementById(id) || stylesheetForPath(path);
  if (existing) {
    markStylesheet(existing, id);
    if (existing.href === expectedHref) return waitForStylesheet(existing);
    return reloadStylesheet(existing, expectedHref);
  }

  const link = markStylesheet(document.createElement('link'), id);
  link.rel = 'stylesheet';
  // No descargues las tres variantes del header en cada dispositivo. El
  // atributo media también mantiene la cascada disponible para el viewport
  // correcto sin bloquear el primer paint con CSS que no se aplicará.
  if (id === 'tt-navigation-desktop-css') link.media = '(min-width: 1025px)';
  if (id === 'tt-navigation-tablet-css') link.media = '(min-width: 768px) and (max-width: 1024px)';
  if (id === 'tt-navigation-mobile-css' || id === 'tt-navigation-mobile-solid-css') link.media = '(max-width: 767px)';
  link.href = expectedHref;
  const ready = waitForStylesheet(link);
  document.head.appendChild(link);
  return ready;
}

export function ensureNavigationAssets() {
  document.documentElement.classList.add('tt-navigation-styles-loading');
  const pending = NAVIGATION_STYLES.map(([id, path, version]) => ensureStylesheet(id, path, version));
  return Promise.all(pending).finally(() => {
    document.documentElement.classList.remove('tt-navigation-styles-loading');
    document.documentElement.classList.add('tt-navigation-styles-ready');
  });
}
