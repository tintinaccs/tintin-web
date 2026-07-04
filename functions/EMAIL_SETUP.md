# Tintin — Emails de pedidos con Google Apps Script (gratis, sin tarjeta)

Esta es la forma que usa el sitio HOY para mandar el correo de cada pedido y
para el botón "Reenviar" de Super Admin → Pedidos. No requiere el plan Blaze
de Firebase ni ninguna tarjeta de crédito — usa la cuota gratuita de tu propia
cuenta de Gmail (100 correos/día, de sobra para una tienda).

> Si en el futuro preferís usar Firebase Cloud Functions en vez de esto,
> el código ya está listo en `functions/index.js` — ver `DEPLOY.md`. Pero
> requiere activar el plan Blaze (pago por uso, con tarjeta cargada).

**Cuenta que envía los correos: `tintinpedidos@gmail.com`.** El proyecto de
Apps Script vive ahí (no en `tintinaccs@gmail.com`) porque `MailApp.sendEmail`
siempre envía como la cuenta que autorizó/desplegó el script — no hay forma
de pasarle un remitente distinto. `tintinaccs@gmail.com` sigue siendo el
destinatario del correo interno, pero ya no envía nada.

## 1. Crear el proyecto de Apps Script

1. Andá a **https://script.google.com** (con la cuenta `tintinpedidos@gmail.com`)
2. Click en **"Nuevo proyecto"**
3. Borrá todo el código de ejemplo que aparece
4. Pegá el código completo de la sección "2. Código" de más abajo
5. Reemplazá `TU_SECRETO_AQUI` (arriba del todo del código) por una clave
   larga inventada por vos (ej: `tintin-2026-x7k9mQ2p`) — cualquier texto
   difícil de adivinar sirve, no hace falta que la memorices
6. Arriba, hacé clic en el nombre "Proyecto sin título" y ponele
   `Tintin - Emails de pedidos`

## 2. Código para pegar

Este script manda **dos correos distintos** por cada pedido nuevo, cada uno
en su propio `try/catch` (para poder distinguir si salió uno solo de los
dos, no solo "todo bien" o "todo mal"):

1. **A la tienda** (`tintinaccs@gmail.com`) — el correo operativo completo: todos los
   datos del cliente, dirección/mapa, productos con imagen y variante, totales
   y un link para escribirle al cliente por WhatsApp con un mensaje ya
   redactado (lo podés editar antes de enviarlo, como cualquier link de
   `wa.me`).
2. **A la clienta** (solo si dejó su email en el checkout) — una confirmación
   corta y prolija, con el número de pedido, sus productos, el total y la
   dirección de entrega. No incluye ningún link de WhatsApp — se sacó a
   pedido para reducir la cantidad de links del correo.

Cuando usás el botón **"✉️ Reenviar"** de Super Admin → Pedidos, por defecto
solo se reenvía la copia operativa de la tienda (no se le vuelve a mandar la
confirmación a la clienta, para no ser repetitiva). Si alguna vez preferís
que el reenvío también le llegue de nuevo a la clienta, buscá el comentario
`!isResend` en `doPost` y quitalo.

El resultado que devuelve `doPost` ya no es un único `success: true/false`:
incluye `adminSent`/`customerSent` por separado, para que el sitio pueda
guardar `notificationStatus: 'sent'` (los dos salieron), `'partial'` (salió
uno solo) o `'failed'` (fallaron los dos) en vez de un simple sí/no.

**Sobre entregabilidad (que no caiga en spam):** el contenido de ambos
correos está pensado para que una cuenta de Gmail nueva como
`tintinpedidos@gmail.com` — sin historial de envío — tenga menos chances de
que Gmail lo marque como spam: sin emojis, sin signos de exclamación, con
asuntos simples ("Nuevo pedido recibido en Tintin" / "Recibimos tu pedido en
Tintin"), sin ningún link de WhatsApp en la confirmación a la clienta (se
sacó a pedido, incluso el que tenía antes) ni link a Instagram, y con
`name: STORE_NAME` para
que el remitente se vea como "Tintin Accesorios" en vez de una dirección
pelada. `MailApp.sendEmail` arma automáticamente un correo multipart
texto+HTML cuando se le pasan `body` y `htmlBody` juntos (como hace este
código) — eso ya está bien. Aun así, una cuenta nueva puede seguir cayendo
en spam los primeros días hasta que Gmail le genere reputación de envío —
marcar los primeros correos como "No es spam" y agregar la cuenta a
contactos ayuda a acelerar eso.

