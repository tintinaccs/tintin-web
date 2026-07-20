import { auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getOrdersForUserIdentity, calculateOrderStats } from './order-stats.js?v=tintin-20260716-cloudinary-fix-1';

(function () {
  'use strict';
  if (window.TintinProfileOrderStatsFixBooted) return;
  window.TintinProfileOrderStatsFixBooted = true;

  const isProfilePage = /(^|\/)perfil\.html$/i.test(location.pathname) || !!document.getElementById('perfil-orders-list');
  if (!isProfilePage) return;

  let activeUser = null;
  let refreshTimer = 0;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatPrice(value) {
    return 'Gs. ' + Math.round(Number(value || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function statusBadge(status) {
    const colors = {
      pendiente: '#f59e0b', confirmado: '#3b82f6', preparando: '#d4748e',
      listo_retiro: '#14b8a6', en_camino: '#8b5cf6', enviado: '#8b5cf6',
      entregado: '#10b981', cancelado: '#ef4444', rechazado: '#ef4444'
    };
    const normalized = String(status || 'pendiente').toLowerCase();
    const color = colors[normalized] || '#888';
    const label = escapeHtml(normalized.replaceAll('_', ' '));
    return `<span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:${color}20;color:${color};text-transform:uppercase">${label}</span>`;
  }

  function renderOrders(orders) {
    const card = document.getElementById('perfil-orders-card');
    const list = document.getElementById('perfil-orders-list');
    const count = document.getElementById('perfil-purchase-count');
    const total = document.getElementById('perfil-total-spent');
    if (!list) return;
    if (card) card.style.display = 'block';

    const stats = calculateOrderStats(orders);
    if (count) count.textContent = String(Math.max(0, stats.totalOrders || 0));
    if (total) total.textContent = formatPrice(Math.max(0, stats.totalSpent || 0));

    if (!orders.length) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px 0;font-size:13px">Todavía no tenés pedidos 🛒<br><a href="catalogo.html" style="color:var(--pink-dark);font-weight:700;margin-top:8px;display:inline-block">Ver productos →</a></div>';
      return;
    }

    list.innerHTML = orders.slice(0, 5).map(order => {
      const rawDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt ? new Date(order.createdAt) : new Date());
      const date = rawDate.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const items = (order.items || []).slice(0, 2).map(item => `${Math.max(1, Number(item.qty || 1))}x ${escapeHtml(item.name || 'Producto')}`).join(', ')
        + ((order.items?.length || 0) > 2 ? ` +${order.items.length - 2} más` : '');
      const id = escapeHtml(order.id || '');
      const shortId = escapeHtml(String(order.id || '').slice(-6).toUpperCase());
      return `<div class="perfil-order-row" data-order-id="${id}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px"><span style="font-size:11px;color:var(--text-muted);font-weight:700">#${shortId} · ${date}</span>${statusBadge(order.status)}</div><div style="font-size:13px;color:var(--text)">${items || '—'}</div><div style="font-size:14px;font-weight:800;color:var(--pink-dark);margin-top:2px">Total: ${formatPrice(order.total || 0)}</div></div>`;
    }).join('');
  }

  async function refreshProfileOrders(user) {
    if (!user?.uid) return;
    try {
      const orders = await getOrdersForUserIdentity({ uid: user.uid, email: user.email });
      if (activeUser?.uid !== user.uid) return;
      renderOrders(orders);
    } catch (error) {
      console.warn('[profile-order-stats-fix] Error al cargar pedidos del perfil:', error);
    }
  }

  function scheduleRefresh(delay = 0) {
    window.clearTimeout(refreshTimer);
    if (!activeUser) return;
    const user = activeUser;
    refreshTimer = window.setTimeout(() => refreshProfileOrders(user), delay);
  }

  window.addEventListener('storage', event => {
    if (event.key === 'tt_profile_stats_refresh') scheduleRefresh();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh();
  });

  onAuthStateChanged(auth, user => {
    activeUser = user || null;
    window.clearTimeout(refreshTimer);
    if (activeUser) scheduleRefresh(250);
  });
})();
