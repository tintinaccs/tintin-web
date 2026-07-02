// =============================================
// TINTIN — Firebase Cloud Functions
// Notifications when a new order is placed + manual resend from Super Admin
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

const { onDocumentCreated }  = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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

function fmtShipping(order) {
  return (order.shippingCost == null || order.shippingPending) ? 'A confirmar con un vendedor' : fmtPrice(order.shippingCost);
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'full', timeStyle: 'short' }) + ' (hora de Paraguay)';
}

function zoneLabel(order) {
  return { central: 'Zona Central', interior: 'Interior del país' }[order.shipping?.zone] || '—';
}

function waLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function shipMethodLabel(order) {
  return {
    delivery:   '🚚 Delivery (Zona Central)',
    encomienda: '📦 Encomienda (Interior)',
    retiro:     '🏪 Retiro en tienda'
  }[order.shipping?.method || ''] || order.shipping?.method || '—';
}

function payMethodLabel(order) {
  return {
    efectivo:      '💵 Efectivo (contra entrega)',
    transferencia: '🏦 Transferencia bancaria',
    pagopark:      '📱 PagoPark',
    tarjeta:       '💳 Tarjeta'
  }[order.payment?.method || ''] || order.payment?.method || '—';
}

// ── Email body builders ──────────────────────
function buildEmailText(orderId, order) {
  const shortId = order.shortId || orderId.slice(0, 8).toUpperCase();
  const items = (order.items || [])
    .map(i => `  • ${i.qty}x ${i.name} — ${fmtPrice(i.price * i.qty)}`)
    .join('\n');
  const wa = waLink(order.userPhone);

  return `🛍️ PEDIDO — ${STORE_NAME.toUpperCase()}
${'━'.repeat(40)}
📋 Pedido:   #${shortId}
📅 Fecha:    ${fmtDate(order.createdAt)}
${'━'.repeat(40)}
👤 Cliente:  ${order.userName || '—'}
📞 Teléfono: ${order.userPhone || '—'}
${wa ? `💬 WhatsApp: ${wa}` : ''}
${order.userEmail ? `📧 Email:    ${order.userEmail}` : ''}
📍 Ciudad:   ${order.shipping?.city || '—'}
🗺️ Zona:     ${zoneLabel(order)}
${order.shipping?.address ? `🏠 Dirección: ${order.shipping.address}` : ''}
${order.shipping?.referencia ? `📌 Referencia: ${order.shipping.referencia}` : ''}
${order.shipping?.mapLocation ? `📌 Ubicación GPS: https://maps.google.com/?q=${order.shipping.mapLocation.lat},${order.shipping.mapLocation.lng}` : ''}
${'━'.repeat(40)}
🚚 Entrega:  ${shipMethodLabel(order)}
💳 Pago:     ${payMethodLabel(order)}
${'━'.repeat(40)}
🛒 PRODUCTOS:
${items}
${'━'.repeat(40)}
   Subtotal:  ${fmtPrice(order.subtotal)}
   Envío:     ${fmtShipping(order)}
💰 TOTAL:    ${fmtPrice(order.total)}${order.shippingPending ? ' (+ envío a coordinar)' : ''}
${'━'.repeat(40)}
📊 Estado pedido: ${order.status || 'pendiente'}
💳 Estado pago:   ${order.payment?.status || 'pendiente'}
${order.notes ? `\n📝 Notas: ${order.notes}` : ''}
${'━'.repeat(40)}
👉 Ver en admin: ${ADMIN_PANEL}
`;
}

function buildEmailHtml(orderId, order) {
  const shortId = order.shortId || orderId.slice(0, 8).toUpperCase();
  const wa = waLink(order.userPhone);

  const itemRows = (order.items || []).map(i => `
      <tr>
        <td style="padding:6px 8px">${i.qty}x ${i.name}</td>
        <td style="padding:6px 8px;text-align:right">Gs. ${Number(i.price * i.qty).toLocaleString('es-PY')}</td>
      </tr>`).join('');

  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;background:#fef5f8;padding:24px">
<div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #f0d8e0">
  <h2 style="color:#b84c72;margin:0 0 16px">🛍️ Pedido — ${STORE_NAME}</h2>
  <p style="color:#888;margin:0 0 20px">Pedido <strong>#${shortId}</strong> recibido el ${fmtDate(order.createdAt)}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td><strong>${order.userName || '—'}</strong></td></tr>
    <tr><td style="color:#888;padding:4px 0">Teléfono</td><td>${order.userPhone || '—'}</td></tr>
    ${order.userEmail ? `<tr><td style="color:#888;padding:4px 0">Email</td><td>${order.userEmail}</td></tr>` : ''}
    <tr><td style="color:#888;padding:4px 0">Ciudad</td><td>${order.shipping?.city || '—'}</td></tr>
    <tr><td style="color:#888;padding:4px 0">Zona</td><td>${zoneLabel(order)}</td></tr>
    ${order.shipping?.address ? `<tr><td style="color:#888;padding:4px 0">Dirección</td><td>${order.shipping.address}</td></tr>` : ''}
    ${order.shipping?.referencia ? `<tr><td style="color:#888;padding:4px 0">Referencia</td><td>${order.shipping.referencia}</td></tr>` : ''}
    ${order.shipping?.mapLocation ? `<tr><td style="color:#888;padding:4px 0">Ubicación</td><td><a href="https://maps.google.com/?q=${order.shipping.mapLocation.lat},${order.shipping.mapLocation.lng}">Ver en el mapa</a></td></tr>` : ''}
    <tr><td style="color:#888;padding:4px 0">Entrega</td><td>${shipMethodLabel(order)}</td></tr>
    <tr><td style="color:#888;padding:4px 0">Pago</td><td>${payMethodLabel(order)}</td></tr>
    <tr><td style="color:#888;padding:4px 0">Estado pedido</td><td>${order.status || 'pendiente'}</td></tr>
    <tr><td style="color:#888;padding:4px 0">Estado pago</td><td>${order.payment?.status || 'pendiente'}</td></tr>
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
      <td style="padding:4px 8px;text-align:right">${fmtShipping(order)}</td>
    </tr>
    <tr style="background:#fef5f8">
      <td style="padding:10px 8px;font-weight:700;color:#b84c72;font-size:16px">TOTAL</td>
      <td style="padding:10px 8px;text-align:right;font-weight:700;color:#b84c72;font-size:16px">Gs. ${Number(order.total||0).toLocaleString('es-PY')}${order.shippingPending ? ' <span style="font-size:11px;font-weight:400;color:#888">(+ envío a coordinar)</span>' : ''}</td>
    </tr>
  </table>
  ${order.notes ? `<p style="background:#fef5f8;border-radius:8px;padding:12px;color:#555"><strong>Notas:</strong> ${order.notes}</p>` : ''}
  <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
    <a href="${ADMIN_PANEL}" style="display:inline-block;background:#b84c72;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ver pedido en admin →</a>
    ${wa ? `<a href="${wa}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">💬 WhatsApp del cliente</a>` : ''}
  </div>
</div></body></html>`;
}