```javascript
const SHARED_SECRET   = 'TU_SECRETO_AQUI';
const ADMIN_EMAIL     = 'tintinaccs@gmail.com';  // a quién le llega el correo interno — NO es quien envía
const STORE_NAME      = 'Tintin Accesorios';
const ADMIN_PANEL     = 'https://tintinaccs.github.io/tintin-web/admin.html';

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

    // 1) Correo operativo — siempre, a la tienda. Se prueba en su propio
    // try/catch, separado del correo a la clienta, para poder reportar un
    // resultado PARCIAL si uno de los dos falla sin que eso oculte que el
    // otro sí salió bien.
    let adminSent = false, adminError = '';
    try {
      const adminSubject = (isResend ? 'Reenvío: ' : '') +
        'Nuevo pedido recibido en Tintin — Pedido #' + shortId;
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        name: STORE_NAME,
        subject: adminSubject,
        body: buildAdminText(shortId, order),
        htmlBody: buildAdminHtml(shortId, order)
      });
      adminSent = true;
    } catch (err) {
      adminError = String(err);
    }

    // 2) Confirmación a la clienta — solo si dejó su email, y solo en el
    //    envío original (no en cada reenvío manual desde el admin).
    //    `customerSent` queda en null (no false) cuando ni siquiera
    //    correspondía intentarlo — así no cuenta como una falla real.
    let customerSent = null, customerError = '';
    if (order.userEmail && !isResend) {
      try {
        MailApp.sendEmail({
          to: order.userEmail,
          name: STORE_NAME,
          subject: 'Recibimos tu pedido en Tintin — Pedido #' + shortId,
          body: buildCustomerText(shortId, order),
          htmlBody: buildCustomerHtml(shortId, order)
        });
        customerSent = true;
      } catch (err) {
        customerSent = false;
        customerError = String(err);
      }
    }

    // `success` se mantiene por compatibilidad con lo que ya usa el sitio;
    // `adminSent`/`customerSent` son los que permiten calcular
    // 'sent' / 'partial' / 'failed' del lado del frontend.
    const success = adminSent && customerSent !== false;
    return jsonOut({
      success,
      adminSent,
      customerSent,
      error: [adminError, customerError].filter(Boolean).join(' | ') || undefined
    });
  } catch (err) {
    return jsonOut({ success: false, adminSent: false, customerSent: null, error: String(err) });
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

// Mensaje que la tienda le manda a la CLIENTA (editable antes de enviar en WhatsApp)
function waGreetingToCustomer(shortId, order) {
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  return 'Hola' + (first ? ' ' + first : '') + ', soy de ' + STORE_NAME +
    ', te escribo por tu pedido #' + shortId + '.';
}

function shipMethodLabel(order) {
  const m = (order.shipping && order.shipping.method) || '';
  return { delivery: 'Delivery (Zona Central)', encomienda: 'Encomienda (Interior)', retiro: 'Retiro en tienda' }[m] || m || '—';
}

function payMethodLabel(order) {
  const m = (order.payment && order.payment.method) || '';
  return { efectivo: 'Efectivo (contra entrega)', transferencia: 'Transferencia bancaria', pagopark: 'PagoPark', tarjeta: 'Tarjeta' }[m] || m || '—';
}

// order.discount es opcional — hoy la tienda no tiene cupones, pero si algún
// día se agrega ese campo al pedido, ya se va a mostrar solo en ese caso.
function discountAmount(order) {
  const d = Number(order.discount || 0);
  return d > 0 ? d : 0;
}

function itemLineText(i) {
  const variant = i.variant ? ' (' + i.variant + ')' : '';
  return '  ' + i.qty + 'x ' + i.name + variant + ' — ' + fmtPrice(i.price) + ' c/u = ' + fmtPrice(i.price * i.qty);
}

function itemRowHtml(i) {
  const img = i.imageUrl
    ? '<img src="' + i.imageUrl + '" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:8px;display:block">'
    : '';
  const variant = i.variant ? '<div style="font-size:11px;color:#999">' + i.variant + '</div>' : '';
  return '<tr>' +
    '<td style="padding:8px;width:44px">' + img + '</td>' +
    '<td style="padding:8px">' + i.qty + 'x ' + i.name + variant +
      '<div style="font-size:11px;color:#aaa">' + fmtPrice(i.price) + ' c/u</div></td>' +
    '<td style="padding:8px;text-align:right;white-space:nowrap">' + fmtPrice(i.price * i.qty) + '</td>' +
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
  const line = '-'.repeat(40);

  return 'Nuevo pedido en ' + STORE_NAME + '\n' + line + '\n' +
    'Pedido:   #' + shortId + '\n' +
    'Fecha:    ' + fmtDate(order.createdAt) + '\n' + line + '\n' +
    'Cliente:  ' + (order.userName || '—') + '\n' +
    'Teléfono: ' + (order.userPhone || '—') + '\n' +
    (wa ? 'WhatsApp: ' + wa + '\n' : '') +
    (order.userEmail ? 'Email:    ' + order.userEmail + '\n' : '') +
    'Ciudad:   ' + (shipping.city || '—') + '\n' +
    'Zona:     ' + zoneLabel(order) + '\n' +
    (shipping.address ? 'Dirección: ' + shipping.address + '\n' : '') +
    (shipping.mapLocation && shipping.mapLocation.name ? 'Lugar: ' + shipping.mapLocation.name + '\n' : '') +
    (shipping.referencia ? 'Referencia: ' + shipping.referencia + '\n' : '') +
    (shipping.mapLocation ? 'Ubicación: https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '\n' : '') +
    line + '\n' +
    'Entrega:  ' + shipMethodLabel(order) + '\n' +
    'Pago:     ' + payMethodLabel(order) + '\n' + line + '\n' +
    'Productos:\n' + items + '\n' + line + '\n' +
    '  Subtotal:  ' + fmtPrice(order.subtotal) + '\n' +
    (discount > 0 ? '  Descuento: -' + fmtPrice(discount) + '\n' : '') +
    '  Envío:     ' + fmtShipping(order) + '\n' +
    'Total:    ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    'Estado pedido: ' + (order.status || 'pendiente') + '\n' +
    'Estado pago:   ' + ((order.payment && order.payment.status) || 'pendiente') + '\n' +
    (order.notes ? '\nNotas: ' + order.notes + '\n' : '') + line + '\n' +
    'Ver en admin: ' + ADMIN_PANEL + '\n';
}

function buildAdminHtml(shortId, order) {
  const wa = waLink(order.userPhone, waGreetingToCustomer(shortId, order));
  const shipping = order.shipping || {};
  const discount = discountAmount(order);
  const itemRows = (order.items || []).map(itemRowHtml).join('');

  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">' +
    '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:24px">' +
    '<h2 style="color:#b84c72;margin:0 0 16px;font-size:18px">Nuevo pedido en ' + STORE_NAME + '</h2>' +
    '<p style="color:#666;margin:0 0 20px;font-size:13px">Pedido #' + shortId + ' recibido el ' + fmtDate(order.createdAt) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' +
    '<tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td>' + (order.userName || '—') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Teléfono</td><td>' + (order.userPhone || '—') + '</td></tr>' +
    (order.userEmail ? '<tr><td style="color:#888;padding:4px 0">Email</td><td>' + order.userEmail + '</td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Ciudad</td><td>' + (shipping.city || '—') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Zona</td><td>' + zoneLabel(order) + '</td></tr>' +
    (shipping.address ? '<tr><td style="color:#888;padding:4px 0">Dirección</td><td>' + shipping.address + '</td></tr>' : '') +
    (shipping.mapLocation && shipping.mapLocation.name ? '<tr><td style="color:#888;padding:4px 0">Lugar</td><td>' + shipping.mapLocation.name + '</td></tr>' : '') +
    (shipping.referencia ? '<tr><td style="color:#888;padding:4px 0">Referencia</td><td>' + shipping.referencia + '</td></tr>' : '') +
    (shipping.mapLocation ? '<tr><td style="color:#888;padding:4px 0">Ubicación</td><td><a href="https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '" style="color:#b84c72">Ver en el mapa</a></td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Entrega</td><td>' + shipMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Pago</td><td>' + payMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pedido</td><td>' + (order.status || 'pendiente') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pago</td><td>' + ((order.payment && order.payment.status) || 'pendiente') + '</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px;font-size:14px">Productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' + itemRows +
    '<tr style="border-top:1px solid #e5e5e5"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    (discount > 0 ? '<tr><td colspan="2" style="padding:4px 8px;color:#888">Descuento</td><td style="padding:4px 8px;text-align:right;color:#c0392b">-' + fmtPrice(discount) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:10px 8px;font-weight:bold;color:#b84c72">Total</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:bold;color:#b84c72">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:normal;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (order.notes ? '<p style="color:#555;font-size:13px"><strong>Notas:</strong> ' + order.notes + '</p>' : '') +
    '<p style="font-size:13px;margin-top:20px">' +
    '<a href="' + ADMIN_PANEL + '" style="color:#b84c72">Ver pedido en el panel de administración</a>' +
    (wa ? '<br><a href="' + wa + '" style="color:#25D366">Escribirle por WhatsApp al cliente</a>' : '') +
    '</p>' +
    '</div></body></html>';
}

// ============================================================
// CORREO 2 — a la clienta (confirmación, solo si dejó su email)
// ============================================================

function buildCustomerText(shortId, order) {
  const items = (order.items || []).map(itemLineText).join('\n');
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const line = '-'.repeat(40);

  return 'Gracias por tu pedido' + (first ? ', ' + first : '') + '.\n' + line + '\n' +
    'Recibimos tu pedido en ' + STORE_NAME + '. Estamos preparando todo con\n' +
    'cuidado y te vamos a contactar para confirmar los detalles del envío.\n' + line + '\n' +
    'Pedido:  #' + shortId + '\n' +
    'Fecha:   ' + fmtDate(order.createdAt) + '\n' +
    'Estado:  Pendiente de confirmación\n' + line + '\n' +
    'Tus productos:\n' + items + '\n' + line + '\n' +
    '  Subtotal: ' + fmtPrice(order.subtotal) + '\n' +
    '  Envío:    ' + fmtShipping(order) + '\n' +
    'Total:   ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    (shipping.address ? 'Dirección de entrega: ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '\n' : '') +
    (shipping.city && !shipping.address ? 'Ciudad: ' + shipping.city + '\n' : '') + line + '\n' +
    'Gracias por elegirnos,\n' + STORE_NAME + '\n';
}

function buildCustomerHtml(shortId, order) {
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const itemRows = (order.items || []).map(itemRowHtml).join('');

  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">' +
    '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:28px">' +
    '<h2 style="color:#b84c72;margin:0 0 12px;font-size:18px">Gracias por tu pedido' + (first ? ', ' + first : '') + '.</h2>' +
    '<p style="color:#555;line-height:1.6;margin:0 0 20px;font-size:14px">Recibimos tu pedido en ' + STORE_NAME + '. ' +
    'Estamos preparando todo con cuidado y te vamos a contactar para confirmar los detalles del envío.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' +
    '<tr><td style="padding:6px 0;color:#888">Pedido</td><td style="padding:6px 0;text-align:right">#' + shortId + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#888">Fecha</td><td style="padding:6px 0;text-align:right">' + fmtDate(order.createdAt) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#888">Estado</td><td style="padding:6px 0;text-align:right">Pendiente de confirmación</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px;font-size:14px">Tus productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' + itemRows +
    '<tr style="border-top:1px solid #e5e5e5"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:10px 8px;font-weight:bold;color:#b84c72">Total</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:bold;color:#b84c72">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:normal;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (shipping.address ? '<p style="color:#555;font-size:13px;margin:0 0 4px"><strong>Dirección de entrega:</strong> ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '</p>' : (shipping.city ? '<p style="color:#555;font-size:13px;margin:0 0 4px"><strong>Ciudad:</strong> ' + shipping.city + '</p>' : '')) +
    '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5">' +
    '<p style="color:#999;font-size:12px;margin:0">Gracias por elegirnos,<br>' + STORE_NAME + '</p>' +
    '</div></div></body></html>';
}
```

