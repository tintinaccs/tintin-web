import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/cloudinary-security.js';

const FROM_EMAIL = 'Tintin Pedidos <pedidos@tintinaccs.com>';
const REPLY_TO = 'tintinaccs@gmail.com';

function clean(value, maxLength = 1000) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(clean(value, 254));
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendWithResend(apiKey, toEmail) {
  const subject = '[PRUEBA] Confirmación de pedido — Tintin';
  const text = `Este es un correo de prueba de Tintin Accesorios.\n\nNo corresponde a un pedido real y no modifica stock.\n\nRemitente: pedidos@tintinaccs.com\nResponder a: tintinaccs@gmail.com\n\nPedido de prueba: #TEST123\nCliente: Cliente de prueba\nProducto: 1x BAG RUBY\nTotal: Gs. 190.000\nEntrega: Delivery — San Lorenzo\nEstado: Pendiente de confirmación`;
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#fff6fa;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px">
    <div style="background:#ffffff;border:1px solid #f1e4e7;border-radius:18px;overflow:hidden">
      <div style="background:#ad3f67;padding:22px;text-align:center;color:#ffffff">
        <div style="font-size:22px;font-weight:700">Correo de prueba de Tintin</div>
        <div style="margin-top:6px;color:#ffeaf2">No corresponde a un pedido real</div>
      </div>
      <div style="padding:26px">
        <p style="margin:0 0 16px">Hola <strong>Cliente de prueba</strong>,</p>
        <p style="margin:0 0 20px;line-height:1.65;color:#5e5357">
          Esta prueba confirma que Resend y Cloudflare pueden enviar correctamente desde
          <strong>pedidos@tintinaccs.com</strong>. No se creó ningún pedido y no se modificó el stock.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fff6fa;border-radius:12px">
          <tr><td style="padding:12px;color:#7b6f72">Pedido</td><td style="padding:12px;text-align:right"><strong>#TEST123</strong></td></tr>
          <tr><td style="padding:0 12px 12px;color:#7b6f72">Producto</td><td style="padding:0 12px 12px;text-align:right">1x BAG RUBY</td></tr>
          <tr><td style="padding:12px;color:#7b6f72;border-top:1px solid #f1e4e7">Total</td><td style="padding:12px;text-align:right;font-weight:700;color:#ad3f67;border-top:1px solid #f1e4e7">Gs. 190.000</td></tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#fff9fc;border-radius:12px;line-height:1.6;color:#5e5357">
          <strong>Entrega:</strong> Delivery — San Lorenzo<br>
          <strong>Estado:</strong> Pendiente de confirmación
        </div>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#7b6f72">
          Al responder este correo, la respuesta llegará a ${escapeHtml(REPLY_TO)}.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `test-email-${Date.now()}-${crypto.randomUUID()}`
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [toEmail],
      reply_to: REPLY_TO,
      subject,
      html,
      text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(data?.message || data?.error || `Resend HTTP ${response.status}`, 300));
  }
  return data;
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
    await requireSuperAdmin(request);
    const rawBody = await request.text();
    if (rawBody.length > 4000) throw new Error('Solicitud demasiado grande');
    const body = JSON.parse(rawBody || '{}');
    const toEmail = clean(body.toEmail, 254).toLowerCase();
    if (!emailIsValid(toEmail)) throw new Error('Correo de destino inválido');

    const result = await sendWithResend(apiKey, toEmail);
    return jsonResponse({ success: true, customerSent: true, id: result?.id || '' }, 200, origin, requestUrl);
  } catch (error) {
    return jsonResponse({
      success: false,
      customerSent: false,
      error: clean(error?.message || error, 500)
    }, 400, origin, requestUrl);
  }
}
