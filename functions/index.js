// =============================================
// TINTIN — Firebase Cloud Functions
// Notifications when a new order is placed
// =============================================
// Deploy: cd functions && npm install && firebase deploy --only functions
//
// Set credentials BEFORE deploying (never put these in source code):
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_PASS
//
// Use a Gmail App Password (not your real password):
//   Google Account → Security → 2-Step Verification → App passwords
// =============================================

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret }       = require('firebase-functions/params');
const { initializeApp }      = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer             = require('nodemailer');

initializeApp();

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_PASS = defineSecret('GMAIL_PASS');

const ADMIN_EMAIL   = 'tintinaccs@gmail.com';
const STORE_NAME    = 'Tintin Accesorios';
const ADMIN_PANEL   = 'https://tintinaccs.github.io/tintin-web/admin.html';

// ── Format helpers ──────────────────────────
function fmtPrice(n) {
  return `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
}

function buildEmailBody(orderId, order) {
  const shortId = order.shortId || orderId.slice(0, 8).toUpperCase();
  const items = (order.items || [])
    .map(i => `  • ${i.qty}x ${i.name} — ${fmtPrice(i.price * i.qty)}`)
    .join('\n');

  const shipMethod = {
    delivery:   '🚚 Delivery (Zona Central)',
    encomienda: '📦 Encomienda (Interior)',
    retiro:     '🏪 Retiro en tienda'
  }[order.shipping?.method || ''] || order.shipping?.method || '—';

  const payMethod = {
    efectivo:      '💵 Efectivo (contra entrega)',
    transferencia: '🏦 Transferencia bancaria',
    pagopark:      '📱 PagoPark',
    tarjeta:       '💳 Tarjeta'
  }[order.payment?.method || ''] || order.payment?.method || '—';

  return `🛍️ NUEVO PEDIDO — ${STORE_NAME.toUpperCase()}
${'━'.repeat(40)}
📋 Pedido:   #${shortId}
📅 Fecha:    ${fmtDate(order.createdAt)}
${'━'.repeat(40)}
👤 Cliente:  ${order.userName || '—'}
📞 Teléfono: ${order.userPhone || '—'}
${order.userEmail ? `📧 Email:    ${order.userEmail}` : ''}
📍 Ciudad:   ${order.shipping?.city || '—'}
${order.shipping?.address ? `🏠 Dirección: ${order.shipping.address}` : ''}
${order.shipping?.referencia ? `📌 Referencia: ${order.shipping.referencia}` : ''}
${'━'.repeat(40)}
🚚 Entrega:  ${shipMethod}
💳 Pago:     ${payMethod}
${'━'.repeat(40)}
🛒 PRODUCTOS:
${items}
${'━'.repeat(40)}
   Subtotal:  ${fmtPrice(order.subtotal)}
   Envío:     ${fmtPrice(order.shippingCost)}
💰 TOTAL:    ${fmtPrice(order.total)}
${'━'.repeat(40)}
📊 Estado pedido: ${order.status || 'pendiente'}
💳 Estado pago:   ${order.payment?.status || 'pendiente'}
${order.notes ? `\n📝 Notas: ${order.notes}` : ''}
${'━'.repeat(40)}
👉 Ver en admin: ${ADMIN_PANEL}
`;
}

// ── Main Cloud Function ──────────────────────
exports.notifyNewOrder = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    secrets:  [GMAIL_USER, GMAIL_PASS],
    region:   'us-central1'
  },
  async (event) => {
    const snap    = event.data;
    if (!snap) return;

    const orderId = event.params.orderId;
    const order   = snap.data();
    const db      = getFirestore();
    const orderRef = db.collection('orders').doc(orderId);

    const gmailUser = GMAIL_USER.value();
    const gmailPass = GMAIL_PASS.value();

    if (!gmailUser || !gmailPass) {
      console.error('Email secrets not configured. Run: firebase functions:secrets:set GMAIL_USER GMAIL_PASS');
      await orderRef.update({
        notificationStatus: 'error',
        notificationError:  'Email secrets not configured'
      }).catch(() => {});
      return;
    }

    const subject  = `🛍️ Nuevo pedido #${order.shortId || orderId.slice(0, 8).toUpperCase()} — ${STORE_NAME}`;
    const bodyText = buildEmailBody(orderId, order);

    // HTML version of the same message (simple table)
    const itemRows = (order.items || []).map(i => `
      <tr>
        <td style="padding:6px 8px">${i.qty}x ${i.name}</td>
        <td style="padding:6px 8px;text-align:right">Gs. ${Number(i.price * i.qty).toLocaleString('es-PY')}</td>
      </tr>`).join('');

    const bodyHtml = `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;background:#fef5f8;padding:24px">
<div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #f0d8e0">
  <h2 style="color:#b84c72;margin:0 0 16px">🛍️ Nuevo pedido — ${STORE_NAME}</h2>
  <p style="color:#888;margin:0 0 20px">Pedido <strong>#${order.shortId || orderId.slice(0,8).toUpperCase()}</strong> recibido el ${fmtDate(order.createdAt)}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td><strong>${order.userName || '—'}</strong></td></tr>
    <tr><td style="color:#888;padding:4px 0">Teléfono</td><td>${order.userPhone || '—'}</td></tr>
    ${order.userEmail ? `<tr><td style="color:#888;padding:4px 0">Email</td><td>${order.userEmail}</td></tr>` : ''}
    <tr><td style="color:#888;padding:4px 0">Ciudad</td><td>${order.shipping?.city || '—'}</td></tr>
    ${order.shipping?.address ? `<tr><td style="color:#888;padding:4px 0">Dirección</td><td>${order.shipping.address}</td></tr>` : ''}
    ${order.shipping?.referencia ? `<tr><td style="color:#888;padding:4px 0">Referencia</td><td>${order.shipping.referencia}</td></tr>` : ''}
    <tr><td style="color:#888;padding:4px 0">Entrega</td><td>${order.shipping?.method || '—'}</td></tr>
    <tr><td style="color:#888;padding:4px 0">Pago</td><td>${order.payment?.method || '—'}</td></tr>
  </table>
  <h3 style="color:#b84c72;margin:16px 0 8px">Productos</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    ${itemRows}
    <tr style="border-top:2px solid #f0d8e0">
      <td style="padding:8px;color:#888">Subtotal</td>
      <td style="padding:8px;text-align:right">Gs. ${Number(order.subtotal||0).toLocaleString('es-PY')}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;color:#888">Envío</td>
      <td style="padding:4px 8px;text-align:right">Gs. ${Number(order.shippingCost||0).toLocaleString('es-PY')}</td>
    </tr>
    <tr style="background:#fef5f8">
      <td style="padding:10px 8px;font-weight:700;color:#b84c72;font-size:16px">TOTAL</td>
      <td style="padding:10px 8px;text-align:right;font-weight:700;color:#b84c72;font-size:16px">Gs. ${Number(order.total||0).toLocaleString('es-PY')}</td>
    </tr>
  </table>
  ${order.notes ? `<p style="background:#fef5f8;border-radius:8px;padding:12px;color:#555"><strong>Notas:</strong> ${order.notes}</p>` : ''}
  <a href="${ADMIN_PANEL}" style="display:inline-block;margin-top:16px;background:#b84c72;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ver pedido en admin →</a>
</div></body></html>`;

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass }
      });

      await transporter.sendMail({
        from:    `"${STORE_NAME}" <${gmailUser}>`,
        to:      ADMIN_EMAIL,
        subject,
        text:    bodyText,
        html:    bodyHtml
      });

      await orderRef.update({
        notificationStatus:  'sent',
        notificationSent:    true,
        notificationSentAt:  FieldValue.serverTimestamp()
      });

      console.log(`Notification sent for order ${orderId}`);

    } catch (err) {
      console.error('Notification error:', err);
      await orderRef.update({
        notificationStatus: 'error',
        notificationSent:   false,
        notificationError:  String(err.message || err)
      }).catch(() => {});
    }
  }
);