// ── Shared send logic (used by the new-order trigger and the manual resend) ──
async function sendOrderEmail({ orderId, order, gmailUser, gmailPass, isResend }) {
  const db = getFirestore();
  const orderRef = db.collection('orders').doc(orderId);

  const shortId = order.shortId || orderId.slice(0, 8).toUpperCase();
  const subject = `${isResend ? '🔁 [Reenviado] ' : '🛍️ '}Pedido #${shortId} — ${STORE_NAME}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass }
  });

  await transporter.sendMail({
    from:    `"${STORE_NAME}" <${gmailUser}>`,
    to:      ADMIN_EMAIL,
    subject,
    text:    buildEmailText(orderId, order),
    html:    buildEmailHtml(orderId, order)
  });

  const update = {
    notificationStatus:  'sent',
    notificationSent:    true,
    notificationSentAt:  FieldValue.serverTimestamp(),
    notificationError:   FieldValue.delete()
  };
  if (isResend) {
    update.resendCount  = FieldValue.increment(1);
    update.lastResendAt = FieldValue.serverTimestamp();
  }
  await orderRef.update(update);
}

// ── Cloud Function: send on new order ──────────────────────
exports.notifyNewOrder = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    secrets:  [GMAIL_USER, GMAIL_PASS],
    region:   'us-central1'
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const orderId = event.params.orderId;
    const order    = snap.data();
    const db       = getFirestore();
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

    try {
      await sendOrderEmail({ orderId, order, gmailUser, gmailPass, isResend: false });
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

// ── Cloud Function: manual resend from Super Admin → Pedidos ──────────────────────
exports.resendOrderEmail = onCall(
  {
    secrets: [GMAIL_USER, GMAIL_PASS],
    region:  'us-central1'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');
    }

    const db = getFirestore();
    const callerEmail = request.auth.token.email || '';
    let isAdmin = callerEmail === ADMIN_EMAIL;
    if (!isAdmin) {
      const callerDoc = await db.collection('users').doc(request.auth.uid).get();
      const role = callerDoc.exists ? callerDoc.data().role : null;
      isAdmin = role === 'admin' || role === 'superadmin';
    }
    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Solo un administrador puede reenviar el correo de un pedido.');
    }

    const orderId = request.data?.orderId;
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'Falta el ID del pedido.');
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'El pedido no existe.');
    }

    const gmailUser = GMAIL_USER.value();
    const gmailPass = GMAIL_PASS.value();
    if (!gmailUser || !gmailPass) {
      throw new HttpsError('failed-precondition', 'El envío de correo no está configurado (faltan credenciales de Gmail).');
    }

    try {
      await sendOrderEmail({ orderId, order: orderSnap.data(), gmailUser, gmailPass, isResend: true });
    } catch (err) {
      console.error('Resend error:', err);
      await orderRef.update({
        notificationStatus: 'error',
        notificationError:  String(err.message || err)
      }).catch(() => {});
      throw new HttpsError('internal', 'No se pudo reenviar el correo: ' + (err.message || err));
    }

    const updated = await orderRef.get();
    return { success: true, resendCount: updated.data().resendCount || 1 };
  }
);
