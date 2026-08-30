import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection, limit, onSnapshot, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ASSET_VERSION = 'tintin-20260829-notifications-connected-2';
const PROFILE_AVATAR_FALLBACK = '/assets-tintin/images/general/logo.png';
const ORDER_RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;
const ORDER_NOTIFY_RETRY_DELAYS_MS = [700, 1800];
const MAX_RECOVERY_ORDERS = 60;
let user = null;
let notifications = [];
let unsubscribeNotifications = null;
let unsubscribeOrders = null;
let orderState = new Map();
let ordersPrimed = false;
let notificationsRetryTimer = 0;
let ordersRetryTimer = 0;
const orderNotificationInFlight = new Set();

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const sleep = ms => new Promise(resolve => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

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

function trailingMarkup(notification) {
  const hasActor = notification.actorType === 'customer' && notification.actorUid;
  if (hasActor) {
    const photo = safeImageUrl(notification.actorPhotoUrl);
    return `<img class="adm-notification-avatar${photo ? '' : ' adm-notification-avatar-fallback'}" src="${escapeHtml(photo || PROFILE_AVATAR_FALLBACK)}" alt="${escapeHtml(photo ? '' : 'Tintin')}" loading="lazy" decoding="async">`;
  }
  const image = safeImageUrl(notification.productImageUrl);
  if (image) return `<img class="adm-notification-thumb" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">`;
  return `<img class="adm-notification-placeholder" src="${PROFILE_AVATAR_FALLBACK}" alt="Tintin" loading="lazy" decoding="async">`;
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
    const trailing = trailingMarkup(notification);
    const hasActor = notification.actorType === 'customer' && notification.actorUid;
    const profileButton = hasActor
      ? `<button type="button" class="adm-notification-profile-link" data-view-actor-profile data-owner-uid="${escapeHtml(notification.actorUid)}" data-owner-name="${escapeHtml(notification.actorName || '')}">Ver perfil</button>`
      : '';
    return `<div class="adm-notification-card${notification.read === true ? '' : ' is-unread'}">
      <button type="button" class="adm-notification-main" data-notification-open="${escapeHtml(notification.id)}">
        <span class="adm-notification-icon" data-icon="${escapeHtml(notification.iconKey || 'bell')}">${iconSvg(notification.iconKey)}</span>
        <span><strong>${escapeHtml(notification.title || 'Nueva actividad')}</strong>${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ''}<span class="adm-notification-time">${escapeHtml(relativeTime(notification.createdAt))}</span></span>${trailing}
      </button>${profileButton}
    </div>`;
  }).join('');
  updateBadge();
}

