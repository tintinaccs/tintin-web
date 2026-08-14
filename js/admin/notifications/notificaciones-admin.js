import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection, limit, onSnapshot, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ASSET_VERSION = 'tintin-20260814-social-notifications-1';
let user = null;
let notifications = [];
let unsubscribeNotifications = null;
let unsubscribeOrders = null;
let orderState = new Map();
let ordersPrimed = false;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function ensureStyles() {
  if (document.querySelector('link[data-adm-social-notifications]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.admSocialNotifications = '1';
  link.href = `css/admin/notificaciones-admin.css?v=${ASSET_VERSION}`;
  document.head.appendChild(link);
}

function bellSvg() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
}

function iconSvg(iconKey) {
  const common = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  if (iconKey === 'heart') return `<svg ${common}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>`;
  if (iconKey === 'comment' || iconKey === 'review') return `<svg ${common}><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/><path d="M8 9h8M8 13h5"/></svg>`;
  if (iconKey === 'order') return `<svg ${common}><path d="M6 7V5a6 6 0 0112 0v2"/><path d="M4 7h16l-1 14H5L4 7z"/></svg>`;
  if (iconKey === 'user') return `<svg ${common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>`;
  return bellSvg();
}

function asDate(value) {
  const date = value?.toDate?.() || new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - asDate(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return asDate(value).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

function ensureUi() {
  let wrap = document.getElementById('adm-notifications-wrap');
  if (wrap) return wrap;
  const topbar = document.querySelector('.adm-topbar');
  if (!topbar) return null;
  wrap = document.createElement('div');
  wrap.id = 'adm-notifications-wrap';
  wrap.className = 'adm-notifications-wrap';
  wrap.innerHTML = `
    <button type="button" class="adm-notifications-button" id="adm-notifications-button" aria-label="Notificaciones" aria-expanded="false" aria-controls="adm-notifications-panel">
      ${bellSvg()}<span class="tt-notification-badge" id="adm-notifications-badge" hidden>0</span>
    </button>
    <section class="adm-notifications-panel" id="adm-notifications-panel" aria-label="Actividad de Tintin">
      <div class="adm-notifications-header"><div><span class="adm-notifications-kicker">Actividad en vivo</span><h3>Notificaciones</h3></div><button type="button" class="adm-notifications-mark-all" id="adm-notifications-mark-all">Marcar todo leído</button></div>
      <div class="adm-notifications-list" id="adm-notifications-list" aria-live="polite"><div class="adm-notifications-empty">Cargando actividad…</div></div>
    </section>`;
  const newOrder = topbar.querySelector('.adm-topbar-btn');
  topbar.insertBefore(wrap, newOrder || null);
  return wrap;
}

function updateBadge() {
  const unread = notifications.filter(item => item.read !== true).length;
  const badge = document.getElementById('adm-notifications-badge');
  if (badge) {
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }
  const button = document.getElementById('adm-notifications-mark-all');
  if (button) button.disabled = unread === 0;
}

function render() {
  const root = document.getElementById('adm-notifications-list');
  if (!root) return;
  if (!notifications.length) {
    root.innerHTML = '<div class="adm-notifications-empty">No hay actividad nueva. Las reseñas, Me gusta, registros y pedidos van a aparecer acá.</div>';
    updateBadge();
    return;
  }
  root.innerHTML = notifications.map(notification => {
    const image = String(notification.productImageUrl || '').trim();
    const trailing = image
      ? `<img class="adm-notification-thumb" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`
      : '<span class="adm-notification-placeholder" aria-hidden="true">T</span>';
    return `<button type="button" class="adm-notification-card${notification.read === true ? '' : ' is-unread'}" data-adm-notification="${escapeHtml(notification.id)}">
      <span class="adm-notification-icon" data-icon="${escapeHtml(notification.iconKey || 'bell')}">${iconSvg(notification.iconKey)}</span>
      <span><strong>${escapeHtml(notification.title || 'Nueva actividad')}</strong>${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ''}<span class="adm-notification-time">${escapeHtml(relativeTime(notification.createdAt))}</span></span>${trailing}
    </button>`;
  }).join('');
  updateBadge();
}

async function api(action, payload = {}) {
  if (!user) throw new Error('Sesión no disponible');
  const token = await user.getIdToken();
  const response = await fetch('/api/notifications', {
    method: 'POST', cache: 'no-store', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'No se pudo completar la acción');
  return result;
}

function openSection(section, sourceId = '') {
  const trigger = document.querySelector(`[data-section="${section}"]`);
  trigger?.click();
  if (!sourceId) return;
  window.setTimeout(() => {
    let target = null;
    if (section === 'resenas') target = document.querySelector(`[data-review-id="${CSS.escape(sourceId)}"]`);
    if (section === 'usuarios') target = document.querySelector(`[data-user-id="${CSS.escape(sourceId)}"]`);
    if (section === 'pedidos') target = document.querySelector(`[data-order-id="${CSS.escape(sourceId)}"]`);
    if (!target) return;
    target.classList.add('adm-notification-focus');
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.classList.remove('adm-notification-focus'), 1900);
  }, 220);
}

function goToNotification(notification) {
  const source = String(notification.sourceType || '');
  const sourceId = String(notification.sourceId || '');
  if (source === 'review') openSection('resenas', sourceId);
  else if (source === 'favorite') openSection('me-gusta', sourceId);
  else if (source === 'user') openSection('usuarios', sourceId);
  else if (source === 'order') openSection('pedidos', sourceId);
  else if (notification.targetUrl) window.location.href = notification.targetUrl;
}

function closePanel() {
  const panel = document.getElementById('adm-notifications-panel');
  const button = document.getElementById('adm-notifications-button');
  panel?.classList.remove('open');
  button?.setAttribute('aria-expanded', 'false');
}

function subscribeNotifications() {
  unsubscribeNotifications?.();
  const source = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'), limit(70));
  unsubscribeNotifications = onSnapshot(source, snapshot => {
    notifications = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    render();
  }, error => {
    console.warn('[admin-notifications] No se pudo escuchar actividad:', error);
    const root = document.getElementById('adm-notifications-list');
    if (root) root.innerHTML = '<div class="adm-notifications-error">No se pudo cargar la actividad.</div>';
  });
}

function orderSignature(data = {}) {
  return `${String(data.status || '')}|${String(data.paymentStatus || data.payment?.status || '')}`;
}

function subscribeOrderStatusChanges() {
  unsubscribeOrders?.();
  orderState = new Map();
  ordersPrimed = false;
  const source = query(collection(db, 'orders'), orderBy('updatedAt', 'desc'), limit(150));
  unsubscribeOrders = onSnapshot(source, snapshot => {
    const next = new Map();
    const changed = [];
    snapshot.docs.forEach(document => {
      const signature = orderSignature(document.data());
      next.set(document.id, signature);
      if (ordersPrimed && orderState.has(document.id) && orderState.get(document.id) !== signature) changed.push(document.id);
    });
    orderState = next;
    if (!ordersPrimed) {
      ordersPrimed = true;
      return;
    }
    changed.forEach(orderId => {
      api('adminOrderStatusChanged', { orderId }).catch(error => console.warn('[admin-notifications] No se pudo notificar estado de pedido:', orderId, error));
    });
  }, error => console.warn('[admin-notifications] No se pudieron observar estados de pedidos:', error));
}

function wireEvents() {
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#adm-notifications-button');
    if (button) {
      event.preventDefault();
      const panel = document.getElementById('adm-notifications-panel');
      const opening = !panel?.classList.contains('open');
      panel?.classList.toggle('open', opening);
      button.setAttribute('aria-expanded', String(opening));
      return;
    }

    const card = event.target.closest?.('[data-adm-notification]');
    if (card) {
      event.preventDefault();
      const notification = notifications.find(item => item.id === card.dataset.admNotification);
      if (!notification) return;
      notification.read = true;
      render();
      api('adminNotificationSeen', { notificationId: notification.id }).catch(error => console.warn('[admin-notifications] No se pudo marcar como leída:', error));
      closePanel();
      goToNotification(notification);
      return;
    }

    if (event.target.closest?.('#adm-notifications-mark-all')) {
      event.preventDefault();
      notifications.forEach(item => { item.read = true; });
      render();
      api('adminNotificationsSeenAll').catch(error => console.warn('[admin-notifications] No se pudieron marcar todas como leídas:', error));
      return;
    }

    const panel = document.getElementById('adm-notifications-panel');
    if (panel?.classList.contains('open') && !event.target.closest?.('#adm-notifications-wrap')) closePanel();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePanel();
  });
}

ensureStyles();
wireEvents();
onAuthStateChanged(auth, current => {
  if (String(current?.email || '').trim().toLowerCase() !== String(SUPER_ADMIN || '').trim().toLowerCase()) {
    user = null;
    document.getElementById('adm-notifications-wrap')?.remove();
    unsubscribeNotifications?.();
    unsubscribeOrders?.();
    return;
  }
  user = current;
  ensureUi();
  subscribeNotifications();
  subscribeOrderStatusChanges();
});