## 3. Publicar como Web App

1. Arriba a la derecha, click en **"Implementar"** → **"Nueva implementación"**
2. Click en el ícono de engranaje ⚙️ al lado de "Seleccionar tipo" → elegí **"Aplicación web"**
3. Configurá:
   - **Descripción**: `Emails de pedidos Tintin`
   - **Ejecutar como**: `Yo (tintinpedidos@gmail.com)`
   - **Quién tiene acceso**: **`Cualquier usuario`** (importante — sin esto, el checkout público no va a poder llamarlo)
4. Click en **"Implementar"**
5. Te va a pedir autorizar permisos — elegí la cuenta `tintinpedidos@gmail.com`, puede avisar "Google no verificó esta app": hacé clic en **"Configuración avanzada"** → **"Ir a Tintin - Emails de pedidos (no seguro)"** → **"Permitir"** (es tu propio script, es seguro)
6. Copiá la **URL de la aplicación web** que te da al final (termina en `/exec`)

## 4. Conectar la URL al sitio

**Ya hecho — estado actual (migración completada):** `js/email-config.js` ya apunta a la
implementación desplegada desde `tintinpedidos@gmail.com`:

```javascript
export const EMAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxia47SEM2GmGrjSF2Cy1cviYhTt9PVF7n3M_vYVuIl26PQeoZ-f2OqSC0IyMBr5Ob0lA/exec';
export const EMAIL_SECRET = '58964bb773a19a7b207be3c75673866b914a070c106bec92';
```

