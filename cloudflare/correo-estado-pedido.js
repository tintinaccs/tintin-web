// Correo a la clienta en cada cambio de estado del pedido o del pago.
// Se dispara después del commit del pedido y es best-effort: un fallo de
// Resend nunca revierte ni falla el cambio ya confirmado.
import {
  EMAIL_MARK,
  FROM_EMAIL,
  REPLY_TO,
  clean,
  emailIsValid,
  escapeHtml,
  fmtPrice,
  sendResendEmail,
} from '../functions/api/order-email.js';

const STATUS_COPY = Object.freeze({
  confirmado: ['Confirmamos tu pedido', 'Tu pedido fue confirmado. Estamos preparando todo para vos.'],
  preparando: ['Estamos preparando tu pedido', 'Tu pedido está siendo preparado.'],
  listo_retiro: ['Tu pedido está listo para retirar', 'Ya podés retirar tu pedido en San Lorenzo. Te esperamos.'],
  en_camino: ['Tu pedido está en camino', 'Tu pedido salió hacia su destino.'],
  entregado: ['Entregamos tu pedido', 'Tu pedido figura como entregado. ¡Gracias por elegir Tintin!'],
  cancelado: ['Cancelamos tu pedido', 'Tu pedido fue cancelado. Si no lo esperabas, respondé a este correo.'],
  rechazado: ['No pudimos procesar tu pedido', 'Tu pedido fue rechazado. Respondé a este correo y lo revisamos juntas.'],
});

const PAYMENT_COPY = Object.freeze({
  pagado: ['Recibimos tu pago', 'Registramos el pago de tu pedido. ¡Gracias!'],
  rechazado: ['Tu pago fue rechazado', 'No pudimos validar el pago de tu pedido. Respondé a este correo para resolverlo.'],
  reembolsado: ['Reembolsamos tu pago', 'Registramos el reembolso de tu pedido.'],
});

/** Decide qué avisar. Devuelve null si no hay un cambio que notificar. */
export function describeOrderChange({ status, paymentStatus, previousStatus, previousPaymentStatus }) {
  const statusChanged = status && status !== previousStatus && STATUS_COPY[status];
  const paymentChanged = paymentStatus && paymentStatus !== previousPaymentStatus && PAYMENT_COPY[paymentStatus];
  if (!statusChanged && !paymentChanged) return null;
  const parts = [];
  if (statusChanged) parts.push(STATUS_COPY[status]);
  if (paymentChanged) parts.push(PAYMENT_COPY[paymentStatus]);
  return { title: parts[0][0], lines: parts.map(part => part[1]) };
}

export function buildOrderStatusEmail(order, orderId, change) {
  const shortId = clean(order.shortId, 30) || clean(orderId, 8).toUpperCase();
  const name = clean(order.userName || 'Tintina', 120);
  const paragraphs = change.lines.map(line => `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#5e5357">${escapeHtml(line)}</p>`).join('');
  const html = `<!doctype html>
<html lang="es"><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;background:#fffafb;background-image:linear-gradient(#fffafb,#fffafb);font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px">
    <div style="background:#ffffff;border:1px solid #f1dce5;border-radius:16px;overflow:hidden">
      <div style="padding:22px 24px;text-align:center;background:#ffd4e2;background-image:linear-gradient(#ffd4e2,#ffd4e2)">
        <img src="${EMAIL_MARK}" width="64" height="64" alt="Tintin" style="display:block;width:64px;height:64px;margin:0 auto 14px;border:0;outline:none;filter:grayscale(1) brightness(0) invert(1)">
        <div style="font-size:20px;font-weight:760;color:#2b2226;letter-spacing:-.02em">${escapeHtml(change.title)}</div>
        <div style="margin-top:7px;font-size:11px;font-weight:750;letter-spacing:.1em;color:#a00055">PEDIDO #${escapeHtml(shortId)}</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 16px;font-size:14.5px">Hola <strong>${escapeHtml(name)}</strong>,</p>
        ${paragraphs}
        <p style="margin:0 0 6px;font-size:13px;color:#7b6f72">Total del pedido: <strong style="color:#ad3f67">${escapeHtml(fmtPrice(order.total))}</strong></p>
        <p style="margin:22px 0 0;font-size:12.5px;line-height:1.65;color:#8a7d81">Podés responder directamente a este correo si necesitás comunicarte con Tintin.</p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;
  const text = `${change.title} — pedido #${shortId}\n\nHola ${name}:\n\n${change.lines.join('\n\n')}\n\nTotal del pedido: ${fmtPrice(order.total)}\n\nPodés responder directamente a este correo para comunicarte con Tintin.`;
  return { subject: `${change.title} · pedido #${shortId} — Tintin`, html, text };
}

/**
 * `result` es el resultado de applyOrderAdminMutation. No hace nada si fue un
 * duplicado, si no cambió el estado o si falta la clave de Resend o el correo.
 */
export async function notifyCustomerOrderChange(env, result, { send = sendResendEmail } = {}) {
  try {
    if (!result || result.duplicate || !result.order) return { sent: false, reason: 'no_change' };
    const apiKey = clean(env?.RESEND_API_KEY, 500);
    if (!apiKey) return { sent: false, reason: 'no_api_key' };
    const change = describeOrderChange({
      status: result.status,
      paymentStatus: result.paymentStatus,
      previousStatus: result.previousStatus,
      previousPaymentStatus: result.previousPaymentStatus,
    });
    if (!change) return { sent: false, reason: 'no_change' };
    const recipient = clean(result.order.userEmail || result.order.contactEmail, 254).toLowerCase();
    if (!emailIsValid(recipient)) return { sent: false, reason: 'invalid_email' };
    const content = buildOrderStatusEmail(result.order, result.orderId, change);
    await send(apiKey, {
      from: FROM_EMAIL,
      to: [recipient],
      reply_to: REPLY_TO,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }, `order-${result.orderId}-status-${clean(result.changeId, 100)}`);
    return { sent: true };
  } catch (error) {
    console.error('[correo-estado-pedido]', error?.message || error);
    return { sent: false, reason: 'error' };
  }
}
