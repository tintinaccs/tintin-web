import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  SUPERADMIN_EMAIL
} from '../../cloudflare/cloudinary-security.js';

const FIREBASE_WEB_API_KEY = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';
const FIREBASE_PROJECT_ID = 'tintin-accesorios';
const ADMIN_EMAIL = SUPERADMIN_EMAIL;
const FROM_EMAIL = 'Tintin Pedidos <pedidos@tintinaccs.com>';
const REPLY_TO = ADMIN_EMAIL;
const ADMIN_PANEL = 'https://tintinaccesorios.pages.dev/admin.html';
const STORE_NAME = 'Tintin Accesorios';

function clean(value, maxLength = 1000) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean(value, 254));
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Necesitás iniciar sesión nuevamente.');
  return match[1].trim();
}

async function verifyFirebaseUser(idToken) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = clean(data?.error?.message, 120);
    if (/INVALID_ID_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND/i.test(reason)) {
      throw new Error('La sesión venció; volvé a iniciar sesión.');
    }
    throw new Error('No se pudo validar la sesión.');
  }

  const user = Array.isArray(data.users) ? data.users[0] : null;
  const email = clean(user?.email, 254).toLowerCase();
  if (!user?.localId || !email || user.emailVerified !== true) {
    throw new Error('La cuenta debe tener un correo verificado.');
  }
  return { uid: clean(user.localId, 128), email };
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('geoPointValue' in value) {
    return {
      lat: Number(value.geoPointValue.latitude),
      lng: Number(value.geoPointValue.longitude)
    };
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in value) {
    return decodeFirestoreFields(value.mapValue.fields || {});
  }
  return null;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

async function fetchOrder(orderId, idToken) {
  const safeOrderId = clean(orderId, 220);
  if (!safeOrderId || !/^[A-Za-z0-9_-]{12,220}$/.test(safeOrderId)) {
    throw new Error('Pedido inválido.');
  }

  const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(safeOrderId)}`;
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${idToken}` }
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 404) throw new Error('No se encontró el pedido.');
  if (!response.ok) {
    if (response.status === 403) throw new Error('No tenés permiso para acceder a este pedido.');
    const reason = clean(data?.error?.message || data?.error?.status, 200);
    throw new Error(`No se pudo leer el pedido (HTTP ${response.status}${reason ? `: ${reason}` : ''}).`);
  }

  return decodeFirestoreFields(data.fields || {});
}

function fmtPrice(value) {
  return `Gs. ${Number(value || 0).toLocaleString('es-PY')}`;
}

function fmtDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'full',
    timeStyle: 'short'
  });
}

function shippingLabel(order) {
  const method = clean(order?.shipping?.method, 40);
  return {
    delivery: 'Delivery (Zona Central)',
    encomienda: 'Encomienda (Interior)',
    retiro: 'Retiro en San Lorenzo'
  }[method] || method || 'A coordinar';
}

function paymentLabel(order) {
  const method = clean(order?.payment?.method, 40);
  return {
    efectivo: 'Efectivo contra entrega',
    transferencia: 'Transferencia bancaria',
    pagopark: 'PagoPark',
    tarjeta: 'Tarjeta'
  }[method] || method || 'A coordinar';
}

