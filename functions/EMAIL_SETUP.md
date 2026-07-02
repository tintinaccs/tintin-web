# Tintin — Emails de pedidos con Google Apps Script (gratis, sin tarjeta)

Esta es la forma que usa el sitio HOY para mandar el correo de cada pedido y
para el botón "Reenviar" de Super Admin → Pedidos. No requiere el plan Blaze
de Firebase ni ninguna tarjeta de crédito — usa la cuota gratuita de tu propia
cuenta de Gmail (100 correos/día, de sobra para una tienda).

> Si en el futuro preferís usar Firebase Cloud Functions en vez de esto,
> el código ya está listo en `functions/index.js` — ver `DEPLOY.md`. Pero
> requiere activar el plan Blaze (pago por uso, con tarjeta cargada).

## 1. Crear el proyecto de Apps Script

1. Andá a **https://script.google.com** (con la cuenta `tintinaccs@gmail.com`)
2. Click en **"Nuevo proyecto"**
3. Borrá todo el código de ejemplo que aparece
4. Pegá el código completo de la sección "2. Código" de más abajo
5. Reemplazá `TU_SECRETO_AQUI` (arriba del todo del código) por una clave
   larga inventada por vos (ej: `tintin-2026-x7k9mQ2p`) — cualquier texto
   difícil de adivinar sirve, no hace falta que la memorices
6. Arriba, hacé clic en el nombre "Proyecto sin título" y ponele
   `Tintin - Emails de pedidos`

## 2. Código para pegar

```javascript
const SHARED_SECRET = 'TU_SECRETO_AQUI';
const ADMIN_EMAIL    = 'tintinaccs@gmail.com';
const STORE_NAME     = 'Tintin Accesorios';
const ADMIN_PANEL    = 'https://tintinaccs.github.io/tintin-web/admin.html';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: 'unauthorized' });
    }
    const order   = data.order || {};
    const orderId = data.orderId || '';
    const isResend = !!data.isResend;
    const shortId = order.shortId || (orderId ? orderId.slice(0, 8).toUpperCase() : '—');

    const subject = (isResend ? '🔁 [Reenviado] ' : '🛍️ ') + 'Pedido #' + shortId + ' — ' + STORE_NAME;

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      body: buildText(shortId, order),
      htmlBody: buildHtml(shortId, order)
    });

    return jsonOut({ success: true });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmtPrice(n) {
  return 'Gs. ' + Math.round(Number(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function fmtShipping(order) {
  if (order.shippingCost === null || order.shippingCost === undefined || order.shippingPending) {
    return 'A confirmar con un vendedor';
  }
  return fmtPrice(order.shippingCost);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return Utilities.formatDate(new Date(iso), 'America/Asuncion', "dd/MM/yyyy HH:mm 'hs (hora de Paraguay)'");
  } catch (e) {
    return String(iso);
  }
}

function zoneLabel(order) {
  const z = order.shipping && order.shipping.zone;
  if (z === 'central') return 'Zona Central';
  if (z === 'interior') return 'Interior del país';
  return '—';
}

function waLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? 'https://wa.me/' + digits : '';
}

function shipMethodLabel(order) {
  const m = (order.shipping && order.shipping.method) || '';
  return { delivery: '🚚 Delivery (Zona Central)', encomienda: '📦 Encomienda (Interior)', retiro: '🏪 Retiro en tienda' }[m] || m || '—';
}

function payMethodLabel(order) {
  const m = (order.payment && order.payment.method) || '';
  return { efectivo: '💵 Efectivo (contra entrega)', transferencia: '🏦 Transferencia bancaria', pagopark: '📱 PagoPark', tarjeta: '💳 Tarjeta' }[m] || m || '—';
}

function buildText(shortId, order) {
  const items = (order.items || []).map(function (i) {
    return '  • ' + i.qty + 'x ' + i.name + ' — ' + fmtPrice(i.price * i.qty);
  }).join('\n');
  const wa = waLink(order.userPhone);
  const shipping = order.shipping || {};
  const line = '━'.repeat(40);

  return '🛍️ PEDIDO — ' + STORE_NAME.toUpperCase() + '\n' + line + '\n' +
    '📋 Pedido:   #' + shortId + '\n' +
    '📅 Fecha:    ' + fmtDate(order.createdAt) + '\n' + line + '\n' +
    '👤 Cliente:  ' + (order.userName || '—') + '\n' +
    '📞 Teléfono: ' + (order.userPhone || '—') + '\n' +
    (wa ? '💬 WhatsApp: ' + wa + '\n' : '') +
    (order.userEmail ? '📧 Email:    ' + order.userEmail + '\n' : '') +
    '📍 Ciudad:   ' + (shipping.city || '—') + '\n' +
    '🗺️ Zona:     ' + zoneLabel(order) + '\n' +
    (shipping.address ? '🏠 Dirección: ' + shipping.address + '\n' : '') +
    (shipping.referencia ? '📌 Referencia: ' + shipping.referencia + '\n' : '') +
    (shipping.mapLocation ? '📌 Ubicación GPS: https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '\n' : '') +
    line + '\n' +
    '🚚 Entrega:  ' + shipMethodLabel(order) + '\n' +
    '💳 Pago:     ' + payMethodLabel(order) + '\n' + line + '\n' +
    '🛒 PRODUCTOS:\n' + items + '\n' + line + '\n' +
    '   Subtotal:  ' + fmtPrice(order.subtotal) + '\n' +
    '   Envío:     ' + fmtShipping(order) + '\n' +
    '💰 TOTAL:    ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    '📊 Estado pedido: ' + (order.status || 'pendiente') + '\n' +
    '💳 Estado pago:   ' + ((order.payment && order.payment.status) || 'pendiente') + '\n' +
    (order.notes ? '\n📝 Notas: ' + order.notes + '\n' : '') + line + '\n' +
    '👉 Ver en admin: ' + ADMIN_PANEL + '\n';
}

function buildHtml(shortId, order) {
  const wa = waLink(order.userPhone);
  const shipping = order.shipping || {};
  const itemRows = (order.items || []).map(function (i) {
    return '<tr><td style="padding:6px 8px">' + i.qty + 'x ' + i.name + '</td>' +
      '<td style="padding:6px 8px;text-align:right">' + fmtPrice(i.price * i.qty) + '</td></tr>';
  }).join('');

  return '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;background:#fef5f8;padding:24px">' +
    '<div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #f0d8e0">' +
    '<h2 style="color:#b84c72;margin:0 0 16px">🛍️ Pedido — ' + STORE_NAME + '</h2>' +
    '<p style="color:#888;margin:0 0 20px">Pedido <strong>#' + shortId + '</strong> recibido el ' + fmtDate(order.createdAt) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
    '<tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td><strong>' + (order.userName || '—') + '</strong></td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Teléfono</td><td>' + (order.userPhone || '—') + '</td></tr>' +
    (order.userEmail ? '<tr><td style="color:#888;padding:4px 0">Email</td><td>' + order.userEmail + '</td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Ciudad</td><td>' + (shipping.city || '—') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Zona</td><td>' + zoneLabel(order) + '</td></tr>' +
    (shipping.address ? '<tr><td style="color:#888;padding:4px 0">Dirección</td><td>' + shipping.address + '</td></tr>' : '') +
    (shipping.referencia ? '<tr><td style="color:#888;padding:4px 0">Referencia</td><td>' + shipping.referencia + '</td></tr>' : '') +
    (shipping.mapLocation ? '<tr><td style="color:#888;padding:4px 0">Ubicación</td><td><a href="https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '">Ver en el mapa</a></td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Entrega</td><td>' + shipMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Pago</td><td>' + payMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pedido</td><td>' + (order.status || 'pendiente') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pago</td><td>' + ((order.payment && order.payment.status) || 'pendiente') + '</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px">Productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' + itemRows +
    '<tr style="border-top:2px solid #f0d8e0"><td style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    '<tr><td style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr style="background:#fef5f8"><td style="padding:10px 8px;font-weight:700;color:#b84c72;font-size:16px">TOTAL</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:700;color:#b84c72;font-size:16px">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:400;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (order.notes ? '<p style="background:#fef5f8;border-radius:8px;padding:12px;color:#555"><strong>Notas:</strong> ' + order.notes + '</p>' : '') +
    '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<a href="' + ADMIN_PANEL + '" style="display:inline-block;background:#b84c72;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ver pedido en admin →</a>' +
    (wa ? '<a href="' + wa + '" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">💬 WhatsApp del cliente</a>' : '') +
    '</div></div></body></html>';
}
```

