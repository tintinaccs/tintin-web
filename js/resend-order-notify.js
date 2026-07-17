import { db, auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const ORDER_EMAIL_API = '/api/order-email';

function clean(value, maxLength = 1000) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

export function notificationStatusFromResult(result) {
  if (!result) return 'failed';
  if (result.duplicate === true && result.previousStatus) return result.previousStatus;
  if (result.customerSent === null || result.customerSent === undefined) {
    return result.adminSent ? 'sent' : 'failed';
  }
  if (result.adminSent && result.customerSent) return 'sent';
  if (result.adminSent || result.customerSent) return 'partial';
  return 'failed';
}

async function logOrderEmailAttempt(orderId, order, isResend, result) {
  try {
    await addDoc(collection(db, 'emailLogs'), {
      category: 'pedido',
      type: isResend ? 'reenvio_pedido' : 'pedido_nuevo',
      recipient: clean(order?.userEmail || auth.currentUser?.email, 254),
      status: notificationStatusFromResult(result),
      orderId: clean(orderId, 220),
      isAutomatic: !isResend,
      duplicate: result?.duplicate === true,
      sentBy: clean(auth.currentUser?.email, 254),
      error: clean(result?.error, 500),
      sentAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[resend-order] No se pudo registrar el intento:', error);
  }
}

async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return '';
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return '';
  }
}

export async function sendOrderNotification(orderId, order, isResend = false) {
  const normalizedOrderId = clean(orderId, 220);
  if (!normalizedOrderId) {
    return { success: false, adminSent: false, customerSent: null, error: 'missing_order_id' };
  }

  const idToken = await getIdToken(false);
  if (!idToken) {
    const result = {
      success: false,
      adminSent: false,
      customerSent: null,
      error: 'missing_id_token'
    };
    await logOrderEmailAttempt(normalizedOrderId, order, isResend, result);
    return result;
  }

  let response;
  let parsed;
  try {
    response = await fetch(ORDER_EMAIL_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: isResend ? 'resendOrderEmail' : 'sendOrderEmail',
        orderId: normalizedOrderId,
        sendAdmin: true,
        sendCustomer: true
      }),
      keepalive: true
    });

    const text = await response.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        success: false,
        adminSent: false,
        customerSent: null,
        error: `Respuesta inválida del servicio de correos (${response.status})`
      };
    }

    if (!response.ok && parsed?.success !== true) {
      parsed.success = false;
    }
  } catch (error) {
    parsed = {
      success: false,
      adminSent: false,
      customerSent: null,
      error: clean(error?.message || error, 500)
    };
  }

  await logOrderEmailAttempt(normalizedOrderId, order, isResend, parsed);
  return parsed;
}
