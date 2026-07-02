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

Este script manda **dos correos distintos** por cada pedido nuevo:

1. **A vos** (`tintinaccs@gmail.com`) — el correo operativo completo: todos los
   datos del cliente, dirección/mapa, productos con imagen y variante, totales
   y un botón de WhatsApp con un mensaje ya redactado (lo podés editar antes
   de enviarlo, como cualquier link de `wa.me`).
2. **Al cliente** (solo si dejó su email en el checkout) — una confirmación
   corta y prolija, con el número de pedido, sus productos, el total, la
   dirección de entrega y un mensaje de agradecimiento estilo Tintin.

Cuando usás el botón **"✉️ Reenviar"** de Super Admin → Pedidos, por defecto
solo se reenvía tu copia operativa (no se le vuelve a mandar la confirmación
al cliente, para no ser repetitiva). Si alguna vez preferís que el reenvío
también le llegue de nuevo al cliente, buscá el comentario `!isResend` en
`doPost` y quitalo.

```javascript
const SHARED_SECRET   = 'TU_SECRETO_AQUI';
const ADMIN_EMAIL     = 'tintinaccs@gmail.com';
const STORE_NAME      = 'Tintin Accesorios';
const ADMIN_PANEL     = 'https://tintinaccs.github.io/tintin-web/admin.html';
// Se usa solo si el pedido no trae su propio número (pedidos viejos, antes de este cambio).
const DEFAULT_STORE_WHATSAPP = '595981299331';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: 'unauthorized' });
    }
    const order    = data.order || {};
    const orderId  = data.orderId || '';
    const isResend = !!data.isResend;
    const shortId  = order.shortId || (orderId ? orderId.slice(0, 8).toUpperCase() : '—');

    // 1) Correo operativo — siempre, a la tienda
    const adminSubject = (isResend ? '🔁 [Reenviado] ' : '') +
      'Nuevo pedido #' + shortId + ' — ' + fmtPrice(order.total) + ' — ' + (order.userName || 'Cliente');
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: adminSubject,
      body: buildAdminText(shortId, order),
      htmlBody: buildAdminHtml(shortId, order)
    });

    // 2) Confirmación al cliente — solo si dejó su email, y solo en el envío
    //    original (no en cada reenvío manual desde el admin).
    if (order.userEmail && !isResend) {
      MailApp.sendEmail({
        to: order.userEmail,
        subject: 'Recibimos tu pedido en Tintin 💗 Pedido #' + shortId,
        body: buildCustomerText(shortId, order),
        htmlBody: buildCustomerHtml(shortId, order)
      });
    }

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

// text opcional: precarga el mensaje de WhatsApp, pero sigue siendo 100% editable
// antes de enviarlo — así funciona cualquier link de wa.me con `?text=`.
function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
}

// Mensaje que la tienda le manda al CLIENTE (editable antes de enviar en WhatsApp)
function waGreetingToCustomer(shortId, order) {
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  return 'Hola' + (first ? ' ' + first : '') + '! 👋 Soy de ' + STORE_NAME +
    ', te escribo por tu pedido #' + shortId + '. 💗';
}

// Mensaje que el CLIENTE le manda a la tienda (botón "contactanos" del correo de confirmación)
function waGreetingToStore(shortId) {
  return 'Hola! Tengo una consulta sobre mi pedido #' + shortId + ' en Tintin.';
}

function shipMethodLabel(order) {
  const m = (order.shipping && order.shipping.method) || '';
  return { delivery: '🚚 Delivery (Zona Central)', encomienda: '📦 Encomienda (Interior)', retiro: '🏪 Retiro en tienda' }[m] || m || '—';
}

function payMethodLabel(order) {
  const m = (order.payment && order.payment.method) || '';
  return { efectivo: '💵 Efectivo (contra entrega)', transferencia: '🏦 Transferencia bancaria', pagopark: '📱 PagoPark', tarjeta: '💳 Tarjeta' }[m] || m || '—';
}

// order.discount es opcional — hoy la tienda no tiene cupones, pero si algún
// día se agrega ese campo al pedido, ya se va a mostrar solo en ese caso.
function discountAmount(order) {
  const d = Number(order.discount || 0);
  return d > 0 ? d : 0;
}

function itemLineText(i) {
  const variant = i.variant ? ' (' + i.variant + ')' : '';
  return '  • ' + i.qty + 'x ' + i.name + variant + ' — ' + fmtPrice(i.price) + ' c/u = ' + fmtPrice(i.price * i.qty);
}

function itemRowHtml(i) {
  const img = i.imageUrl
    ? '<img src="' + i.imageUrl + '" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:8px;display:block">'
    : '';
  const variant = i.variant ? '<div style="font-size:11px;color:#999">' + i.variant + '</div>' : '';
  return '<tr>' +
    '<td style="padding:8px;width:44px">' + img + '</td>' +
    '<td style="padding:8px"><strong>' + i.qty + 'x</strong> ' + i.name + variant +
      '<div style="font-size:11px;color:#aaa">' + fmtPrice(i.price) + ' c/u</div></td>' +
    '<td style="padding:8px;text-align:right;white-space:nowrap;font-weight:600">' + fmtPrice(i.price * i.qty) + '</td>' +
  '</tr>';
}

// ============================================================
// CORREO 1 — a la tienda (operativo, con todos los datos)
// ============================================================

function buildAdminText(shortId, order) {
  const items = (order.items || []).map(itemLineText).join('\n');
  const wa = waLink(order.userPhone, waGreetingToCustomer(shortId, order));
  const shipping = order.shipping || {};
  const discount = discountAmount(order);
  const line = '━'.repeat(40);

  return '🛍️ PEDIDO — ' + STORE_NAME.toUpperCase() + '\n' + line + '\n' +
    '📋 Pedido:   #' + shortId + '\n' +
    '📅 Fecha:    ' + fmtDate(order.createdAt) + '\n' + line + '\n' +
    '👤 Cliente:  ' + (order.userName || '—') + '\n' +
    '📞 Teléfono: ' + (order.userPhone || '—') + '\n' +
    (wa ? '💬 WhatsApp (mensaje ya redactado, editable): ' + wa + '\n' : '') +
    (order.userEmail ? '📧 Email:    ' + order.userEmail + '\n' : '') +
    '📍 Ciudad:   ' + (shipping.city || '—') + '\n' +
    '🗺️ Zona:     ' + zoneLabel(order) + '\n' +
    (shipping.address ? '🏠 Dirección: ' + shipping.address + '\n' : '') +
    (shipping.mapLocation && shipping.mapLocation.name ? '📍 Lugar: ' + shipping.mapLocation.name + '\n' : '') +
    (shipping.referencia ? '📌 Referencia: ' + shipping.referencia + '\n' : '') +
    (shipping.mapLocation ? '📌 Ubicación GPS: https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '\n' : '') +
    line + '\n' +
    '🚚 Entrega:  ' + shipMethodLabel(order) + '\n' +
    '💳 Pago:     ' + payMethodLabel(order) + '\n' + line + '\n' +
    '🛒 PRODUCTOS:\n' + items + '\n' + line + '\n' +
    '   Subtotal:  ' + fmtPrice(order.subtotal) + '\n' +
    (discount > 0 ? '   Descuento: -' + fmtPrice(discount) + '\n' : '') +
    '   Envío:     ' + fmtShipping(order) + '\n' +
    '💰 TOTAL:    ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    '📊 Estado pedido: ' + (order.status || 'pendiente') + '\n' +
    '💳 Estado pago:   ' + ((order.payment && order.payment.status) || 'pendiente') + '\n' +
    (order.notes ? '\n📝 Notas: ' + order.notes + '\n' : '') + line + '\n' +
    '👉 Ver en admin: ' + ADMIN_PANEL + '\n';
}

function buildAdminHtml(shortId, order) {
  const wa = waLink(order.userPhone, waGreetingToCustomer(shortId, order));
  const shipping = order.shipping || {};
  const discount = discountAmount(order);
  const itemRows = (order.items || []).map(itemRowHtml).join('');

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
    (shipping.mapLocation && shipping.mapLocation.name ? '<tr><td style="color:#888;padding:4px 0">Lugar</td><td>' + shipping.mapLocation.name + '</td></tr>' : '') +
    (shipping.referencia ? '<tr><td style="color:#888;padding:4px 0">Referencia</td><td>' + shipping.referencia + '</td></tr>' : '') +
    (shipping.mapLocation ? '<tr><td style="color:#888;padding:4px 0">Ubicación</td><td><a href="https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '">Ver en el mapa</a></td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Entrega</td><td>' + shipMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Pago</td><td>' + payMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pedido</td><td>' + (order.status || 'pendiente') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pago</td><td>' + ((order.payment && order.payment.status) || 'pendiente') + '</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px">Productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' + itemRows +
    '<tr style="border-top:2px solid #f0d8e0"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    (discount > 0 ? '<tr><td colspan="2" style="padding:4px 8px;color:#888">Descuento</td><td style="padding:4px 8px;text-align:right;color:#c0392b">-' + fmtPrice(discount) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr style="background:#fef5f8"><td colspan="2" style="padding:10px 8px;font-weight:700;color:#b84c72;font-size:16px">TOTAL</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:700;color:#b84c72;font-size:16px">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:400;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (order.notes ? '<p style="background:#fef5f8;border-radius:8px;padding:12px;color:#555"><strong>Notas:</strong> ' + order.notes + '</p>' : '') +
    '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<a href="' + ADMIN_PANEL + '" style="display:inline-block;background:#b84c72;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ver pedido en admin →</a>' +
    (wa ? '<a href="' + wa + '" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">💬 Escribirle por WhatsApp</a>' : '') +
    '</div>' +
    '<p style="font-size:11px;color:#bbb;margin-top:10px">El botón de WhatsApp abre la conversación con un mensaje ya escrito — lo podés editar antes de mandarlo.</p>' +
    '</div></body></html>';
}

// ============================================================
// CORREO 2 — al cliente (confirmación, solo si dejó su email)
// ============================================================

function buildCustomerText(shortId, order) {
  const items = (order.items || []).map(itemLineText).join('\n');
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const storeWa = waLink(order.storeWhatsapp || DEFAULT_STORE_WHATSAPP, waGreetingToStore(shortId));
  const line = '━'.repeat(40);

  return '💗 ¡Gracias por tu compra' + (first ? ', ' + first : '') + '!\n' + line + '\n' +
    'Recibimos tu pedido en ' + STORE_NAME + '. Estamos preparando todo con\n' +
    'mucho cuidado y te vamos a contactar para confirmar los detalles del envío.\n' + line + '\n' +
    '📋 Pedido:  #' + shortId + '\n' +
    '📅 Fecha:   ' + fmtDate(order.createdAt) + '\n' +
    '📊 Estado:  Pendiente de confirmación\n' + line + '\n' +
    '🛒 TUS PRODUCTOS:\n' + items + '\n' + line + '\n' +
    '   Subtotal: ' + fmtPrice(order.subtotal) + '\n' +
    '   Envío:    ' + fmtShipping(order) + '\n' +
    '💰 TOTAL:   ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    (shipping.address ? '🏠 Dirección de entrega: ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '\n' : '') +
    (shipping.city && !shipping.address ? '📍 Ciudad: ' + shipping.city + '\n' : '') + line + '\n' +
    '¿Tenés alguna duda? Escribinos por WhatsApp' + (storeWa ? ': ' + storeWa : '') + '\n' +
    '\nCon cariño,\n' + STORE_NAME + ' 💗\n';
}

function buildCustomerHtml(shortId, order) {
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const storeWa = waLink(order.storeWhatsapp || DEFAULT_STORE_WHATSAPP, waGreetingToStore(shortId));
  const itemRows = (order.items || []).map(itemRowHtml).join('');

  return '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;background:#fef5f8;padding:24px">' +
    '<div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #f0d8e0">' +
    '<h2 style="color:#b84c72;margin:0 0 12px">💗 ¡Gracias por tu compra' + (first ? ', ' + first : '') + '!</h2>' +
    '<p style="color:#555;line-height:1.6;margin:0 0 20px">Recibimos tu pedido en <strong>' + STORE_NAME + '</strong>. ' +
    'Estamos preparando todo con mucho cuidado y te vamos a contactar para confirmar los detalles del envío.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;background:#fef5f8;border-radius:8px">' +
    '<tr><td style="padding:10px 14px;color:#888">Pedido</td><td style="padding:10px 14px;text-align:right"><strong>#' + shortId + '</strong></td></tr>' +
    '<tr><td style="padding:0 14px 10px;color:#888">Fecha</td><td style="padding:0 14px 10px;text-align:right">' + fmtDate(order.createdAt) + '</td></tr>' +
    '<tr><td style="padding:0 14px 10px;color:#888">Estado</td><td style="padding:0 14px 10px;text-align:right">Pendiente de confirmación</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px">Tus productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' + itemRows +
    '<tr style="border-top:2px solid #f0d8e0"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr style="background:#fef5f8"><td colspan="2" style="padding:10px 8px;font-weight:700;color:#b84c72;font-size:16px">TOTAL</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:700;color:#b84c72;font-size:16px">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:400;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (shipping.address ? '<p style="color:#555;margin:0 0 4px"><strong>Dirección de entrega:</strong> ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '</p>' : (shipping.city ? '<p style="color:#555;margin:0 0 4px"><strong>Ciudad:</strong> ' + shipping.city + '</p>' : '')) +
    '<div style="margin-top:20px;padding-top:20px;border-top:1px solid #f0d8e0;text-align:center">' +
    '<p style="color:#888;font-size:13px;margin:0 0 12px">¿Tenés alguna duda sobre tu pedido?</p>' +
    (storeWa ? '<a href="' + storeWa + '" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">💬 Escribinos por WhatsApp</a>' : '') +
    (order.storeInstagram ? '<p style="margin-top:14px"><a href="' + order.storeInstagram + '" style="color:#b84c72;text-decoration:none;font-size:13px">📷 Seguinos en Instagram</a></p>' : '') +
    '<p style="color:#c98aa0;font-size:13px;margin-top:16px">Con cariño,<br><strong>' + STORE_NAME + '</strong> 💗</p>' +
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
