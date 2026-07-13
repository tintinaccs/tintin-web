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
const DIALOG_CLASS = 'tt-store-gate-dialog';
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

    #${OVERLAY_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147482990 !important;
      display: grid !important;
      place-items: center !important;
      width: 100% !important;
      min-height: 100vh !important;
      min-height: 100dvh !important;
      padding: clamp(16px, 3vw, 32px) !important;
      box-sizing: border-box !important;
      overflow: auto !important;
      overscroll-behavior: contain !important;
      background: rgba(30, 10, 18, .62) !important;
      backdrop-filter: blur(7px) !important;
      -webkit-backdrop-filter: blur(7px) !important;
      visibility: visible !important;
      pointer-events: auto !important;
      user-select: auto !important;
      touch-action: manipulation !important;
    }

    #${OVERLAY_ID},
    #${OVERLAY_ID} * {
      visibility: visible !important;
      box-sizing: border-box !important;
    }

    #${OVERLAY_ID} .${DIALOG_CLASS} {
      width: min(100%, 460px) !important;
      max-height: calc(100dvh - clamp(32px, 6vw, 64px)) !important;
      margin: auto !important;
      padding: clamp(28px, 5vw, 40px) clamp(22px, 5vw, 34px) !important;
      overflow: auto !important;
      border: 1px solid rgba(212, 106, 138, .14) !important;
      border-radius: 20px !important;
      background: #fff !important;
      color: #2f2529 !important;
      text-align: center !important;
      box-shadow: 0 18px 60px rgba(35, 12, 22, .28) !important;
      pointer-events: auto !important;
    }

    #${OVERLAY_ID} .tt-store-gate-icon {
      display: block !important;
      margin: 0 0 16px !important;
      font-size: clamp(34px, 7vw, 42px) !important;
      line-height: 1 !important;
    }

    #${OVERLAY_ID} .tt-store-gate-title {
      margin: 0 0 12px !important;
      color: #8b2642 !important;
      font: 800 clamp(19px, 3.2vw, 22px)/1.25 Poppins, Arial, sans-serif !important;
      overflow-wrap: anywhere !important;
    }

    #${OVERLAY_ID} .tt-store-gate-message {
      max-width: 360px !important;
      margin: 0 auto 26px !important;
      color: #555 !important;
      font: 400 clamp(13px, 2.4vw, 14px)/1.65 Poppins, Arial, sans-serif !important;
    }

    #${OVERLAY_ID} .tt-store-gate-actions {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 10px !important;
      width: 100% !important;
    }

    #${OVERLAY_ID} .tt-store-gate-action {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 146px !important;
      min-height: 46px !important;
      padding: 11px 24px !important;
      border-radius: 999px !important;
      font: 700 13px/1.2 Poppins, Arial, sans-serif !important;
      text-align: center !important;
      text-decoration: none !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      touch-action: manipulation !important;
      -webkit-tap-highlight-color: transparent !important;
    }

    #${LOGIN_CONTROL_ID} {
      border: 1.5px solid #d9a9b8 !important;
      background: #fff !important;
      color: #8b2642 !important;
    }

    #${LOGIN_CONTROL_ID}:hover,
    #${LOGIN_CONTROL_ID}:focus-visible {
      border-color: #8b2642 !important;
      background: #fff6fa !important;
      outline: 3px solid rgba(212, 106, 138, .22) !important;
      outline-offset: 2px !important;
    }

    #tt-store-gate-retry {
      border: 0 !important;
      background: #8b2642 !important;
      color: #fff !important;
    }

    @media (max-width: 600px) {
      #${OVERLAY_ID} {
        align-items: center !important;
        padding-top: max(16px, env(safe-area-inset-top)) !important;
        padding-right: max(14px, env(safe-area-inset-right)) !important;
        padding-bottom: max(16px, env(safe-area-inset-bottom)) !important;
        padding-left: max(14px, env(safe-area-inset-left)) !important;
      }

      #${OVERLAY_ID} .${DIALOG_CLASS} {
        width: 100% !important;
        max-width: 390px !important;
        max-height: calc(100dvh - 32px) !important;
        padding: 28px 20px 24px !important;
        border-radius: 18px !important;
      }

      #${OVERLAY_ID} .tt-store-gate-actions {
        flex-direction: column !important;
      }

      #${OVERLAY_ID} .tt-store-gate-action {
        width: min(100%, 260px) !important;
        min-width: 0 !important;
      }
    }

    @media (min-width: 601px) and (max-width: 1024px) {
      #${OVERLAY_ID} .${DIALOG_CLASS} {
        width: min(86vw, 500px) !important;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #${OVERLAY_ID} *,
      #${OVERLAY_ID} *::before,
      #${OVERLAY_ID} *::after {
        scroll-behavior: auto !important;
        transition: none !important;
        animation: none !important;
      }
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

  // Importante: solo escribe cuando hace falta. La versión anterior volvía a
  // escribir los mismos atributos dentro del MutationObserver y podía formar
  // un ciclo continuo que dejaba visible el botón, pero sin procesar el clic.
  if (!node.inert) node.inert = true;
  if (node.getAttribute('aria-hidden') !== 'true') {
    node.setAttribute('aria-hidden', 'true');
  }
}

function lockPageContent() {
  if (!document.body) return;
  Array.from(document.body.children).forEach(rememberAndLockNode);
}