function customerEmail(order, orderId) {
  const shortId = clean(order.shortId, 30) || clean(orderId, 8).toUpperCase();
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f2e4e9;color:#2b2b2b">
        ${escapeHtml(item.qty)}x ${escapeHtml(item.name)}
        ${item.variant ? `<div style="font-size:12px;color:#7b6f72">${escapeHtml(item.variant)}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2e4e9;text-align:right;color:#2b2b2b">
        ${escapeHtml(fmtPrice(Number(item.price || 0) * Number(item.qty || 0)))}
      </td>
    </tr>`).join('');

  const textItems = items
    .map(item => `${item.qty}x ${clean(item.name, 180)} — ${fmtPrice(Number(item.price || 0) * Number(item.qty || 0))}`)
    .join('\n');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fdf1f5;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border:1px solid #f1e4e7;border-radius:20px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#c6557d,#8e274d);padding:26px 24px;text-align:center">
        <div style="width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:rgba(255,255,255,.16);line-height:52px;font-size:24px">✓</div>
        <div style="font-size:20px;font-weight:750;color:#ffffff;letter-spacing:-.01em">¡Recibimos tu pedido!</div>
        <div style="margin-top:6px;font-size:12.5px;font-weight:600;letter-spacing:.06em;color:rgba(255,255,255,.78)">PEDIDO #${escapeHtml(shortId)}</div>
      </div>
      <div style="padding:30px 28px">
        <p style="margin:0 0 16px;font-size:14.5px">Hola <strong>${escapeHtml(order.userName || 'Tintina')}</strong>,</p>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#5e5357">
          Tu pedido fue registrado correctamente. En breve nos comunicaremos contigo para confirmar los detalles de entrega y pago.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 18px">${rows}</table>
        <table style="width:100%;border-collapse:collapse;background:#fdf6f9;border-radius:14px">
          <tr><td style="padding:12px 14px;font-size:13px;color:#7b6f72">Subtotal</td><td style="padding:12px 14px;font-size:13px;text-align:right">${escapeHtml(fmtPrice(order.subtotal))}</td></tr>
          <tr><td style="padding:0 14px 12px;font-size:13px;color:#7b6f72">Envío</td><td style="padding:0 14px 12px;font-size:13px;text-align:right">${order.shippingPending ? 'A confirmar' : escapeHtml(fmtPrice(order.shippingCost))}</td></tr>
          <tr><td style="padding:12px 14px;font-size:14.5px;font-weight:700;color:#ad3f67;border-top:1px solid #f1e4e7">Total</td><td style="padding:12px 14px;font-size:14.5px;text-align:right;font-weight:700;color:#ad3f67;border-top:1px solid #f1e4e7">${escapeHtml(fmtPrice(order.total))}</td></tr>
        </table>
        <div style="margin-top:18px;padding:16px 18px;background:#fdf6f9;border-radius:14px;font-size:13px;line-height:1.7;color:#5e5357">
          <strong style="color:#2b2226">Entrega:</strong> ${escapeHtml(shippingLabel(order))}<br>
          <strong style="color:#2b2226">Pago:</strong> ${escapeHtml(paymentLabel(order))}
        </div>
        <p style="margin:22px 0 0;font-size:12.5px;line-height:1.65;color:#8a7d81">
          Podés responder directamente a este correo si necesitás comunicarte con Tintin.
        </p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;

  const text = `Recibimos tu pedido #${shortId}

Hola ${clean(order.userName || 'Tintina', 120)}:

Tu pedido fue registrado correctamente. En breve nos comunicaremos contigo para confirmar los detalles de entrega y pago.

${textItems}

Subtotal: ${fmtPrice(order.subtotal)}
Envío: ${order.shippingPending ? 'A confirmar' : fmtPrice(order.shippingCost)}
Total: ${fmtPrice(order.total)}
Entrega: ${shippingLabel(order)}
Pago: ${paymentLabel(order)}

Podés responder directamente a este correo para comunicarte con Tintin.`;

  return {
    subject: `Recibimos tu pedido #${shortId} — Tintin`,
    html,
    text
  };
}

