// =============================================================
// TINTIN — Notificaciones de pedidos (Web Push) en el panel
// =============================================================
// Módulo progresivo: si Firebase Messaging no está disponible, si falta
// la clave VAPID o si el navegador no soporta Web Push, la tarjeta muestra
// el motivo y el resto del panel sigue funcionando igual. Nunca bloquea la
// carga del panel ni reintenta en bucle.
//
// El token FCM no se escribe en Firestore desde el navegador: se manda a
// /api/push-subscription, que lo guarda con credenciales de servidor.
// Tampoco se imprime completo en consola ni se manda a analytics.

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { apiUrl } from '../../core/firebase/origen-funciones.js';

const DEVICE_ID_KEY = 'tt_push_device_id';
const DEVICE_LABEL_KEY = 'tt_push_device_label';
const LAST_REGISTER_KEY = 'tt_push_last_register';
const SW_PATH = '/firebase-messaging-sw.js';
const MESSAGING_SDK = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

const IOS_INSTALL_MESSAGE =
  'Para recibir notificaciones en iPhone, abrí esta página en Safari, tocá Compartir y elegí Agregar a inicio. ' +
  'Después abrí Tintin Pedidos desde el nuevo ícono.';

const STATE_LABELS = {
  unsupported: 'Navegador no compatible',
  'ios-install': 'Instalación requerida en iPhone',
  unconfigured: 'No configuradas',
  ready: 'Listas para activar',
  active: 'Activas en este dispositivo',
  blocked: 'Permiso bloqueado',
  error: 'Error de configuración'
};

const dom = {};
let messagingModule = null;
let messagingInstance = null;
let swRegistration = null;
let currentToken = '';
let currentState = 'unconfigured';
let busy = false;
let foregroundCount = 0;

// --- Utilidades pequeñas ---------------------------------------------------

function el(id) {
  return document.getElementById(id);
}

function isIos() {
  const ua = navigator.userAgent || '';
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true;
}

function platformName() {
  if (isIos()) return 'ios';
  if (/Android/i.test(navigator.userAgent || '')) return 'android';
  return 'desktop';
}

function deviceId() {
  let stored = '';
  try { stored = localStorage.getItem(DEVICE_ID_KEY) || ''; } catch {}
  if (/^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
  const generated = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9]/g, '');
  const value = generated.slice(0, 32).padEnd(16, '0');
  try { localStorage.setItem(DEVICE_ID_KEY, value); } catch {}
  return value;
}

function defaultDeviceLabel() {
  if (isIos()) return 'iPhone de Tintin';
  if (platformName() === 'android') return 'Android de Tintin';
  return 'Computadora de Tintin';
}

function storedLabel() {
  try { return localStorage.getItem(DEVICE_LABEL_KEY) || ''; } catch { return ''; }
}