## 3. Publicar como Web App

1. Arriba a la derecha, click en **"Implementar"** → **"Nueva implementación"**
2. Click en el ícono de engranaje ⚙️ al lado de "Seleccionar tipo" → elegí **"Aplicación web"**
3. Configurá:
   - **Descripción**: `Emails de pedidos Tintin`
   - **Ejecutar como**: `Yo (tintinaccs@gmail.com)`
   - **Quién tiene acceso**: **`Cualquier usuario`** (importante — sin esto, el checkout público no va a poder llamarlo)
4. Click en **"Implementar"**
5. Te va a pedir autorizar permisos — elegí tu cuenta, puede avisar "Google no verificó esta app": hacé clic en **"Configuración avanzada"** → **"Ir a Tintin - Emails de pedidos (no seguro)"** → **"Permitir"** (es tu propio script, es seguro)
6. Copiá la **URL de la aplicación web** que te da al final (termina en `/exec`)

## 4. Conectar la URL al sitio

Abrí el archivo `js/email-config.js` del repositorio y reemplazá:

```javascript
export const EMAIL_WEBHOOK_URL = 'PEGAR_URL_DE_APPS_SCRIPT_AQUI';
export const EMAIL_SECRET = 'PEGAR_TU_SECRETO_AQUI';
```

por la URL que copiaste y el mismo secreto que pusiste en `SHARED_SECRET` en el paso 1. Guardá, subí el cambio (commit + push) a la rama `main`.

## 5. Probar

1. Hacé un pedido de prueba desde el checkout público
2. Revisá la bandeja de `tintinaccs@gmail.com` — debería llegar en segundos
3. En Super Admin → Pedidos, probá el botón **"✉️ Reenviar"** en cualquier pedido

## Si algo falla
- Si no llega nada: abrí la consola del navegador (F12) en el checkout y buscá mensajes que empiecen con `[email-notify]`
- Revisá que la URL en `js/email-config.js` termine en `/exec` (no `/dev`)
- Revisá que en el paso 3 hayas elegido "Cualquier usuario" con acceso, no "Solo yo"
- Si editaste el script después de implementarlo, tenés que crear una **nueva implementación** (Implementar → Administrar implementaciones → editar → nueva versión) para que los cambios tomen efecto
