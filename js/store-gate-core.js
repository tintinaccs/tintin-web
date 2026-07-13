/**
 * TINTIN — Núcleo único de "Tienda abierta/cerrada".
 *
 * Documento público mínimo: settings/storeGate.
 * La configuración completa permanece en settings/general y no se entrega
 * cuando la tienda está cerrada.
 */
import { db } from './firebase.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js';

const OVERLAY_ID = 'tt-store-closed-overlay';
const STYLE_ID = 'tt-store-gate-style';
const LOGIN_CONTROL_ID = 'tt-store-gate-login';
const STORE_GATE_REF = doc(db, 'settings', 'storeGate');
const LEGACY_GENERAL_REF = doc(db, 'settings', 'general');

let lastConfig = {
  storeOpen: false,
  maintenanceAccess: {},
  __storeConfigStatus: 'pending'
};
let desiredOverlay = null;
let guardObserver = null;
let repairScheduled = false;
const lockedNodes = new Map();

function isGateNode(node) {
  return node?.id === OVERLAY_ID || node?.id === 'tt-loader';
}

function injectGateStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html.tt-store-gate-pending,
    html.tt-store-gate-blocked {
      background: #FFF6FA !important;
    }

    html.tt-store-gate-pending body > *:not(#tt-loader):not(#${OVERLAY_ID}),
    html.tt-store-gate-blocked body > *:not(#tt-loader):not(#${OVERLAY_ID}) {
      visibility: hidden !important;
      pointer-events: none !important;
      user-select: none !important;
    }

    html.tt-store-gate-pending body,
    html.tt-store-gate-blocked body {
      overflow: hidden !important;
      overscroll-behavior: none !important;
    }

    #${OVERLAY_ID},
    #${OVERLAY_ID} * {
      visibility: visible !important;
      pointer-events: auto !important;
      user-select: auto !important;
    }
  `;
  document.head.appendChild(style);
}

injectGateStyle();

function rememberConfig(cfg) {
  lastConfig = cfg || lastConfig;
  return lastConfig;
}

function bodyReady(callback) {
  if (document.body) {
    callback();
    return;
  }
  document.addEventListener('DOMContentLoaded', callback, { once: true });
}

function rememberAndLockNode(node) {
  if (!(node instanceof HTMLElement) || isGateNode(node)) return;

  if (!lockedNodes.has(node)) {
    lockedNodes.set(node, {
      inert: node.inert === true,
      ariaHidden: node.hasAttribute('aria-hidden')
        ? node.getAttribute('aria-hidden')
        : null,
      hadAriaHidden: node.hasAttribute('aria-hidden')
    });
  }

  node.inert = true;
  node.setAttribute('aria-hidden', 'true');
}

function lockPageContent() {
  if (!document.body) return;
  Array.from(document.body.children).forEach(rememberAndLockNode);
}

function restoreEmergencyLock(node) {
  if (!(node instanceof HTMLElement) || node.dataset.ttEmergencyInert !== '1') return;

  node.inert = node.dataset.ttEmergencyPrevInert === '1';
  if (node.dataset.ttEmergencyHadAria === '1') {
    node.setAttribute('aria-hidden', node.dataset.ttEmergencyPrevAria || '');
  } else {
    node.removeAttribute('aria-hidden');
  }

  delete node.dataset.ttEmergencyInert;
  delete node.dataset.ttEmergencyPrevInert;
  delete node.dataset.ttEmergencyHadAria;
  delete node.dataset.ttEmergencyPrevAria;
}

function restorePageContent() {
  lockedNodes.forEach((previous, node) => {
    if (!(node instanceof HTMLElement)) return;

    node.inert = previous.inert;
    if (previous.hadAriaHidden) {
      node.setAttribute('aria-hidden', previous.ariaHidden ?? '');
    } else {
      node.removeAttribute('aria-hidden');
    }
  });
  lockedNodes.clear();

  if (document.body) {
    Array.from(document.body.children).forEach(restoreEmergencyLock);
  }
}

export function normalizeStoreAccessConfig(data, status = 'ok') {
  const raw = data && typeof data === 'object' ? data : {};
  const maintenanceAccess =
    raw.maintenanceAccess &&
    typeof raw.maintenanceAccess === 'object' &&
    !Array.isArray(raw.maintenanceAccess)
      ? raw.maintenanceAccess
      : {};

  return {
    storeOpen: raw.storeOpen === true,
    maintenanceAccess,
    __storeConfigStatus: status
  };
}

export function getLastStoreAccessConfig() {
  return lastConfig;
}

function currentRelativeLocation() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return file + window.location.search + window.location.hash;
}

/**
 * Construye una URL absoluta dentro de la misma carpeta de la aplicación.
 * Así funciona tanto en GitHub Pages (/tintin-web/) como en dominio propio.
 */
function buildLoginUrl() {
  const pathname = window.location.pathname || '/';
  const lastSlash = pathname.lastIndexOf('/');
  const appDirectory = pathname.endsWith('/')
    ? pathname
    : pathname.slice(0, lastSlash + 1);
  const loginUrl = new URL(`${appDirectory}login.html`, window.location.origin);
  loginUrl.searchParams.set('from', currentRelativeLocation());
  return loginUrl.href;
}

function goToLogin(event) {
  event?.preventDefault();
  event?.stopPropagation();

  // No dependemos únicamente del comportamiento normal de un <a>. Algunas
  // páginas públicas tienen manejadores globales de clic y, durante el cierre,
  // además existe una capa de bloqueo. La navegación se ordena directamente.
  window.location.assign(buildLoginUrl());
}

function isLoginPage() {
  const path = (window.location.pathname || '').toLowerCase();
  return path.endsWith('/login.html') || path.endsWith('/login');
}

function showLoginClosedNotice(kind) {
  removeStoreClosedOverlay();

  const error = document.getElementById('login-error');
  if (!error) return;

  error.textContent =
    kind === 'unavailable'
      ? 'No pudimos comprobar el estado de la tienda. Por seguridad no se habilitó el acceso. Probá nuevamente en unos minutos.'
      : 'La tienda está cerrada. Esta cuenta no tiene permiso de mantenimiento. Podés intentar con otra cuenta autorizada.';
  error.classList.add('show');
}

function buildOverlayHtml(kind) {
  const unavailable = kind === 'unavailable';
  const title = unavailable
    ? 'No pudimos comprobar el estado de la tienda'
    : 'Tienda temporalmente cerrada';
  const message = unavailable
    ? 'Por seguridad, el sitio permanece bloqueado hasta que podamos confirmar su estado.'
    : 'En este momento la tienda no está disponible. Solo puede ingresar el equipo autorizado.';
  const retryButton = unavailable
    ? '<button type="button" id="tt-store-gate-retry" style="border:0;background:#8b2642;color:#fff;padding:12px 26px;border-radius:50px;font-weight:700;font-size:13px;cursor:pointer">Reintentar</button>'
    : '';

  return `
    <div role="dialog" aria-modal="true" aria-labelledby="tt-store-gate-title"
      style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:36px 28px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.25);box-sizing:border-box">
      <div style="font-size:40px;margin-bottom:14px">${unavailable ? '⚠️' : '🌙'}</div>
      <div id="tt-store-gate-title"
        style="font-weight:800;font-size:19px;color:#8b2642;margin-bottom:12px">${title}</div>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 26px">${message}</p>
      <div style="display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap">
        ${retryButton}
        <a id="${LOGIN_CONTROL_ID}" href="${buildLoginUrl()}" target="_self"
          style="display:inline-block;background:#fff;color:#8b2642!important;border:1.5px solid #d9a9b8;padding:11px 24px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer">Iniciar sesión</a>
      </div>
    </div>`;
}

function scheduleRepair() {
  if (!desiredOverlay || repairScheduled) return;
  repairScheduled = true;

  queueMicrotask(() => {
    repairScheduled = false;
    if (!desiredOverlay) return;

    injectGateStyle();
    document.documentElement.classList.remove('tt-store-gate-pending');
    document.documentElement.classList.add('tt-store-gate-blocked');
    lockPageContent();

    if (!document.getElementById(OVERLAY_ID)) {
      insertOverlay(desiredOverlay, lastConfig);
    }
  });
}

function startGuardObserver() {
  if (guardObserver) return;

  guardObserver = new MutationObserver(scheduleRepair);

  guardObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  if (document.head) {
    guardObserver.observe(document.head, { childList: true });
  }

  if (document.body) {
    guardObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'aria-hidden']
    });
  }
}

function stopGuardObserver() {
  guardObserver?.disconnect();
  guardObserver = null;
  repairScheduled = false;
}

function bindOverlayActions(overlay) {
  // El propio overlay siempre debe ser interactivo, aunque haya sido reutilizado
  // desde la pantalla de emergencia del cargador.
  overlay.inert = false;
  overlay.removeAttribute('inert');
  overlay.removeAttribute('aria-hidden');
  overlay.style.pointerEvents = 'auto';

  overlay
    .querySelector('#tt-store-gate-retry')
    ?.addEventListener('click', () => window.location.reload());

  const loginControl = overlay.querySelector(`#${LOGIN_CONTROL_ID}`);
  if (loginControl) {
    loginControl.inert = false;
    loginControl.removeAttribute('inert');
    loginControl.removeAttribute('aria-hidden');
    loginControl.addEventListener('click', goToLogin, { capture: true });
  }
}