function formatDate(isoText) {
  const date = isoText ? new Date(isoText) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

async function authorizedFetch(name, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión de nuevo.');
  const idToken = await user.getIdToken();
  const response = await fetch(apiUrl(name), {
    ...init,
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
  return data;
}

// --- Interfaz --------------------------------------------------------------

function setState(state, detail = '') {
  currentState = state;
  if (!dom.card) return;
  if (dom.pill) dom.pill.textContent = STATE_LABELS[state] || STATE_LABELS.unconfigured;
  if (dom.detail) dom.detail.textContent = detail;
  const canEnable = state === 'ready' || state === 'unconfigured';
  if (dom.enable) {
    dom.enable.disabled = busy || !canEnable;
    dom.enable.style.display = state === 'active' ? 'none' : '';
  }
  if (dom.test) dom.test.disabled = busy || state !== 'active';
  if (dom.disable) {
    dom.disable.disabled = busy || state !== 'active';
    dom.disable.style.display = state === 'active' ? '' : 'none';
  }
  if (dom.label) dom.label.disabled = busy;
}

function setLastRegistered(isoText) {
  if (isoText) {
    try { localStorage.setItem(LAST_REGISTER_KEY, isoText); } catch {}
  }
  let value = isoText || '';
  if (!value) {
    try { value = localStorage.getItem(LAST_REGISTER_KEY) || ''; } catch {}
  }
  if (dom.lastRegister) dom.lastRegister.textContent = value ? formatDate(value) : '—';
}

/** Aviso interno no invasivo, dentro de la propia tarjeta. */
function notice(message, tone = 'info') {
  if (!dom.notice) return;
  dom.notice.textContent = message;
  dom.notice.style.display = message ? '' : 'none';
  dom.notice.style.color = tone === 'error' ? 'var(--adm-danger, #c62828)' : 'var(--adm-muted)';
}

function withBusy(fn) {
  return async () => {
    if (busy) return;
    busy = true;
    setState(currentState);
    try {
      await fn();
    } catch (error) {
      notice(String(error?.message || 'No se pudo completar la operación.'), 'error');
    } finally {
      busy = false;
      setState(currentState);
    }
  };
}

// --- Firebase Messaging ----------------------------------------------------

async function loadMessaging() {
  if (messagingModule) return messagingModule;
  messagingModule = await import(MESSAGING_SDK);
  return messagingModule;
}

async function messagingSupported() {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return false;
  }
  try {
    const sdk = await loadMessaging();
    return await sdk.isSupported();
  } catch {
    return false;
  }
}

async function ensureServiceWorker() {
  if (swRegistration) return swRegistration;
  swRegistration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;
  return swRegistration;
}

async function ensureMessaging() {
  if (messagingInstance) return messagingInstance;
  const sdk = await loadMessaging();
  // Reutilizar la misma instancia que inicializa firebase.js. Cargar
  // firebase-app desde otra versión/URL crea otro registro de apps y deja
  // getApp() sin [DEFAULT], que rompe la activación con el error:
  // Error típico: Firebase App '[DEFAULT]' no estaba inicializada.
  // Auth pertenece a la app Firebase compartida; reutilizarla evita una
  // segunda aplicación Firebase y el error de registro [DEFAULT].
  messagingInstance = sdk.getMessaging(auth.app);
  sdk.onMessage(messagingInstance, payload => {
    const data = payload?.data || {};
    const title = data.title || 'Tintin Pedidos';
    const body = data.body || 'Nuevo aviso';
    foregroundCount += 1;
    notice(`${title} — ${body}`);
    // FCM data-only messages are deliberately rendered by us. When the
    // panel is visible, show the same native Chrome notification as the
    // service worker does in the background (without relying on a toast).
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon-192x192.png',
          badge: '/favicon-192x192.png',
          tag: String(data.tag || data.eventId || 'tintin-push'),
          silent: false
        });
        notification.onclick = () => {
          notification.close();
          window.focus();
          window.location.href = '/admin.html?section=pedidos';
        };
      } catch {
        // Some installed-browser shells expose permission but block the
        // constructor; the in-panel notice above remains the fallback.
      }
    }
    window.TintinPushPlayForegroundSound?.(data.foregroundSound || 'default');
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(foregroundCount).catch(() => {});
    }
  });
  return messagingInstance;
}

async function fetchVapidKey() {
  const config = await authorizedFetch('push-config', { method: 'GET' });
  const key = String(config.vapidKey || '').trim();
  if (!key) throw new Error('Falta la clave VAPID en Cloudflare.');
  return key;
}

async function requestToken() {
  const vapidKey = await fetchVapidKey();
  const registration = await ensureServiceWorker();
  const messaging = await ensureMessaging();
  const sdk = await loadMessaging();
  const token = await sdk.getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('El navegador no entregó un token de notificaciones.');
  return token;
}

async function saveTokenOnServer(token) {
  const label = (dom.label?.value || storedLabel() || defaultDeviceLabel()).trim().slice(0, 60);
  try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch {}
  const result = await authorizedFetch('push-subscription', {
    method: 'POST',
    body: JSON.stringify({
      action: 'register',
      deviceId: deviceId(),
      deviceLabel: label,
      token,
      platform: platformName(),
      userAgent: String(navigator.userAgent || '').slice(0, 120)
    })
  });
  currentToken = token;
  setLastRegistered(result.updatedAt || new Date().toISOString());
  return result;
}

// --- Acciones de la tarjeta ------------------------------------------------

const enableNotifications = withBusy(async () => {
  notice('');
  if (!(await messagingSupported())) {
    setState('unsupported', 'Este navegador no admite notificaciones web.');
    return;
  }
  if (isIos() && !isStandalone()) {
    setState('ios-install', IOS_INSTALL_MESSAGE);
    return;
  }
  if (Notification.permission === 'denied') {
    setState('blocked', 'Habilitá las notificaciones de este sitio desde los ajustes del navegador o del sistema y volvé a intentar.');
    return;
  }

  // requestPermission() se llama únicamente acá: dentro del manejador del
  // botón, nunca de forma automática al cargar el panel.
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    setState(permission === 'denied' ? 'blocked' : 'ready', 'No se concedió el permiso de notificaciones.');
    return;
  }

  const token = await requestToken();
  await saveTokenOnServer(token);
  setState('active', 'Este dispositivo va a recibir un aviso por cada pedido nuevo.');
  notice('Notificaciones activadas en este dispositivo.');
});

