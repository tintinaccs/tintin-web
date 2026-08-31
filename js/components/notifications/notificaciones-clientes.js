import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection, limit, onSnapshot, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ASSET_VERSION = 'tintin-20260829-notifications-connected-1';
const API_RETRY_DELAYS_MS = [450, 1200];
let initialized = false;
let currentUser = null;
let notifications = [];
let unsubscribe = null;
let authUnsubscribe = null;
let markingVisibleRead = false;
let subscribeRetryTimer = 0;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const sleep = ms => new Promise(resolve => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

function ensureStyles() {
  if (document.querySelector('link[data-tt-social-notifications]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.ttSocialNotifications = '1';
  link.href = `css/components/notifications/notificaciones-sociales.css?v=${ASSET_VERSION}`;
  document.head.appendChild(link);
}

function iconSvg(iconKey) {
  const common = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  if (iconKey === 'heart') return `<svg ${common}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>`;
  if (iconKey === 'comment' || iconKey === 'review') return `<svg ${common}><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/><path d="M8 9h8M8 13h5"/></svg>`;
  if (iconKey === 'order') return `<svg ${common}><path d="M6 7V5a6 6 0 0112 0v2"/><path d="M4 7h16l-1 14H5L4 7z"/></svg>`;
  if (iconKey === 'user') return `<svg ${common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>`;
  if (iconKey === 'sparkle') return `<svg ${common}><path d="M12 3l1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9L12 3z"/><path d="M19 15l.7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15z"/></svg>`;
  return `<svg ${common}><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`;
}

function safeTarget(value) {
  const target = String(value || '').trim();
  if (!target || /^(?:https?:|javascript:|data:|vbscript:|file:|\/\/)/i.test(target)) return 'index.html';
  return /^[A-Za-z0-9_./?=&%+#:-]+$/.test(target) ? target : 'index.html';
}

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /^(?:javascript:|data:|vbscript:|file:|\/\/)/i.test(raw)) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  }
  return /^[A-Za-z0-9_./?=&%+#:-]+$/.test(raw) ? raw : '';
}

function timeValue(value) {
  const date = value?.toDate?.() || new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function relativeTime(value) {
  const date = timeValue(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  if (days < 14) return date.toLocaleDateString('es-PY', { weekday: 'long' });
  return date.toLocaleString('es-PY', {
    day: '2-digit', month: 'short', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    hour: '2-digit', minute: '2-digit',
  });
}

function ensureDrawer() {
  let drawer = document.getElementById('notifications-drawer');
  if (drawer) return drawer;
  drawer = document.createElement('aside');
  drawer.id = 'notifications-drawer';
  drawer.className = 'tt-notifications-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('aria-labelledby', 'tt-notifications-title');
  drawer.innerHTML = `
    <div class="tt-notifications-head">
      <div><p class="tt-notifications-kicker">Tu actividad</p><h2 class="tt-notifications-title" id="tt-notifications-title">Notificaciones</h2></div>
      <button type="button" class="tt-notifications-close" id="btn-notifications-close" aria-label="Cerrar notificaciones">×</button>
    </div>
    <div class="tt-notifications-toolbar">
      <span class="tt-notifications-count" id="tt-notifications-count">Sin novedades</span>
      <span class="tt-notifications-auto-read">Al abrir, las novedades quedan vistas</span>
    </div>
    <div class="tt-notifications-list" id="tt-notifications-list" aria-live="polite"><div class="tt-notifications-loading">Cargando tu actividad…</div></div>`;
  document.body.appendChild(drawer);

  const register = () => window.TintinSurfaceController?.register?.('notifications', {
    element: drawer,
    modal: true,
    triggerSelector: '[data-nav-action="notifications"],#tabbar-notifications',
    initialFocus: '#btn-notifications-close',
  });
  if (window.TintinSurfaceController) register();
  else window.addEventListener('tintin:surface-controller-ready', register, { once: true });
  return drawer;
}

function triggers() {
  return [...document.querySelectorAll('[data-nav-action="notifications"],#tabbar-notifications')];
}

function setTriggersVisible(visible) {
  triggers().forEach(trigger => { trigger.hidden = !visible; });
}

function updateBadge() {
  const unread = notifications.filter(item => item.read !== true).length;
  document.querySelectorAll('[data-notification-badge]').forEach(badge => {
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  });
  const count = document.getElementById('tt-notifications-count');
  if (count) count.textContent = unread ? `${unread} sin leer` : 'Todo al día';
}

function render() {
  const root = document.getElementById('tt-notifications-list');
  if (!root) return;
  if (!currentUser) {
    root.innerHTML = '<div class="tt-notifications-empty">Iniciá sesión para ver tu actividad.</div>';
    updateBadge();
    return;
  }
  if (!notifications.length) {
    root.innerHTML = '<div class="tt-notifications-empty">Todavía no tenés notificaciones. Cuando haya novedades de tus pedidos o interacciones, van a aparecer acá.</div>';
    updateBadge();
    return;
  }
  root.innerHTML = notifications.map(notification => {
    const image = safeImageUrl(notification.productImageUrl);
    const trailing = image
      ? `<img class="tt-notification-thumb" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`
      : `<span class="tt-notification-thumb-placeholder" aria-hidden="true">T</span>`;
    return `<button type="button" class="tt-notification-card${notification.read === true ? '' : ' is-unread'}" data-notification-id="${escapeHtml(notification.id)}" data-notification-target="${escapeHtml(safeTarget(notification.targetUrl))}">
      <span class="tt-notification-icon" data-icon="${escapeHtml(notification.iconKey || 'bell')}">${iconSvg(notification.iconKey)}</span>
      <span class="tt-notification-copy">
        <strong>${escapeHtml(notification.title || 'Nueva actividad')}</strong>
        ${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ''}
        <span class="tt-notification-meta">${notification.read === true ? '' : '<span class="tt-notification-dot" aria-label="Sin leer"></span>'}<span>${escapeHtml(relativeTime(notification.createdAt))}</span></span>
      </span>${trailing}
    </button>`;
  }).join('');
  updateBadge();
}

async function api(action, payload = {}, forceRefresh = false) {
  if (!currentUser) throw new Error('Necesitás iniciar sesión');
  const token = await currentUser.getIdToken(forceRefresh);
  const response = await fetch('/api/notifications', {
    method: 'POST', cache: 'no-store', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    const error = new Error(result.error || 'No se pudo actualizar la notificación');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function apiWithRetry(action, payload = {}, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await api(action, payload, attempt > 0 && lastError?.status === 401);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const retryable = !status || status === 401 || [408, 425, 429].includes(status) || status >= 500;
      if (!retryable || attempt >= attempts - 1) break;
      await sleep(API_RETRY_DELAYS_MS[Math.min(attempt, API_RETRY_DELAYS_MS.length - 1)]);
    }
  }
  throw lastError || new Error('No se pudo completar la operación');
}

function notificationsSurfaceIsOpen() {
  const drawer = document.getElementById('notifications-drawer');
  if (!drawer) return false;
  return drawer.getAttribute('aria-hidden') === 'false'
    || drawer.classList.contains('open')
    || (window.TintinSurfaceController?.surface === 'notifications'
      && ['opening', 'open'].includes(window.TintinSurfaceController?.state));
}

function subscribe(user) {
  unsubscribe?.();
  unsubscribe = null;
  if (subscribeRetryTimer) window.clearTimeout(subscribeRetryTimer);
  subscribeRetryTimer = 0;
  notifications = [];
  render();
  if (!user) return;
  const source = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
  unsubscribe = onSnapshot(source, snapshot => {
    notifications = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    render();
    if (notificationsSurfaceIsOpen()) void markVisibleNotificationsRead();
  }, error => {
    console.warn('[notifications] No se pudo escuchar la actividad:', error);
    const root = document.getElementById('tt-notifications-list');
    if (root) root.innerHTML = '<div class="tt-notifications-error">No pudimos cargar las notificaciones. Volvé a intentar en unos segundos.</div>';
    if (currentUser) subscribeRetryTimer = window.setTimeout(() => subscribe(currentUser), 1400);
  });
}

function optimisticRead(id) {
  const item = notifications.find(notification => notification.id === id);
  if (item) item.read = true;
  render();
}

async function markVisibleNotificationsRead() {
  if (!currentUser || markingVisibleRead || !notifications.some(item => item.read !== true)) return;
  markingVisibleRead = true;
  notifications.forEach(item => { if (item.read !== true) item.read = true; });
  render();
  try {
    await apiWithRetry('notificationsSeenAll');
  } catch (error) {
    console.warn('[notifications] No se pudieron confirmar como vistas:', error);
    subscribe(currentUser);
  } finally {
    markingVisibleRead = false;
  }
}

function wireEvents() {
  window.addEventListener('tintin:surface-change', event => {
    const surface = String(event.detail?.surface || '');
    const state = String(event.detail?.state || '');
    if (surface === 'notifications' && (state === 'opening' || state === 'open')) {
      void markVisibleNotificationsRead();
    }
  });

  document.addEventListener('click', event => {
    const card = event.target.closest?.('[data-notification-id]');
    if (card) {
      event.preventDefault();
      const id = card.dataset.notificationId;
      const target = safeTarget(card.dataset.notificationTarget);
      optimisticRead(id);
      const work = api('notificationSeen', { notificationId: id }).catch(error => console.warn('[notifications] No se pudo marcar como leída:', error));
      Promise.race([work, new Promise(resolve => setTimeout(resolve, 220))]).finally(() => {
        window.location.href = target;
      });
    }
  }, true);
}

export function initClientNotifications() {
  if (initialized) return;
  initialized = true;
  ensureStyles();
  ensureDrawer();
  wireEvents();
  setTriggersVisible(false);
  authUnsubscribe = onAuthStateChanged(auth, user => {
    currentUser = user || null;
    setTriggersVisible(Boolean(user));
    subscribe(currentUser);
    if (currentUser) {
      apiWithRetry('profileCreated').catch(error => console.warn('[notifications] No se pudo registrar el alta social:', error));
    }
  });
}

window.addEventListener('pagehide', () => {
  unsubscribe?.();
  authUnsubscribe?.();
  if (subscribeRetryTimer) window.clearTimeout(subscribeRetryTimer);
}, { once: true });