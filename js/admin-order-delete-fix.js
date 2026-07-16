/* =============================================================
   TINTIN — Admin delete order stats sync
   =============================================================
   Envuelve las funciones existentes de admin.html sin reescribir todo el panel.
   Después de eliminar pedido(s), recalcula stats reales desde `orders`.
   ============================================================= */

import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  readOrderBeforeDelete,
  recalculateOrderOwnerStats,
  recalculateAllUserOrderStats
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

  async function orderStillExists(orderId) {
    try {
      const snap = await getDoc(doc(db, 'orders', orderId));
      return snap.exists();
    } catch (e) {
      console.warn('[admin-order-delete-fix] No se pudo verificar si existe el pedido:', e);
      return true;
    }
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
      const before = await readOrderBeforeDelete(orderId).catch(e => {
        console.warn('[admin-order-delete-fix] No se pudo leer pedido antes de borrar:', e);
        return null;
      });
      await original.apply(this, arguments);
      const exists = await orderStillExists(orderId);
      if (!exists) await syncDeletedOrder(before || { id: orderId });
    };
    wrapped._ttStatsWrapped = true;
    window.deleteOrder = wrapped;
    return true;
  }

  function wrapBulkDeleteOrders() {
    if (typeof window.bulkDeleteOrders !== 'function' || window.bulkDeleteOrders._ttStatsWrapped) return false;
    const original = window.bulkDeleteOrders;
    const wrapped = async function() {
      await original.apply(this, arguments);
      // Bulk delete está reservado a Super Admin en el panel. Para evitar stats
      // fantasma aunque se eliminen muchos pedidos de distintos usuarios, se
      // recalculan todos los usuarios desde la colección real `orders`.
      try {
        const result = await recalculateAllUserOrderStats();
        localStorage.setItem('tt_profile_stats_refresh', String(Date.now()));
        console.info('[admin-order-delete-fix] Recalculo global después de eliminación masiva:', result);
        if (result?.updated) toast(`Stats de perfiles recalculadas (${result.updated} usuarios)`);
      } catch (e) {
        console.warn('[admin-order-delete-fix] No se pudo recalcular stats globales:', e);
        toast('Pedidos procesados. No se pudieron recalcular todas las stats de perfil.', 6500);
      }
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
