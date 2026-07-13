/**
 * TINTIN — Núcleo único de "Tienda abierta/cerrada".
 *
 * Fuente de verdad: settings/general.storeOpen + maintenanceAccess.
 * - Nunca convierte un error de lectura en "tienda abierta".
 * - Super Admin real (correo oficial) siempre puede entrar.
 * - El aviso usa el WhatsApp guardado en settings/general.
 */
import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { SUPER_ADMIN } from './roles.js';

const OVERLAY_ID = 'tt-store-closed-overlay';
const STYLE_ID = 'tt-store-gate-style';
const WA_TEXT = 'Hola Tintin, quiero consultar sobre la tienda.';

let lastConfig = {
  storeOpen: false,
  maintenanceAccess: {},
  whatsappNumber: '',
  __storeConfigStatus: 'pending',
};
let desiredOverlay = null;

function injectGateStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html.tt-store-gate-pending body > *:not(#tt-loader):not(#${OVERLAY_ID}),
    html.tt-store-gate-blocked body > *:not(#tt-loader):not(#${OVERLAY_ID}) {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html.tt-store-gate-blocked,
    html.tt-store-gate-blocked body { overflow: hidden !important; }
    #${OVERLAY_ID} { visibility: visible !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(style);
}

injectGateStyle();

export function normalizeStoreAccessConfig(data, status = 'ok') {
  const raw = data && typeof data === 'object' ? data : {};
  const maintenanceAccess = raw.maintenanceAccess && typeof raw.maintenanceAccess === 'object'
    ? raw.maintenanceAccess
    : {};
  return {
    ...raw,
    // Cerrado por defecto si el campo falta. El panel Super Admin puede abrirlo.
    storeOpen: raw.storeOpen === true,
    maintenanceAccess,
    whatsappNumber: String(raw.whatsappNumber || '').trim(),
    __storeConfigStatus: status,
  };
}

function rememberConfig(cfg) {
  lastConfig = cfg || lastConfig;
  return lastConfig;
}

export function getLastStoreAccessConfig() {
  return lastConfig;
}

export function getStoreClosedWhatsappUrl(cfg = lastConfig) {
  const digits = String(cfg?.whatsappNumber || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(WA_TEXT)}` : '';
}

function currentPathIsLogin() {
  const path = (location.pathname || '').toLowerCase();
  return path.endsWith('/login.html') || path.endsWith('/login');
}

function buildOverlayHtml(kind, cfg) {
  const unavailable = kind === 'unavailable';
  const title = unavailable
    ? 'No pudimos comprobar el estado de la tienda'
    : 'Tienda temporalmente cerrada';
  const message = unavailable
    ? 'Por seguridad, la tienda permanece bloqueada hasta que podamos confirmar su estado. Revisá tu conexión y volvé a intentar.'
    : 'Estamos realizando ajustes para mejorar tu experiencia. Volvé a intentarlo más tarde.';
  const waUrl = getStoreClosedWhatsappUrl(cfg);
  const retryButton = unavailable
    ? '<button type="button" id="tt-store-gate-retry" style="border:0;background:#8b2642;color:#fff;padding:12px 26px;border-radius:50px;font-weight:700;font-size:13px;cursor:pointer">Reintentar</button>'
    : '';
  const supportButton = waUrl
    ? `<a href="${waUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#25D366;color:#fff!important;padding:12px 26px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none">Contactar soporte</a>`
    : '';
  const loginButton = !currentPathIsLogin()
    ? '<a href="login.html?from=admin.html" style="display:inline-block;background:#fff;color:#8b2642!important;border:1.5px solid #d9a9b8;padding:11px 24px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none">Acceso del equipo</a>'
    : '';

  return `
    <div role="dialog" aria-modal="true" aria-labelledby="tt-store-gate-title" style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:36px 28px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.25);box-sizing:border-box">
      <div style="font-size:40px;margin-bottom:14px">${unavailable ? '⚠️' : '🌙'}</div>
      <div id="tt-store-gate-title" style="font-weight:800;font-size:19px;color:#8b2642;margin-bottom:12px">${title}</div>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 26px">${message}</p>
      <div style="display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap">${retryButton}${supportButton}${loginButton}</div>
    </div>`;
}

function insertOverlay(kind, cfg) {
  desiredOverlay = kind;
  rememberConfig(cfg || lastConfig);
  injectGateStyle();

  // El módulo puede resolver Firebase mientras el <head> todavía se está
  // procesando. Esperar al body evita que una conexión rápida rompa el gate.
  if (!document.body) {
    requestAnimationFrame(() => {
      if (desiredOverlay === kind) insertOverlay(kind, lastConfig);
    });
    return;
  }

  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147482990;background:rgba(30,10,18,.62);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    document.body.appendChild(overlay);
  }
  overlay.dataset.kind = kind;
  overlay.innerHTML = buildOverlayHtml(kind, lastConfig);
  document.documentElement.classList.remove('tt-store-gate-pending');
  document.documentElement.classList.add('tt-store-gate-blocked');

  overlay.querySelector('#tt-store-gate-retry')?.addEventListener('click', () => location.reload());
}

export function renderStoreClosedOverlay(cfg = lastConfig) {
  const resolved = rememberConfig(cfg || lastConfig);
  if (resolved.__storeConfigStatus && resolved.__storeConfigStatus !== 'ok') {
    insertOverlay('unavailable', resolved);
    return;
  }
  insertOverlay('closed', resolved);
}

export function renderStoreConfigUnavailableOverlay(cfg = lastConfig) {
  insertOverlay('unavailable', rememberConfig(cfg || lastConfig));
}

export function removeStoreClosedOverlay() {
  desiredOverlay = null;
  document.getElementById(OVERLAY_ID)?.remove();
  document.documentElement.classList.remove('tt-store-gate-pending', 'tt-store-gate-blocked');
}

export function getDesiredStoreOverlay() {
  return desiredOverlay;
}

/**
 * Lectura puntual usada por login.html y admin.html.
 * Ante documento ausente o error, devuelve estado NO verificado y cerrado.
 */
export async function getStoreAccessConfig() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (!snap.exists()) return rememberConfig(normalizeStoreAccessConfig({}, 'missing'));
    return rememberConfig(normalizeStoreAccessConfig(snap.data(), 'ok'));
  } catch (e) {
    console.error('[store-gate] No se pudo leer settings/general:', e);
    return rememberConfig(normalizeStoreAccessConfig({}, 'error'));
  }
}

/**
 * Decide acceso usando exactamente la misma fuente que las reglas de Firebase.
 */
export function isAccessAllowed(cfg, role, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail === SUPER_ADMIN.toLowerCase()) return true;
  if (!cfg || cfg.__storeConfigStatus !== 'ok') return false;
  if (cfg.storeOpen === true) return true;
  const access = cfg.maintenanceAccess || {};
  return access[role || 'guest'] === true;
}