async function api(action, payload = {}, forceRefresh = false) {
  if (!user) throw new Error('Sesión no disponible');
  const token = await user.getIdToken(forceRefresh);
  const response = await fetch('/api/notifications', {
    method: 'POST', cache: 'no-store', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    const error = new Error(result.error || 'No se pudo completar la acción');
    error.status = response.status;
    throw error;
  }
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

function goToUserProfile(query) {
  const trigger = document.querySelector('[data-section="usuarios"]');
  trigger?.click();
  window.setTimeout(() => {
    const search = document.getElementById('user-search');
    if (!search) return;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.focus();
  }, 220);
}

function closePanel() {
  const panel = document.getElementById('adm-notifications-panel');
  const button = document.getElementById('adm-notifications-button');
  panel?.classList.remove('open');
  button?.setAttribute('aria-expanded', 'false');
}

function subscribeNotifications() {
  unsubscribeNotifications?.();
  const source = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'), limit(100));
  if (notificationsRetryTimer) window.clearTimeout(notificationsRetryTimer);
  notificationsRetryTimer = 0;
  unsubscribeNotifications = onSnapshot(source, snapshot => {
    notifications = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    render();
  }, error => {
    console.warn('[admin-notifications] No se pudo escuchar actividad:', error);
    const root = document.getElementById('adm-notifications-list');
    if (root) root.innerHTML = '<div class="adm-notifications-error">No se pudo cargar la actividad.</div>';
    if (user) notificationsRetryTimer = window.setTimeout(() => subscribeNotifications(), 1400);
  });
}

function orderSignature(data = {}) {
  return `${String(data.status || '')}|${String(data.paymentStatus || data.payment?.status || '')}`;
}

function orderNeedsRecovery(data = {}) {
  const updatedAt = asDate(data.updatedAt).getTime();
  if (!updatedAt || Date.now() - updatedAt > ORDER_RECOVERY_WINDOW_MS) return false;
  const status = String(data.status || '').trim();
  const paymentStatus = String(data.paymentStatus || data.payment?.status || '').trim();
  const revision = Math.max(0, Number(data.inventoryRevision || 0));
  return revision > 1 || !['pendiente', 'inventory_pending'].includes(status) || (paymentStatus && paymentStatus !== 'pendiente');
}

async function notifyOrderStatusWithRetry(orderId) {
  const id = String(orderId || '').trim();
  if (!id || orderNotificationInFlight.has(id) || !user) return;
  orderNotificationInFlight.add(id);
  let lastError = null;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await api('adminOrderStatusChanged', { orderId: id }, attempt > 0 && lastError?.status === 401);
        return;
      } catch (error) {
        lastError = error;
        const status = Number(error?.status || 0);
        const retryable = !status || status === 401 || [408, 425, 429].includes(status) || status >= 500;
        if (!retryable || attempt >= 2) break;
        await sleep(ORDER_NOTIFY_RETRY_DELAYS_MS[Math.min(attempt, ORDER_NOTIFY_RETRY_DELAYS_MS.length - 1)]);
      }
    }
    console.warn('[admin-notifications] No se pudo notificar estado de pedido tras reintentos:', id, lastError);
  } finally {
    orderNotificationInFlight.delete(id);
  }
}

async function recoverRecentOrderStatuses(orderIds) {
  for (const orderId of orderIds.slice(0, MAX_RECOVERY_ORDERS)) {
    if (!user) return;
    await notifyOrderStatusWithRetry(orderId);
  }
}

function subscribeOrderStatusChanges() {
  unsubscribeOrders?.();
  orderState = new Map();
  ordersPrimed = false;
  if (ordersRetryTimer) window.clearTimeout(ordersRetryTimer);
  ordersRetryTimer = 0;
  const source = query(collection(db, 'orders'), orderBy('updatedAt', 'desc'), limit(150));
  unsubscribeOrders = onSnapshot(source, snapshot => {
    const next = new Map();
    const changed = [];
    const recovery = [];
    snapshot.docs.forEach(document => {
      const data = document.data() || {};
      const signature = orderSignature(data);
      next.set(document.id, signature);
      if (!ordersPrimed && orderNeedsRecovery(data)) recovery.push(document.id);
      if (ordersPrimed && orderState.has(document.id) && orderState.get(document.id) !== signature) changed.push(document.id);
    });
    orderState = next;
    if (!ordersPrimed) {
      ordersPrimed = true;
      void recoverRecentOrderStatuses(recovery);
      return;
    }
    changed.forEach(orderId => { void notifyOrderStatusWithRetry(orderId); });
  }, error => {
    console.warn('[admin-notifications] No se pudieron observar estados de pedidos:', error);
    if (user) ordersRetryTimer = window.setTimeout(() => subscribeOrderStatusChanges(), 1400);
  });
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

    const profileButton = event.target.closest?.('[data-view-actor-profile]');
    if (profileButton) {
      event.preventDefault();
      event.stopPropagation();
      const query = profileButton.dataset.ownerName || profileButton.dataset.ownerUid || '';
      closePanel();
      goToUserProfile(query);
      return;
    }

    const card = event.target.closest?.('[data-notification-open]');
    if (card) {
      event.preventDefault();
      const notification = notifications.find(item => item.id === card.dataset.notificationOpen);
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
    if (notificationsRetryTimer) window.clearTimeout(notificationsRetryTimer);
    notificationsRetryTimer = 0;
    if (ordersRetryTimer) window.clearTimeout(ordersRetryTimer);
    ordersRetryTimer = 0;
    orderNotificationInFlight.clear();
    return;
  }
  user = current;
  ensureUi();
  subscribeNotifications();
  subscribeOrderStatusChanges();
});
