/* =============================================================
   TINTIN — Admin delete order stats sync
   =============================================================
   Envuelve las funciones existentes de admin.html sin reescribir todo el panel.
   Después de eliminar pedido(s), recalcula stats reales desde `orders`.
   ============================================================= */

import {
  recalculateOrderOwnerStats
} from './order-stats.js?v=tintin-20260716-cloudinary-fix-1';

(function () {
  'use strict';
  if (window.TintinAdminOrderDeleteFixBooted) return;
  window.TintinAdminOrderDeleteFixBooted = true;

  const isAdminPage = /(^|\/)admin\.html$/i.test(location.pathname) || location.pathname.endsWith('/admin');
  if (!isAdminPage) return;

  function toast(msg, duration = 3500) {
    const el = document.getElementById('adm-toast');
    if (!el) { console.log('[Tintin Admin]', msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._ttOrderStatsTimer);
    el._ttOrderStatsTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  async function syncDeletedOrder(orderBefore) {
    if (!orderBefore) return;
    try {
      await recalculateOrderOwnerStats(orderBefore);
      localStorage.setItem('tt_profile_stats_refresh', String(Date.now()));
      console.info('[admin-order-delete-fix] Stats de perfil recalculadas para pedido eliminado:', orderBefore.id);
    } catch (e) {
      console.warn('[admin-order-delete-fix] Pedido eliminado, pero falló el recalculo de stats:', e);
      toast('Pedido eliminado, pero no se pudieron recalcular las stats del perfil. Revisá permisos/Firestore rules.', 6500);
    }
  }

  function wrapDeleteOrder() {
    if (typeof window.deleteOrder !== 'function' || window.deleteOrder._ttStatsWrapped) return false;
    const original = window.deleteOrder;
    const wrapped = async function(orderId) {
      const result = await original.apply(this, arguments);
      if (result?.deleted) await syncDeletedOrder(result.orderBefore || { id: orderId });
      return result;
    };
    wrapped._ttStatsWrapped = true;
    window.deleteOrder = wrapped;
    return true;
  }

  function wrapBulkDeleteOrders() {
    if (typeof window.bulkDeleteOrders !== 'function' || window.bulkDeleteOrders._ttStatsWrapped) return false;
    const original = window.bulkDeleteOrders;
    const wrapped = async function() {
      const result = await original.apply(this, arguments);
      const deletedOrders = Array.isArray(result?.deletedOrders) ? result.deletedOrders : [];
      if (!deletedOrders.length) return result;

      // Recalcular solo las cuentas afectadas evita volver a leer y escribir
      // toda la base después de borrar uno o unos pocos pedidos.
      const owners = new Map();
      deletedOrders.forEach(order => {
        const uid = String(order?.userId || order?.uid || order?.customerId || '').trim();
        const email = String(order?.userEmail || order?.email || order?.customerEmail || '').trim().toLowerCase();
        const key = uid ? `uid:${uid}` : (email ? `email:${email}` : '');
        if (key && !owners.has(key)) owners.set(key, order);
      });
      try {
        const settled = await Promise.allSettled([...owners.values()].map(order => recalculateOrderOwnerStats(order)));
        const failed = settled.filter(item => item.status === 'rejected').length;
        localStorage.setItem('tt_profile_stats_refresh', String(Date.now()));
        if (failed) throw new Error(`${failed} cuenta(s) no pudieron recalcularse`);
      } catch (e) {
        console.warn('[admin-order-delete-fix] No se pudieron recalcular todas las cuentas afectadas:', e);
        toast('Los pedidos se eliminaron, pero algunas estadísticas de perfil no pudieron actualizarse.', 6500);
      }
      return result;
    };
    wrapped._ttStatsWrapped = true;
    window.bulkDeleteOrders = wrapped;
    return true;
  }

  function tryWrap() {
    const a = wrapDeleteOrder();
    const b = wrapBulkDeleteOrders();
    return a && b;
  }

  if (!tryWrap()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (tryWrap() || attempts > 120) clearInterval(timer);
    }, 100);
  }
})();
