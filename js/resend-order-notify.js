import { db, auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const ORDER_EMAIL_API = '/api/order-email';
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [700, 1800];
const REQUEST_TIMEOUT_MS = 15000;

function clean(value, maxLength = 1000) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
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
      attempts: Math.max(1, Number(result?.attempts || 1)),
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

function defaultFailure(error, attempts = 1) {
  return {
    success: false,
    adminSent: false,
    customerSent: null,
    error: clean(error || 'No se pudo completar el envío.', 500),
    attempts
  };
}

function shouldRefreshToken(response, parsed, refreshedToken) {
  if (refreshedToken || !response) return false;
  if (response.status === 401) return true;
  return response.status === 400 && /sesión|token|iniciar sesión/i.test(clean(parsed?.error, 300));
}

function shouldRetry(response, parsed, attempt) {
  if (attempt >= MAX_DELIVERY_ATTEMPTS) return false;
  if (!response) return true;
  if ([408, 425, 429].includes(response.status) || response.status >= 500) return true;
  return notificationStatusFromResult(parsed) === 'partial';
}

async function postOrderNotification(payload, idToken, attempt) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ORDER_EMAIL_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal
    });

    const responseText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = defaultFailure(`Respuesta inválida del servicio de correos (${response.status})`, attempt);
    }

    if (!response.ok && parsed?.success !== true) parsed.success = false;
    parsed.attempts = attempt;
    return { response, parsed };
  } catch (error) {
    const reason = error?.name === 'AbortError'
      ? 'El servicio de correos tardó demasiado en responder.'
      : clean(error?.message || error, 500);
    return { response: null, parsed: defaultFailure(reason, attempt) };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function sendOrderNotification(orderId, order, isResend = false) {
  const normalizedOrderId = clean(orderId, 220);
  if (!normalizedOrderId) {
    return defaultFailure('missing_order_id');
  }

  let idToken = await getIdToken(false);
  if (!idToken) {
    const result = defaultFailure('missing_id_token');
    await logOrderEmailAttempt(normalizedOrderId, order, isResend, result);
    return result;
  }

  const payload = {
    action: isResend ? 'resendOrderEmail' : 'sendOrderEmail',
    orderId: normalizedOrderId,
    sendAdmin: true,
    sendCustomer: true
  };

  let refreshedToken = false;
  let finalResult = defaultFailure('No se pudo completar el envío.');

  for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
    const { response, parsed } = await postOrderNotification(payload, idToken, attempt);
    finalResult = parsed;

    if (notificationStatusFromResult(parsed) === 'sent') break;

    if (shouldRefreshToken(response, parsed, refreshedToken)) {
      const refreshed = await getIdToken(true);
      if (refreshed) {
        idToken = refreshed;
        refreshedToken = true;
        continue;
      }
    }

    if (!shouldRetry(response, parsed, attempt)) break;
    await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
  }

  await logOrderEmailAttempt(normalizedOrderId, order, isResend, finalResult);
  return finalResult;
}