Si en algún momento se vuelve a implementar el script de cero (URL `/exec` nueva) o se
rota el secreto, hay que actualizar esas dos líneas en `js/email-config.js` — el
`EMAIL_SECRET` del sitio y el `SHARED_SECRET` del script deben coincidir exacto.

El proyecto viejo bajo `tintinaccs@gmail.com` ya no está conectado a nada — el
sitio no le manda ninguna llamada. Si todavía existe una implementación activa
ahí, se puede archivar/eliminar desde ese Apps Script sin afectar el flujo actual.

## 5. Probar

1. Hacé un pedido de prueba desde el checkout público
2. Revisá la bandeja de `tintinaccs@gmail.com` — debería llegar en segundos, con
   remitente **`tintinpedidos@gmail.com`**
3. Revisá que también llegue la confirmación a la cuenta de la clienta de prueba,
   mismo remitente
4. En Super Admin → Pedidos, probá el botón **"✉️ Reenviar"** en cualquier pedido —
   también debe salir desde `tintinpedidos@gmail.com`
5. Confirmá en Super Admin → Pedidos que la columna de notificación muestra
   "Notificado" cuando salieron los dos correos — para probar `partial`/`failed`
   hace falta forzar un error real (ej. un `order.userEmail` con formato inválido)
6. Revisá también la carpeta de Spam de ambas bandejas — con una cuenta de
   Gmail nueva es normal que los primeros correos caigan ahí. Marcá "No es
   spam" y agregá `tintinpedidos@gmail.com` a los contactos para acelerar que
   Gmail deje de filtrarlo

## Si algo falla
- Si no llega nada: abrí la consola del navegador (F12) en el checkout y buscá mensajes que empiecen con `[email-notify]`
- Revisá que la URL en `js/email-config.js` termine en `/exec` (no `/dev`)
- Revisá que en el paso 3 hayas elegido "Cualquier usuario" con acceso, no "Solo yo"
- Si editaste el script después de implementarlo, tenés que crear una **nueva implementación** (Implementar → Administrar implementaciones → editar → nueva versión) para que los cambios tomen efecto
- Si el correo sigue llegando "De: tintinaccs@gmail.com", es porque `js/email-config.js`
  todavía apunta a la URL vieja, o la implementación activa en Apps Script sigue
  siendo la del proyecto bajo `tintinaccs@gmail.com`