function insertOverlay(kind, cfg = lastConfig) {
  desiredOverlay = kind;
  rememberConfig(cfg);
  injectGateStyle();

  bodyReady(() => {
    if (!desiredOverlay) return;

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:2147482990;background:rgba(30,10,18,.62);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;pointer-events:auto';
      document.body.appendChild(overlay);
    }

    overlay.dataset.kind = kind;
    overlay.innerHTML = buildOverlayHtml(kind);

    document.documentElement.classList.remove('tt-store-gate-pending');
    document.documentElement.classList.add('tt-store-gate-blocked');
    lockPageContent();
    startGuardObserver();
    bindOverlayActions(overlay);
  });
}

export function renderStoreClosedOverlay(cfg = lastConfig) {
  const resolved = rememberConfig(cfg || lastConfig);
  if (isLoginPage()) {
    showLoginClosedNotice(
      resolved.__storeConfigStatus === 'ok' ? 'closed' : 'unavailable'
    );
    return;
  }
  if (resolved.__storeConfigStatus !== 'ok') {
    insertOverlay('unavailable', resolved);
    return;
  }
  insertOverlay('closed', resolved);
}

export function renderStoreConfigUnavailableOverlay(cfg = lastConfig) {
  const resolved = rememberConfig(cfg || lastConfig);
  if (isLoginPage()) {
    showLoginClosedNotice('unavailable');
    return;
  }
  insertOverlay('unavailable', resolved);
}

