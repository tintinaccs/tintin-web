import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection, limit, onSnapshot, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ASSET_VERSION = 'tintin-20260814-social-notifications-1';
let initialized = false;
let currentUser = null;
let notifications = [];
let unsubscribe = null;
let authUnsubscribe = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

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
  if (!target || /^(?:https?:|javascript:|data:|\/\/)/i.test(target)) return 'index.html';
  return target;
}

function timeValue(value) {
  const date = value?.toDate?.() || new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - timeValue(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return timeValue(value).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
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
      <button type="button" class="tt-notifications-mark-all" id="tt-notifications-mark-all">Marcar todo como leído</button>
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
  const markAll = document.getElementById('tt-notifications-mark-all');
  if (markAll) markAll.disabled = unread === 0;
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
    const image = String(notification.productImageUrl || '').trim();
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

async function api(action, payload = {}) {
  if (!currentUser) throw new Error('Necesitás iniciar sesión');
  const token = await currentUser.getIdToken();
  const response = await fetch('/api/notifications', {
    method: 'POST', cache: 'no-store', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'No se pudo actualizar la notificación');
  return result;
}

function subscribe(user) {
  unsubscribe?.();
  unsubscribe = null;
  notifications = [];
  render();
  if (!user) return;
  const source = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
  unsubscribe = onSnapshot(source, snapshot => {
    notifications = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    render();
  }, error => {
    console.warn('[notifications] No se pudo escuchar la actividad:', error);
    const root = document.getElementById('tt-notifications-list');
    if (root) root.innerHTML = '<div class="tt-notifications-error">No pudimos cargar las notificaciones. Volvé a intentar en unos segundos.</div>';
  });
}

function optimisticRead(id) {
  const item = notifications.find(notification => notification.id === id);
  if (item) item.read = true;
  render();
}

function wireEvents() {
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-nav-action="notifications"],#tabbar-notifications');
    if (trigger && !trigger.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      ensureDrawer();
      window.TintinSurfaceController?.toggle?.('notifications', trigger);
      return;
    }

    if (event.target.closest?.('#btn-notifications-close')) {
      event.preventDefault();
      window.TintinSurfaceController?.close?.('close-button');
      return;
    }

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
      return;
    }

    if (event.target.closest?.('#tt-notifications-mark-all')) {
      event.preventDefault();
      notifications.forEach(item => { item.read = true; });
      render();
      api('notificationsSeenAll').catch(error => {
        console.warn('[notifications] No se pudieron marcar todas como leídas:', error);
        subscribe(currentUser);
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
  });
}

window.addEventListener('pagehide', () => {
  unsubscribe?.();
  authUnsubscribe?.();
}, { once: true });