function isPageContentLocked() {
  if (!document.body) return false;

  return Array.from(document.body.children).every(node => {
    if (!(node instanceof HTMLElement) || isGateNode(node)) return true;
    return node.inert === true && node.getAttribute('aria-hidden') === 'true';
  });
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

function goToLogin(event, explicitUrl = '') {
  event?.preventDefault();
  event?.stopImmediatePropagation?.();
  event?.stopPropagation?.();

  const destination = explicitUrl || buildLoginUrl();
  document.documentElement.dataset.ttStoreGateNavigating = 'login';
  window.location.assign(destination);
}

// Se registra en window y en fase de captura: corre antes que los manejadores
// generales de la página. Sirve con mouse, toque y activación por teclado.
if (!window.__TintinStoreGateLoginCaptureBound) {
  window.__TintinStoreGateLoginCaptureBound = true;
  window.addEventListener(
    'click',
    event => {
      const path = typeof event.composedPath === 'function'
        ? event.composedPath()
        : [];
      const control = path.find(node => node?.id === LOGIN_CONTROL_ID) ||
        event.target?.closest?.(`#${LOGIN_CONTROL_ID}`);
      if (!control) return;
      goToLogin(event, control.href || buildLoginUrl());
    },
    true
  );
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
    ? '<button type="button" id="tt-store-gate-retry" class="tt-store-gate-action">Reintentar</button>'
    : '';

  return `
    <section class="${DIALOG_CLASS}" role="dialog" aria-modal="true" aria-labelledby="tt-store-gate-title" aria-describedby="tt-store-gate-message">
      <span class="tt-store-gate-icon" aria-hidden="true">${unavailable ? '⚠️' : '🌙'}</span>
      <h1 id="tt-store-gate-title" class="tt-store-gate-title">${title}</h1>
      <p id="tt-store-gate-message" class="tt-store-gate-message">${message}</p>
      <div class="tt-store-gate-actions">
        ${retryButton}
        <a id="${LOGIN_CONTROL_ID}" class="tt-store-gate-action" href="${buildLoginUrl()}" target="_self">Iniciar sesión</a>
      </div>
    </section>`;
}

function overlayNeedsRepair() {
  if (!desiredOverlay) return false;
  if (!document.getElementById(STYLE_ID)) return true;
  if (!document.documentElement.classList.contains('tt-store-gate-blocked')) return true;

  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return true;
  if (!overlay.querySelector(`.${DIALOG_CLASS}`)) return true;
  if (!overlay.querySelector(`#${LOGIN_CONTROL_ID}`)) return true;
  if (overlay.inert === true) return true;
  if (overlay.getAttribute('aria-hidden') === 'true') return true;
  if (overlay.style.pointerEvents === 'none') return true;
  if (!isPageContentLocked()) return true;

  return false;
}

function bindOverlayActions(overlay) {
  overlay.inert = false;
  overlay.removeAttribute('inert');
  overlay.removeAttribute('aria-hidden');
  overlay.style.pointerEvents = 'auto';
  overlay.style.touchAction = 'manipulation';

  const loginControl = overlay.querySelector(`#${LOGIN_CONTROL_ID}`);
  if (loginControl) {
    loginControl.inert = false;
    loginControl.removeAttribute('inert');
    loginControl.removeAttribute('aria-hidden');
    loginControl.setAttribute('role', 'button');
    loginControl.setAttribute('aria-label', 'Iniciar sesión para acceder como equipo autorizado');
  }

  if (overlay.dataset.ttGateActionsBound === '1') return;
  overlay.dataset.ttGateActionsBound = '1';

  overlay.addEventListener(
    'click',
    event => {
      const retry = event.target?.closest?.('#tt-store-gate-retry');
      if (retry) {
        event.preventDefault();
        event.stopPropagation();
        window.location.reload();
      }
    },
    true
  );
}

function repairOverlay() {
  if (!desiredOverlay || !document.body) return;

  injectGateStyle();
  if (document.documentElement.classList.contains('tt-store-gate-pending')) {
    document.documentElement.classList.remove('tt-store-gate-pending');
  }
  if (!document.documentElement.classList.contains('tt-store-gate-blocked')) {
    document.documentElement.classList.add('tt-store-gate-blocked');
  }

  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
  }

  if (
    overlay.dataset.kind !== desiredOverlay ||
    !overlay.querySelector(`.${DIALOG_CLASS}`) ||
    !overlay.querySelector(`#${LOGIN_CONTROL_ID}`)
  ) {
    overlay.dataset.kind = desiredOverlay;
    overlay.innerHTML = buildOverlayHtml(desiredOverlay);
  }

  lockPageContent();
  bindOverlayActions(overlay);
}

function scheduleRepair() {
  if (!desiredOverlay || repairScheduled) return;
  repairScheduled = true;

  queueMicrotask(() => {
    repairScheduled = false;
    if (!desiredOverlay || !overlayNeedsRepair()) return;
    repairOverlay();
  });
}

function startGuardObserver() {
  if (guardObserver) return;

  guardObserver = new MutationObserver(() => {
    // Solo repara cuando una condición real se rompió. Así evita el ciclo de
    // mutaciones que bloqueaba el hilo principal y hacía que el botón no actuara.
    if (overlayNeedsRepair()) scheduleRepair();
  });

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
      attributeFilter: ['inert', 'aria-hidden', 'style', 'class']
    });
  }
}

function stopGuardObserver() {
  guardObserver?.disconnect();
  guardObserver = null;
  repairScheduled = false;
}

function insertOverlay(kind, cfg = lastConfig) {
  desiredOverlay = kind;
  rememberConfig(cfg);
  injectGateStyle();

  bodyReady(() => {
    if (!desiredOverlay) return;
    repairOverlay();
    startGuardObserver();
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
  delete document.documentElement.dataset.ttStoreGateNavigating;
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
