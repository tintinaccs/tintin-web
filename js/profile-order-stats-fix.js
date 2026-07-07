/* =============================================================
   TINTIN — Perfil: stats reales desde orders
   =============================================================
   Evita contadores viejos en perfil.html. Recalcula desde la colección real
   `orders` por uid y por email fallback, y actualiza la UI.
   ============================================================= */

import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getOrdersForUserIdentity, calculateOrderStats, recalculateUserOrderStats } from './order-stats.js';

(function () {
  'use strict';
  if (window.TintinProfileOrderStatsFixBooted) return;
  window.TintinProfileOrderStatsFixBooted = true;

  const isProfilePage = /(^|\/)perfil\.html$/i.test(location.pathname) || !!document.getElementById('perfil-orders-list');
  if (!isProfilePage) return;

  function formatPrice(n) {
    return 'Gs. ' + Math.round(Number(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function statusBadge(status) {
    const map = {
      pendiente: '#f59e0b', confirmado: '#3b82f6', preparando: '#d4748e',
      listo_retiro: '#14b8a6', en_camino: '#8b5cf6', enviado: '#8b5cf6',
      entregado: '#10b981', cancelado: '#ef4444', rechazado: '#ef4444'
    };
    const s = status || 'pendiente';
    const c = map[s] || '#888';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:${c}20;color:${c};text-transform:uppercase">${s.replace('_', ' ')}</span>`;
  }

  function renderOrders(orders) {
    const card = document.getElementById('perfil-orders-card');
    const listEl = document.getElementById('perfil-orders-list');
    const countEl = document.getElementById('perfil-purchase-count');
    const totalEl = document.getElementById('perfil-total-spent');
    if (!listEl) return;
    if (card) card.style.display = 'block';

    const stats = calculateOrderStats(orders);
    if (countEl) countEl.textContent = String(Math.max(0, stats.totalOrders || 0));
    if (totalEl) totalEl.textContent = formatPrice(Math.max(0, stats.totalSpent || 0));

    if (!orders.length) {
      listEl.innerHTML = `
        <div style="text-align:center;color:var(--text-muted);padding:16px 0;font-size:13px">
          Todavía no tenés pedidos 🛒<br>
          <a href="catalogo.html" style="color:var(--pink-dark);font-weight:700;margin-top:8px;display:inline-block">Ver productos →</a>
        </div>`;
      return;
    }

    listEl.innerHTML = orders.slice(0, 5).map(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : new Date());
      const dateStr = d.toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric' });
      const itemsText = (o.items || []).slice(0, 2).map(i => `${i.qty || 1}x ${i.name || 'Producto'}`).join(', ')
        + ((o.items?.length || 0) > 2 ? ` +${o.items.length - 2} más` : '');
      return `
        <div class="perfil-order-row" data-order-id="${o.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
            <span style="font-size:11px;color:var(--text-muted);font-weight:700">#${String(o.id).slice(-6).toUpperCase()} · ${dateStr}</span>
            ${statusBadge(o.status || 'pendiente')}
          </div>
          <div style="font-size:13px;color:var(--text)">${itemsText || '—'}</div>
          <div style="font-size:14px;font-weight:800;color:var(--pink-dark);margin-top:2px">Total: ${formatPrice(o.total || 0)}</div>
        </div>`;
    }).join('');
  }

  async function refreshProfileOrders(user) {
    if (!user?.uid) return;
    try {
      const orders = await getOrdersForUserIdentity({ uid: user.uid, email: user.email });
      renderOrders(orders);
      // Mantiene también el documento users/{uid} coherente, para el panel de
      // clientas/usuarios y cualquier otra vista que lea stats cacheadas.
      recalculateUserOrderStats({ uid: user.uid, email: user.email }).catch(e =>
        console.warn('[profile-order-stats-fix] No se pudo guardar stats en users/{uid}:', e)
      );
    } catch (e) {
      console.warn('[profile-order-stats-fix] Error al recalcular pedidos del perfil:', e);
    }
  }

  onAuthStateChanged(auth, user => {
    if (!user) return;
    // Deja que el script original pinte primero y luego corrige con la fuente
    // real. Si el original ya estaba correcto, no cambia nada visualmente.
    setTimeout(() => refreshProfileOrders(user), 250);
    window.addEventListener('storage', e => {
      if (e.key === 'tt_profile_stats_refresh') refreshProfileOrders(user);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshProfileOrders(user);
    });
  });
})();