function adminEmail(order, orderId) {
  const shortId = clean(order.shortId, 30) || clean(orderId, 8).toUpperCase();
  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f2e4e9">${escapeHtml(item.qty)}x ${escapeHtml(item.name)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f2e4e9;text-align:right">${escapeHtml(fmtPrice(Number(item.price || 0) * Number(item.qty || 0)))}</td>
    </tr>`).join('');

  const mapLocation = order?.shipping?.mapLocation;
  const mapLink = mapLocation && Number.isFinite(Number(mapLocation.lat)) && Number.isFinite(Number(mapLocation.lng))
    ? `https://maps.google.com/?q=${encodeURIComponent(`${mapLocation.lat},${mapLocation.lng}`)}`
    : '';

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fdf1f5;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#2b2226">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border:1px solid #f1e4e7;border-radius:20px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#c6557d,#8e274d);padding:22px 24px;text-align:center">
        <div style="font-size:18px;font-weight:750;color:#ffffff;letter-spacing:-.01em">Nuevo pedido #${escapeHtml(shortId)}</div>
        <div style="margin-top:5px;font-size:12px;color:rgba(255,255,255,.78)">${escapeHtml(fmtDate(order.createdAt))}</div>
      </div>
      <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.5">
        <tr><td style="padding:5px 0;color:#7b6f72;width:150px">Cliente</td><td style="padding:5px 0"><strong>${escapeHtml(order.userName)}</strong></td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Correo</td><td style="padding:5px 0">${escapeHtml(order.userEmail)}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Teléfono</td><td style="padding:5px 0">${escapeHtml(order.userPhone)}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Ciudad</td><td style="padding:5px 0">${escapeHtml(order?.shipping?.city)}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Dirección</td><td style="padding:5px 0">${escapeHtml(order?.shipping?.address || '—')}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Referencia</td><td style="padding:5px 0">${escapeHtml(order?.shipping?.referencia || '—')}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Entrega</td><td style="padding:5px 0">${escapeHtml(shippingLabel(order))}</td></tr>
        <tr><td style="padding:5px 0;color:#7b6f72">Pago</td><td style="padding:5px 0">${escapeHtml(paymentLabel(order))}</td></tr>
      </table>
      ${mapLink ? `<p style="margin:14px 0 0;font-size:13px"><a href="${mapLink}" style="color:#ad3f67">Ver ubicación en Google Maps</a></p>` : ''}
      <h2 style="margin:24px 0 8px;color:#2b2226;font-size:15px">Productos</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px">${itemRows}</table>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;background:#fdf6f9;border-radius:14px;font-size:13.5px">
        <tr><td style="padding:12px 14px;color:#7b6f72">Subtotal</td><td style="padding:12px 14px;text-align:right">${escapeHtml(fmtPrice(order.subtotal))}</td></tr>
        <tr><td style="padding:0 14px 12px;color:#7b6f72">Envío</td><td style="padding:0 14px 12px;text-align:right">${order.shippingPending ? 'A confirmar' : escapeHtml(fmtPrice(order.shippingCost))}</td></tr>
        <tr><td style="padding:12px 14px;font-weight:700;color:#ad3f67;border-top:1px solid #f1e4e7">Total</td><td style="padding:12px 14px;text-align:right;font-weight:700;color:#ad3f67;border-top:1px solid #f1e4e7">${escapeHtml(fmtPrice(order.total))}</td></tr>
      </table>
      ${order.notes ? `<p style="margin:18px 0 0;padding:14px 16px;background:#fdf6f9;border-radius:12px;font-size:13px"><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>` : ''}
      <p style="margin:24px 0 0;text-align:center"><a href="${ADMIN_PANEL}" style="display:inline-block;background:#ad3f67;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:13.5px">Abrir Super Admin</a></p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#b6a7ac">Tintin Accesorios &amp; Relojes</p>
  </div>
</body>
</html>`;

  const textItems = items
    .map(item => `${item.qty}x ${clean(item.name, 180)} — ${fmtPrice(Number(item.price || 0) * Number(item.qty || 0))}`)
    .join('\n');

  const text = `NUEVO PEDIDO #${shortId}
Fecha: ${fmtDate(order.createdAt)}

Cliente: ${clean(order.userName, 120)}
Correo: ${clean(order.userEmail, 254)}
Teléfono: ${clean(order.userPhone, 40)}
Ciudad: ${clean(order?.shipping?.city, 120)}
Dirección: ${clean(order?.shipping?.address || '—', 300)}
Referencia: ${clean(order?.shipping?.referencia || '—', 300)}
Entrega: ${shippingLabel(order)}
Pago: ${paymentLabel(order)}

${textItems}

Subtotal: ${fmtPrice(order.subtotal)}
Envío: ${order.shippingPending ? 'A confirmar' : fmtPrice(order.shippingCost)}
Total: ${fmtPrice(order.total)}
${order.notes ? `Notas: ${clean(order.notes, 1000)}` : ''}

Super Admin: ${ADMIN_PANEL}`;

  return {
    subject: `Nuevo pedido #${shortId} — ${STORE_NAME}`,
    html,
    text
  };
}

