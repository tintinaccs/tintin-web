import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  sendOrderNotification,
  notificationStatusFromResult
} from './resend-order-notify.js?v=tintin-20260717-resend-1';

if (!window.TintinCheckoutEmailBridgeBooted) {
  window.TintinCheckoutEmailBridgeBooted = true;

  const REQUEST_KEY = 'tt_spark_checkout_request_id';
  let capturedRequestId = '';
  let processingKey = '';
  let observer = null;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function captureRequestId() {
    try {
      const current = sessionStorage.getItem(REQUEST_KEY);
      if (current) capturedRequestId = current;
    } catch {}
  }

  // La transacción elimina el requestId justo antes de mostrar el éxito. Se
  // conserva una copia en memoria para poder localizar el documento exacto.
  captureRequestId();
  const captureTimer = window.setInterval(captureRequestId, 250);

  function successVisible() {
    const success = document.getElementById('ck-success-head');
    if (!success) return false;
    const style = window.getComputedStyle(success);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  async function findCreatedOrder(user, shortId) {
    if (capturedRequestId) {
      const exactId = `${user.uid}_${capturedRequestId}`;
      const exactSnap = await getDoc(doc(db, 'orders', exactId));
      if (exactSnap.exists()) {
        const data = exactSnap.data() || {};
        if (data.userId === user.uid && data.requestId === capturedRequestId) {
          return { id: exactSnap.id, data };
        }
      }
    }

    // Respaldo sin índice compuesto: obtiene pocos pedidos propios y compara el
    // número corto en memoria. Las reglas siguen impidiendo leer pedidos ajenos.
    const fallbackQuery = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      limit(20)
    );
    const fallbackSnap = await getDocs(fallbackQuery);
    const found = fallbackSnap.docs.find(item => clean(item.data()?.shortId) === shortId);
    return found ? { id: found.id, data: found.data() || {} } : null;
  }

  function dispatchSafePurchase(order, shortId) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const quantity = items.reduce((sum, item) => sum + Math.max(0, Number(item?.qty) || 0), 0);
    const itemCount = items.filter(item => Number(item?.qty) > 0).length;
    window.dispatchEvent(new CustomEvent('tintin:order-created', {
      detail: {
        value: Math.max(0, Number(order?.total) || 0),
        quantity,
        itemCount,
        // Solo se usa localmente para evitar eventos repetidos. analytics.js
        // elimina cualquier identificador antes de enviar parámetros externos.
        dedupeKey: clean(shortId).slice(0, 60)
      }
    }));
  }

  async function notifyAfterSuccess() {
    if (!successVisible()) return;

    const user = auth.currentUser;
    const shortId = clean(window._lastOrderId);
    if (!user || user.isAnonymous || !user.emailVerified || !shortId) return;

    const key = `${user.uid}:${shortId}`;
    if (processingKey === key) return;
    try {
      if (sessionStorage.getItem(`tt_order_email_attempted_${key}`) === '1') return;
    } catch {}

    processingKey = key;
    try {
      const found = await findCreatedOrder(user, shortId);
      if (!found) {
        console.warn('[checkout-email] No se encontró el pedido recién creado.');
        return;
      }

      const order = found.data;
      dispatchSafePurchase(order, shortId);

      if (order.notificationStatus && order.notificationStatus !== 'pending') {
        try { sessionStorage.setItem(`tt_order_email_attempted_${key}`, '1'); } catch {}
        return;
      }

      // El endpoint de Cloudflare ignora los datos sensibles del navegador y
      // vuelve a cargar el pedido real desde Firestore usando la sesión vigente.
      const compatibilityOrder = {
        ...order,
        userEmail: order.userEmail || user.email || '',
        createdAt: order.createdAt?.toDate?.().toISOString?.() || new Date().toISOString()
      };

      const result = await sendOrderNotification(found.id, compatibilityOrder, false);
      const status = notificationStatusFromResult(result);

      try { sessionStorage.setItem(`tt_order_email_attempted_${key}`, '1'); } catch {}
      window.dispatchEvent(new CustomEvent('tintin:order-email-result', {
        detail: { orderId: found.id, shortId, status, result }
      }));
    } catch (error) {
      console.error('[checkout-email] No se pudo completar la notificación:', error);
    } finally {
      processingKey = '';
    }
  }

  function start() {
    const success = document.getElementById('ck-success-head');
    if (!success) {
      window.setTimeout(start, 200);
      return;
    }

    observer = new MutationObserver(notifyAfterSuccess);
    observer.observe(success, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden']
    });

    window.addEventListener('tintin:page-ready', notifyAfterSuccess, { passive: true });
    notifyAfterSuccess();
  }

  start();
  window.addEventListener('pagehide', () => {
    window.clearInterval(captureTimer);
    observer?.disconnect();
  }, { once: true });
}