const sendTestNotification = withBusy(async () => {
  notice('Enviando prueba...');
  const result = await authorizedFetch('push-test', {
    method: 'POST',
    body: JSON.stringify({ scope: 'device', token: currentToken })
  });
  notice(`Prueba enviada: ${result.successCount} de ${result.attempted} dispositivo(s).`);
});

const disableNotifications = withBusy(async () => {
  notice('');
  try {
    const sdk = await loadMessaging();
    const messaging = await ensureMessaging();
    await sdk.deleteToken(messaging);
  } catch {
    // Si el token ya no existía en el navegador, alcanza con desactivarlo en
    // el servidor: es ahí donde se decide a quién se le envía.
  }
  await authorizedFetch('push-subscription', {
    method: 'POST',
    body: JSON.stringify({ action: 'unregister', deviceId: deviceId() })
  });
  currentToken = '';
  setState('ready', 'Este dispositivo ya no recibe notificaciones.');
  notice('Notificaciones desactivadas en este dispositivo.');
});

// --- Estado inicial (sin pedir permiso ni reintentar en bucle) -------------

async function refreshInitialState() {
  if (!(await messagingSupported())) {
    setState('unsupported', 'Este navegador no admite notificaciones web. Probá con Chrome en Android o Safari en iPhone (iOS 16.4 o posterior).');
    return;
  }
  if (isIos() && !isStandalone()) {
    setState('ios-install', IOS_INSTALL_MESSAGE);
    return;
  }
  if (Notification.permission === 'denied') {
    setState('blocked', 'El permiso está bloqueado. Habilitalo desde los ajustes del navegador o del sistema.');
    return;
  }

  let status = null;
  try {
    status = await authorizedFetch('push-subscription', {
      method: 'POST',
      body: JSON.stringify({ action: 'status', deviceId: deviceId() })
    });
  } catch (error) {
    setState('error', 'No se pudo consultar el estado de las notificaciones.');
    notice(String(error?.message || ''), 'error');
    return;
  }

  if (dom.label && !dom.label.value) {
    dom.label.value = status.deviceLabel || storedLabel() || defaultDeviceLabel();
  }
  setLastRegistered(status.updatedAt || '');

  if (Notification.permission !== 'granted') {
    setState(status.registered ? 'ready' : 'unconfigured', 'Tocá "Activar notificaciones" para recibir los pedidos en este dispositivo.');
    return;
  }
  if (!status.registered) {
    setState('ready', 'El permiso ya está concedido: falta registrar este dispositivo.');
    return;
  }

  // El permiso está concedido y el servidor tiene el dispositivo: se renueva
  // el token una sola vez, por si Firebase lo rotó o se borraron los datos del
  // navegador. Un único intento, sin reintentos automáticos.
  try {
    const token = await requestToken();
    await saveTokenOnServer(token);
    setState('active', 'Este dispositivo va a recibir un aviso por cada pedido nuevo.');
  } catch (error) {
    setState('error', 'Las notificaciones necesitan que vuelvas a tocar "Activar notificaciones".');
    notice(String(error?.message || ''), 'error');
  }
}

function bindDom() {
  dom.card = el('push-card');
  if (!dom.card) return false;
  dom.pill = el('push-status-pill');
  dom.detail = el('push-status-detail');
  dom.notice = el('push-notice');
  dom.lastRegister = el('push-last-register');
  dom.label = el('push-device-label');
  dom.enable = el('btn-push-enable');
  dom.test = el('btn-push-test');
  dom.disable = el('btn-push-disable');

  dom.enable?.addEventListener('click', enableNotifications);
  dom.test?.addEventListener('click', sendTestNotification);
  dom.disable?.addEventListener('click', disableNotifications);
  dom.label?.addEventListener('change', () => {
    try { localStorage.setItem(DEVICE_LABEL_KEY, (dom.label.value || '').trim().slice(0, 60)); } catch {}
  });
  return true;
}

function boot() {
  if (!bindDom()) return;
  onAuthStateChanged(auth, user => {
    const isSuperAdmin = user?.email === SUPER_ADMIN;
    dom.card.style.display = isSuperAdmin ? '' : 'none';
    if (!isSuperAdmin) return;
    setLastRegistered('');
    // Un fallo de Messaging nunca puede frenar la carga del panel.
    refreshInitialState().catch(() => setState('error', 'No se pudo iniciar el módulo de notificaciones.'));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
