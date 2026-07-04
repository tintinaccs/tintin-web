/**
 * TINTIN — Notificación de pedidos por email (Google Apps Script webhook)
 * No depende de Firebase Cloud Functions / plan Blaze: el navegador llama
 * directo a un Apps Script propio que envía el correo con MailApp.
 * Ver functions/EMAIL_SETUP.md.
 */
import { EMAIL_WEBHOOK_URL, EMAIL_SECRET } from './email-config.js';

/**
 * @param {string} orderId - id del documento en Firestore (o '' si aún no se conoce)
 * @param {object} order - los mismos datos que se guardan en el pedido
 * @param {boolean} isResend - true cuando se llama desde el botón "Reenviar" del admin
 */
export async function sendOrderNotification(orderId, order, isResend = false) {
  if (!EMAIL_WEBHOOK_URL || EMAIL_WEBHOOK_URL.includes('PEGAR_')) {
    console.warn('[email-notify] EMAIL_WEBHOOK_URL no configurado todavía (ver js/email-config.js) — no se envió el correo.');
    return { success: false, error: 'not_configured' };
  }
  try {
    // Content-Type text/plain evita que el navegador mande un preflight
    // OPTIONS (Apps Script no lo responde bien) — Apps Script igual puede
    // leer y parsear el body como JSON del lado del script.
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: EMAIL_SECRET, orderId, order, isResend })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando notificación:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}

/**
 * Herramienta de prueba de Super Admin — Configuración → Prueba de correo.
 * Le pide al mismo Apps Script que manda un solo correo (el de confirmación
 * a la clienta, con el mismo diseño real) a cualquier dirección de prueba,
 * con datos de pedido ficticios. No crea ningún pedido, no toca stock, no
 * manda el correo interno a la tienda — el Apps Script rechaza esta acción
 * si no viene con el secreto correcto, igual que el flujo normal.
 * @param {string} toEmail - dirección de prueba escrita por el Super Admin
 */
export async function sendTestCustomerEmail(toEmail) {
  if (!EMAIL_WEBHOOK_URL || EMAIL_WEBHOOK_URL.includes('PEGAR_')) {
    console.warn('[email-notify] EMAIL_WEBHOOK_URL no configurado todavía (ver js/email-config.js) — no se envió el correo.');
    return { success: false, error: 'not_configured' };
  }
  try {
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: EMAIL_SECRET, action: 'testCustomerEmail', toEmail })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando correo de prueba:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}
