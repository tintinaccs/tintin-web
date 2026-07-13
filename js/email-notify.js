/**
 * TINTIN — Notificaciones por Google Apps Script, compatibles con Spark.
 *
 * El webhook recibe siempre un idToken real y el ID del pedido. La versión
 * segura del Apps Script vuelve a leer el pedido desde Firestore y no confía
 * en nombres, precios, destinatarios ni totales enviados por el navegador.
 */
import { EMAIL_WEBHOOK_URL, EMAIL_SECRET } from './email-config.js';
import { db, auth } from './firebase.js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const EMAIL_GATE_REF = doc(db, 'settings', 'emailGate');

function clean(value, maxLength = 1000) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function webhookConfigured() {
  return Boolean(
    EMAIL_WEBHOOK_URL &&
    !EMAIL_WEBHOOK_URL.includes('PEGAR_') &&
    /^https:\/\/script\.google\.com\/macros\/s\//.test(EMAIL_WEBHOOK_URL)
  );
}

/**
 * Documento público mínimo, sin direcciones ni credenciales. Super Admin lo
 * sincroniza desde emailSettings/main mediante admin-email-gate-sync.js.
 */
async function getEmailSettings_() {
  try {
    const snap = await getDoc(EMAIL_GATE_REF);
    return snap.exists() ? snap.data() || {} : {};
  } catch {
    // Compatibilidad: mientras el documento se crea, los correos de pedido
    // continúan habilitados. El Apps Script también aplica su propia lectura.
    return {};
  }
}

function notificationStatusFromResult_(result) {
  if (!result) return 'failed';
  if (result.duplicate === true && result.previousStatus) {
    return result.previousStatus;
  }
  if (result.customerSent === null || result.customerSent === undefined) {
    return result.adminSent ? 'sent' : 'failed';
  }
  if (result.adminSent && result.customerSent) return 'sent';
  if (result.adminSent || result.customerSent) return 'partial';
  return 'failed';
}

async function logOrderEmailAttempt_(orderId, order, isResend, result) {
  try {
    await addDoc(collection(db, 'emailLogs'), {
      category: 'pedido',
      type: isResend ? 'reenvio_pedido' : 'pedido_nuevo',
      recipient: clean(order?.contactEmail || order?.userEmail, 254),
      status: notificationStatusFromResult_(result),
      orderId: clean(orderId, 220),
      isAutomatic: !isResend,
      duplicate: result?.duplicate === true,
      sentBy: clean(auth.currentUser?.email, 254),
      error: clean(result?.error, 500),
      sentAt: serverTimestamp()
    });
  } catch (error) {
    // El correo no debe considerarse fallido porque no se pudo guardar un log.
    console.error('[email-notify] No se pudo registrar el intento:', error);
  }
}

async function getIdToken_(forceRefresh = false) {
  try {
    return auth.currentUser
      ? await auth.currentUser.getIdToken(forceRefresh)
      : '';
  } catch {
    return '';
  }
}

async function postWebhook_(payload) {
  const response = await fetch(EMAIL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    // Permite que el envío iniciado después de guardar el pedido continúe si
    // la clienta cambia de página inmediatamente.
    keepalive: true
  });

  const body = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Respuesta inválida del servicio de correos (${response.status}).`);
  }

  if (!response.ok && parsed?.success !== true) {
    throw new Error(parsed?.error || `Error HTTP ${response.status}`);
  }
  return parsed;
}

/**
 * Envía el correo original o un reenvío administrativo.
 *
 * `order` se mantiene temporalmente en el body para que la implementación
 * anterior del Apps Script siga funcionando durante la actualización. La
 * versión nueva lo ignora y carga el documento real usando orderId + idToken.
 */
export async function sendOrderNotification(orderId, order, isResend = false) {
  if (!webhookConfigured()) {
    return { success: false, error: 'not_configured' };
  }

  const normalizedOrderId = clean(orderId, 220);
  if (!normalizedOrderId) {
    return { success: false, error: 'missing_order_id' };
  }

  const idToken = await getIdToken_(false);
  if (!idToken) {
    const result = {
      success: false,
      adminSent: false,
      customerSent: null,
      error: 'missing_id_token'
    };
    await logOrderEmailAttempt_(normalizedOrderId, order, isResend, result);
    return result;
  }

  const settings = await getEmailSettings_();
  if (settings.orderEmailsEnabled === false) {
    const result = {
      success: false,
      adminSent: null,
      customerSent: null,
      error: 'disabled'
    };
    await logOrderEmailAttempt_(normalizedOrderId, order, isResend, result);
    return result;
  }

  const sendAdmin = settings.internalEmailEnabled !== false;
  const sendCustomer = settings.customerEmailEnabled !== false;
  const resendDailyLimit = isResend
    ? Number(settings.resendDailyLimit) || 30
    : undefined;

  let result;
  try {
    result = await postWebhook_({
      secret: EMAIL_SECRET,
      action: isResend ? 'resendOrderEmail' : 'sendOrderEmail',
      orderId: normalizedOrderId,
      // Compatibilidad con la implementación anterior. El webhook seguro no
      // usa este objeto para construir el correo.
      order: order || {},
      isResend,
      sendAdmin,
      sendCustomer,
      idToken,
      resendDailyLimit
    });
  } catch (error) {
    console.error('[email-notify] Error enviando notificación:', error);
    result = {
      success: false,
      adminSent: false,
      customerSent: null,
      error: clean(error?.message || error, 500)
    };
  }

  await logOrderEmailAttempt_(normalizedOrderId, order, isResend, result);
  return result;
}

export async function sendTestCustomerEmail(toEmail) {
  if (!webhookConfigured()) return { success: false, error: 'not_configured' };
  try {
    const idToken = await getIdToken_(true);
    const settings = await getEmailSettings_();
    return await postWebhook_({
      secret: EMAIL_SECRET,
      action: 'sendTestCustomerEmail',
      toEmail: clean(toEmail, 254),
      idToken,
      testDailyLimit: Number(settings.testDailyLimit) || 20
    });
  } catch (error) {
    console.error('[email-notify] Error enviando correo de prueba:', error);
    return { success: false, error: clean(error?.message || error, 500) };
  }
}

export async function sendTemplatedEmail(payload) {
  if (!webhookConfigured()) return { success: false, error: 'not_configured' };
  try {
    const idToken = await getIdToken_(true);
    return await postWebhook_({
      secret: EMAIL_SECRET,
      action: 'sendPromoEmail',
      idToken,
      ...payload
    });
  } catch (error) {
    console.error('[email-notify] Error enviando correo con plantilla:', error);
    return { success: false, error: clean(error?.message || error, 500) };
  }
}

export async function sendBulkTemplatedEmail(payload) {
  if (!webhookConfigured()) return { success: false, error: 'not_configured' };
  try {
    const idToken = await getIdToken_(true);
    return await postWebhook_({
      secret: EMAIL_SECRET,
      action: 'sendBulkPromoEmail',
      idToken,
      ...payload
    });
  } catch (error) {
    console.error('[email-notify] Error enviando tanda de correos:', error);
    return { success: false, error: clean(error?.message || error, 500) };
  }
}

export { notificationStatusFromResult_ as notificationStatusFromResult };
