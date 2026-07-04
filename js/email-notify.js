/**
 * TINTIN — Notificación de pedidos por email (Google Apps Script webhook)
 * No depende de Firebase Cloud Functions / plan Blaze: el navegador llama
 * directo a un Apps Script propio que envía el correo con MailApp.
 * Ver functions/EMAIL_SETUP.md.
 */
import { EMAIL_WEBHOOK_URL, EMAIL_SECRET } from './email-config.js';
import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Lee los switches de Super Admin → Correos → Configuración. Falla "abierto"
// (todo activado) si el documento no existe todavía o si la lectura falla —
// así una cuenta que nunca abrió el módulo Correos sigue mandando los
// correos de pedido exactamente como siempre, sin ningún cambio de
// comportamiento por default.
async function getEmailSettings_() {
  try {
    const snap = await getDoc(doc(db, 'emailSettings', 'main'));
    return snap.exists() ? snap.data() : {};
  } catch (e) {
    return {};
  }
}

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
  const settings = await getEmailSettings_();
  if (settings.orderEmailsEnabled === false) {
    return { success: false, error: 'disabled', adminSent: null, customerSent: null };
  }
  const sendAdmin    = settings.internalEmailEnabled !== false;
  const sendCustomer = settings.customerEmailEnabled !== false;
  try {
    // Content-Type text/plain evita que el navegador mande un preflight
    // OPTIONS (Apps Script no lo responde bien) — Apps Script igual puede
    // leer y parsear el body como JSON del lado del script.
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: EMAIL_SECRET, orderId, order, isResend, sendAdmin, sendCustomer })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando notificación:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}

/**
 * Herramienta de prueba de Super Admin — Correos → Correos de prueba.
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
      body: JSON.stringify({ secret: EMAIL_SECRET, action: 'sendTestCustomerEmail', toEmail })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando correo de prueba:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}

/**
 * Correo genérico armado desde una plantilla (Super Admin → Correos →
 * Plantillas / Promociones / Correos de pedidos con plantilla editable) —
 * un solo destinatario. `variables` son los únicos valores "reales" que
 * viajan (nombre de la clienta, número de pedido, etc.) — siempre calculados
 * por quien llama a partir del pedido real, del perfil real o de datos
 * ficticios de prueba, nunca tipeados a mano en el lugar de una variable.
 * @param {object} payload - { to, subject, greeting, intro, closing, signature, promoText, buttonText, buttonUrl, brandPhrase, footer, variables }
 */
export async function sendTemplatedEmail(payload) {
  if (!EMAIL_WEBHOOK_URL || EMAIL_WEBHOOK_URL.includes('PEGAR_')) {
    console.warn('[email-notify] EMAIL_WEBHOOK_URL no configurado todavía (ver js/email-config.js) — no se envió el correo.');
    return { success: false, error: 'not_configured' };
  }
  try {
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: EMAIL_SECRET, action: 'sendPromoEmail', ...payload })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando correo con plantilla:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}

/**
 * Igual que sendTemplatedEmail pero para varias destinatarias en una sola
 * llamada (Super Admin → Correos → Promociones). El sitio corta la lista en
 * tandas de a lo sumo 25 antes de llamar (mismo tope que aplica el Apps
 * Script como segundo blindaje) — ver `sendBulkPromoBatches` en admin.html.
 * @param {object} payload - { subject, greeting, intro, closing, signature, promoText, buttonText, buttonUrl, brandPhrase, footer, recipients:[{to,variables}] }
 */
export async function sendBulkTemplatedEmail(payload) {
  if (!EMAIL_WEBHOOK_URL || EMAIL_WEBHOOK_URL.includes('PEGAR_')) {
    console.warn('[email-notify] EMAIL_WEBHOOK_URL no configurado todavía (ver js/email-config.js) — no se envió el correo.');
    return { success: false, error: 'not_configured' };
  }
  try {
    const res = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: EMAIL_SECRET, action: 'sendBulkPromoEmail', ...payload })
    });
    return await res.json();
  } catch (e) {
    console.error('[email-notify] Error enviando tanda de correos:', e);
    return { success: false, error: String(e && e.message || e) };
  }
}