export function removeStoreClosedOverlay() {
  desiredOverlay = null;
  stopGuardObserver();
  document.getElementById(OVERLAY_ID)?.remove();
  restorePageContent();
  document.documentElement.classList.remove(
    'tt-store-gate-pending',
    'tt-store-gate-blocked'
  );
}

export function getDesiredStoreOverlay() {
  return desiredOverlay;
}

/**
 * Lectura puntual usada por login.html, admin.html y revalidaciones.
 * Si el documento falta o la lectura falla, nunca se asume "abierta".
 */
export async function getStoreAccessConfig() {
  let primaryStatus = 'missing';

  try {
    const snap = await getDoc(STORE_GATE_REF);
    if (snap.exists()) {
      return rememberConfig(normalizeStoreAccessConfig(snap.data(), 'ok'));
    }
  } catch (error) {
    primaryStatus = 'error';
    console.warn(
      '[store-gate] settings/storeGate aún no está disponible; se prueba la configuración anterior durante la migración:',
      error
    );
  }

  // Compatibilidad de despliegue: permite publicar primero el JavaScript y
  // después las reglas sin abrir ni romper la tienda. Con las reglas finales,
  // settings/general deja de ser público durante el cierre.
  try {
    const legacySnap = await getDoc(LEGACY_GENERAL_REF);
    if (legacySnap.exists()) {
      return rememberConfig({
        ...normalizeStoreAccessConfig(legacySnap.data(), 'ok'),
        __storeConfigSource: 'legacy-general'
      });
    }
  } catch (legacyError) {
    console.error(
      '[store-gate] Tampoco se pudo leer la configuración anterior:',
      legacyError
    );
  }

  return rememberConfig(normalizeStoreAccessConfig({}, primaryStatus));
}

/**
 * Super Admin se reconoce únicamente por el correo oficial.
 * Los demás dependen del estado y de maintenanceAccess.
 */
export function isAccessAllowed(cfg, role, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail === SUPER_ADMIN.toLowerCase()) return true;
  if (!cfg || cfg.__storeConfigStatus !== 'ok') return false;
  if (cfg.storeOpen === true) return true;

  const access = cfg.maintenanceAccess || {};
  return access[role || 'guest'] === true;
}
