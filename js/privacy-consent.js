import './cart-recovery.js?v=tintin-20260722-level4-1';
import { isAdminPage } from './admin-path.js?v=tintin-20260722-level4-1';

/**
 * Preferencias de privacidad del sitio.
 *
 * La cookie propia guarda únicamente la elección de la persona. El
 * almacenamiento esencial mantiene la sesión, el carrito y las preferencias;
 * las estadísticas y la ubicación aproximada solo se activan con permiso.
 */

const COOKIE_NAME = 'tt_privacy_choice';
const COOKIE_VERSION = 'v2';
const LEGACY_CONSENT_KEY = 'tt_activity_consent_v1';
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60;


let memoryChoice = '';
let preferenceOpener = null;

function cookiePath() {
  if (!/\.github\.io$/i.test(location.hostname)) return '/';
  const project = location.pathname.split('/').filter(Boolean)[0] || '';
  return project ? `/${project}/` : '/';
}

function readCookie() {
  const prefix = `${COOKIE_NAME}=`;
  const item = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : '';
}

function writeCookie(choice) {
  memoryChoice = choice;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(choice)}; Max-Age=${COOKIE_MAX_AGE}; Path=${cookiePath()}; SameSite=Lax${secure}`;
}

function readLegacyChoice() {
  try {
    const legacy = localStorage.getItem(LEGACY_CONSENT_KEY) || '';
    if (legacy === 'granted') return `${COOKIE_VERSION}.all`;
    if (legacy === 'denied') return `${COOKIE_VERSION}.necessary`;
  } catch {}
  return '';
}

function removeLegacyChoice() {
  try { localStorage.removeItem(LEGACY_CONSENT_KEY); } catch {}
}

function currentChoice() {
  const stored = readCookie() || memoryChoice;
  if (stored === `${COOKIE_VERSION}.all` || stored === `${COOKIE_VERSION}.necessary`) return stored;
  const migrated = readLegacyChoice();
  if (migrated) {
    writeCookie(migrated);
    removeLegacyChoice();
    return migrated;
  }
  return '';
}

export function privacyPreferences() {
  const choice = currentChoice();
  return {
    decided: Boolean(choice),
    necessary: true,
    statistics: choice === `${COOKIE_VERSION}.all`
  };
}

export function hasStatisticsConsent() {
  return privacyPreferences().statistics;
}

function emitChange() {
  const preferences = privacyPreferences();
  window.dispatchEvent(new CustomEvent('tintin:privacy-consent-change', { detail: preferences }));
}

function saveChoice(statistics) {
  writeCookie(`${COOKIE_VERSION}.${statistics ? 'all' : 'necessary'}`);
  removeLegacyChoice();
  document.getElementById('tt-privacy-consent')?.remove();
  emitChange();
  preferenceOpener?.focus?.();
  preferenceOpener = null;
}

function privacyUrl() {
  return new URL('privacidad.html', location.href).href;
}

function renderConsent(customize = false, focusDetails = false) {
  if (isAdminPage()) {
    document.getElementById('tt-privacy-consent')?.remove();
    return;
  }

  const existing = document.getElementById('tt-privacy-consent');
  if (existing) existing.remove();

  const preferences = privacyPreferences();
  const banner = document.createElement('section');
  banner.id = 'tt-privacy-consent';
  banner.className = `tt-privacy-consent${customize ? ' is-customizing' : ''}`;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookies y preferencias de privacidad');
  banner.innerHTML = `
    ${preferences.decided ? '<button type="button" class="tt-privacy-close" aria-label="Cerrar preferencias">×</button>' : ''}
    <div class="tt-privacy-heading">
      <span class="tt-privacy-icon" aria-hidden="true">🍪</span>
      <div>
        <div class="tt-privacy-eyebrow">Cookies y privacidad</div>
        <h2>Tu elección, sin interrumpirte</h2>
      </div>
    </div>
    <p class="tt-privacy-summary">Usamos una cookie para recordar tu elección y almacenamiento esencial para la sesión y el carrito. Con tu permiso también medimos visitas y ciudad o país aproximados, sin guardar IP, GPS ni ubicación exacta.</p>
    <div class="tt-privacy-actions">
      <button type="button" class="tt-privacy-btn tt-privacy-btn-primary" data-privacy-action="accept">Aceptar opcionales</button>
      <button type="button" class="tt-privacy-btn tt-privacy-btn-secondary" data-privacy-action="necessary">Solo necesarias</button>
      <button type="button" class="tt-privacy-link-btn" data-privacy-action="customize" aria-expanded="${customize}">Personalizar</button>
    </div>
    <div class="tt-privacy-details" ${customize ? '' : 'hidden'}>
      <div class="tt-privacy-option">
        <div><strong>Esenciales</strong><span>Inicio de sesión, seguridad, carrito y tu elección.</span></div>
        <span class="tt-privacy-required">Siempre activas</span>
      </div>
      <label class="tt-privacy-option" for="tt-privacy-statistics">
        <div><strong>Estadísticas opcionales</strong><span>Sesiones, páginas vistas y ubicación aproximada.</span></div>
        <input type="checkbox" id="tt-privacy-statistics" ${preferences.statistics ? 'checked' : ''}>
      </label>
      <div class="tt-privacy-details-actions">
        <a href="${privacyUrl()}">Política de privacidad</a>
        <button type="button" class="tt-privacy-btn tt-privacy-btn-primary" data-privacy-action="save">Guardar elección</button>
      </div>
    </div>`;

  banner.querySelector('[data-privacy-action="accept"]')?.addEventListener('click', () => saveChoice(true));
  banner.querySelector('[data-privacy-action="necessary"]')?.addEventListener('click', () => saveChoice(false));
  banner.querySelector('[data-privacy-action="customize"]')?.addEventListener('click', () => renderConsent(true, true));
  banner.querySelector('[data-privacy-action="save"]')?.addEventListener('click', () => {
    saveChoice(Boolean(banner.querySelector('#tt-privacy-statistics')?.checked));
  });
  banner.querySelector('.tt-privacy-close')?.addEventListener('click', () => {
    banner.remove();
    preferenceOpener?.focus?.();
    preferenceOpener = null;
  });

  if (document.getElementById('tt-welcome-tutorial')) banner.hidden = true;
  document.body.appendChild(banner);
  if (focusDetails) window.requestAnimationFrame(() => banner.querySelector('#tt-privacy-statistics')?.focus());
}

export function openPrivacyPreferences() {
  if (!document.body || isAdminPage()) return;
  preferenceOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderConsent(true, true);
}

export function onPrivacyConsentChange(listener) {
  const handler = event => listener(event.detail || privacyPreferences());
  window.addEventListener('tintin:privacy-consent-change', handler);
  return () => window.removeEventListener('tintin:privacy-consent-change', handler);
}

function showInitialChoice() {
  if (!document.body || isAdminPage() || privacyPreferences().decided) {
    if (isAdminPage()) document.getElementById('tt-privacy-consent')?.remove();
    return;
  }
  renderConsent(false);
}

window.TintinActivityPrivacy = {
  open: openPrivacyPreferences,
  get choice() { return hasStatisticsConsent() ? 'granted' : (privacyPreferences().decided ? 'denied' : 'unset'); },
  get preferences() { return privacyPreferences(); }
};

window.addEventListener('tintin:welcome:opened', () => {
  const banner = document.getElementById('tt-privacy-consent');
  if (banner) banner.hidden = true;
});
window.addEventListener('tintin:welcome:closed', () => {
  if (isAdminPage()) {
    document.getElementById('tt-privacy-consent')?.remove();
    return;
  }
  const banner = document.getElementById('tt-privacy-consent');
  if (banner) banner.hidden = false;
  else if (!privacyPreferences().decided) showInitialChoice();
});

if (document.body) showInitialChoice();
else document.addEventListener('DOMContentLoaded', showInitialChoice, { once: true });