async function sendResendEmail(apiKey, payload, idempotencyKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(data?.message || data?.error || `Resend HTTP ${response.status}`, 300));
  }
  return data;
}

async function sendOrderEmails({ apiKey, orderId, order, isResend, sendAdmin, sendCustomer }) {
  const suffix = isResend ? `resend-${Date.now()}` : 'new-v1';
  let adminSent = null;
  let customerSent = null;
  const errors = [];

  if (sendAdmin) {
    try {
      const content = adminEmail(order, orderId);
      await sendResendEmail(apiKey, {
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        reply_to: REPLY_TO,
        subject: isResend ? `[Reenviado] ${content.subject}` : content.subject,
        html: content.html,
        text: content.text
      }, `order-${orderId}-admin-${suffix}`);
      adminSent = true;
    } catch (error) {
      adminSent = false;
      errors.push(`Dueña: ${clean(error?.message || error, 300)}`);
    }
  }

  if (sendCustomer) {
    const recipient = clean(order.userEmail, 254).toLowerCase();
    if (!emailIsValid(recipient)) {
      customerSent = false;
      errors.push('Clienta: correo inválido');
    } else {
      try {
        const content = customerEmail(order, orderId);
        await sendResendEmail(apiKey, {
          from: FROM_EMAIL,
          to: [recipient],
          reply_to: REPLY_TO,
          subject: isResend ? `[Reenviado] ${content.subject}` : content.subject,
          html: content.html,
          text: content.text
        }, `order-${orderId}-customer-${suffix}`);
        customerSent = true;
      } catch (error) {
        customerSent = false;
        errors.push(`Clienta: ${clean(error?.message || error, 300)}`);
      }
    }
  }

  const success = (adminSent !== false) && (customerSent !== false) && (adminSent === true || customerSent === true);
  return {
    success,
    adminSent,
    customerSent,
    error: errors.join(' | ') || ''
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ success: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método no permitido' }, 405, origin, requestUrl);
  }

  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'RESEND_API_KEY no está configurada' }, 500, origin, requestUrl);
  }

  try {
    const idToken = getBearerToken(request);
    const user = await verifyFirebaseUser(idToken);
    const rawBody = await request.text();
    if (rawBody.length > 12000) throw new Error('Solicitud demasiado grande.');
    const body = JSON.parse(rawBody || '{}');

    const action = clean(body.action, 60);
    if (!['sendOrderEmail', 'resendOrderEmail'].includes(action)) {
      throw new Error('Acción no permitida.');
    }

    const orderId = clean(body.orderId, 220);
    const order = await fetchOrder(orderId, idToken);
    const isSuperAdmin = user.email === ADMIN_EMAIL;
    if (!isSuperAdmin && clean(order.userId, 128) !== user.uid) {
      throw new Error('Este pedido no pertenece a la cuenta iniciada.');
    }
    if (!isSuperAdmin && clean(order.userEmail, 254).toLowerCase() !== user.email) {
      throw new Error('El correo del pedido no coincide con la cuenta iniciada.');
    }

    const isResend = action === 'resendOrderEmail';
    if (isResend && !isSuperAdmin) {
      throw new Error('Solo el Super Admin puede reenviar correos.');
    }

    const sendAdmin = body.sendAdmin !== false;
    const sendCustomer = body.sendCustomer !== false;
    const result = await sendOrderEmails({
      apiKey,
      orderId,
      order,
      isResend,
      sendAdmin,
      sendCustomer
    });

    return jsonResponse(result, result.success ? 200 : 502, origin, requestUrl);
  } catch (error) {
    return jsonResponse({
      success: false,
      adminSent: false,
      customerSent: null,
      error: clean(error?.message || error, 500)
    }, 400, origin, requestUrl);
  }
}
