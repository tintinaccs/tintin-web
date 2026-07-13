import { auth, db } from './firebase.js';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  sendOrderNotification,
  notificationStatusFromResult
} from './email-notify.js';

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
      const exactQuery = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('requestId', '==', capturedRequestId),
        limit(1)
      );
      const exactSnap = await getDocs(exactQuery);
      if (!exactSnap.empty) {
        const found = exactSnap.docs[0];
        return { id: found.id || exactId, data: found.data() || {} };
      }
    }

    // Respaldo para una recarga o para un navegador que haya limpiado
    // sessionStorage antes de que el puente alcanzara a copiar el requestId.
    const fallbackQuery = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('shortId', '==', shortId),
      limit(2)
    );
    const fallbackSnap = await getDocs(fallbackQuery);
    if (fallbackSnap.empty) return null;
    const found = fallbackSnap.docs[0];
    return { id: found.id, data: found.data() || {} };
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
      if (order.notificationStatus && order.notificationStatus !== 'pending') {
        try { sessionStorage.setItem(`tt_order_email_attempted_${key}`, '1'); } catch {}
        return;
      }

      // Compatibilidad con la versión anterior del Apps Script: usa el correo
      // de contacto guardado en el pedido. La versión segura nueva ignora este
      // objeto y vuelve a cargarlo desde Firestore.
      const compatibilityOrder = {
        ...order,
        userEmail: order.contactEmail || order.userEmail || user.email || '',
        createdAt: order.createdAt?.toDate?.().toISOString?.() || new Date().toISOString()
      };

      const result = await sendOrderNotification(found.id, compatibilityOrder, false);
      const status = notificationStatusFromResult(result);

      await updateDoc(doc(db, 'orders', found.id), {
        notificationStatus: status,
        updatedAt: serverTimestamp()
      });

      try { sessionStorage.setItem(`tt_order_email_attempted_${key}`, '1'); } catch {}
      window.dispatchEvent(new CustomEvent('tintin:order-email-result', {
        detail: { orderId: found.id, shortId, status, result }
      }));
    } catch (error) {
      console.error('[checkout-email] No se pudo completar la notificación:', error);
      // No se marca como intentado en sessionStorage cuando el pedido ni
      // siquiera pudo localizarse o actualizarse; una recarga permite reintentar.
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
