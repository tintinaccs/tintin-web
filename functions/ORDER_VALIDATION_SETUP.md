# Tintin — Validación de pedidos server-side (Fase 0 de la auditoría)

Este documento agrega **dos capacidades nuevas** al mismo Google Apps Script
que ya usás para los correos (`functions/EMAIL_SETUP.md`) — no es un proyecto
nuevo, ni una cuenta nueva, ni un plan pago:

1. **`createOrder`** — el checkout deja de crear el pedido directo en
   Firestore desde el navegador. En su lugar, le manda al script los
   productos (solo id + cantidad, nunca precio) + la ciudad + los datos
   personales, y es **el script** el que busca el precio/stock real de cada
   producto, el costo de envío real, recalcula el total, y recién ahí crea
   el pedido — usando una cuenta de servicio con acceso directo a Firestore
   (no pasa por las reglas de seguridad del navegador, así que nunca se
   puede "convencer" con datos falsos).
2. **`resendEmail`** — reemplaza el secreto compartido (`EMAIL_SECRET`) del
   botón "Reenviar" de Super Admin por una verificación real: el script
   comprueba el token de sesión de quien hace clic y que su rol sea
   admin/agente/superadmin antes de reenviar nada.

## Importante — esto todavía NO está conectado

Pegar este código en tu Apps Script **no cambia nada del comportamiento
actual todavía**. El camino viejo (con `SHARED_SECRET`, el que usa
`checkout.html` y `admin.html` ahora mismo) queda intacto dentro del mismo
script — simplemente se le suman las dos acciones nuevas al lado. Recién
en un paso posterior (cuando confirmes que esto ya está desplegado y yo lo
haya probado por HTTP) se cambia `checkout.html`/`admin.html` para que
empiecen a usar `createOrder`/`resendEmail`, y ahí sí se puede borrar el
secreto viejo.

## 1. Generar la cuenta de servicio (una sola vez)

1. Andá a **[Firebase Console](https://console.firebase.google.com/)** →
   tu proyecto `tintin-accesorios` → ⚙️ **Configuración del proyecto** →
   pestaña **Cuentas de servicio**.
2. Click en **"Generar nueva clave privada"** → confirmá → se descarga un
   archivo `.json`. **Guardalo en un lugar seguro, nunca lo subas al
   repositorio ni lo compartas** — es lo único realmente sensible de todo
   este cambio.
3. Abrí ese archivo `.json` con un editor de texto, copiá **todo el
   contenido** tal cual (es un solo bloque `{ ... }`).

## 2. Guardar la clave en Apps Script (no en el código)

1. Andá a tu proyecto de Apps Script existente (**"Tintin - Emails de
   pedidos"**, el mismo de siempre)
2. A la izquierda, ⚙️ **"Configuración del proyecto"**
3. Bajá hasta **"Propiedades del script"** → **"Agregar propiedad de
   script"**
4. Propiedad: `SERVICE_ACCOUNT_JSON` — Valor: pegá el JSON completo del
   paso anterior (todo en una sola línea está bien)
5. Guardar

Esto guarda la clave fuera del código — nunca queda visible ni copiable
por accidente cuando compartís o revisás el script.

## 3. Reemplazar el código del script

Abrí el mismo proyecto de Apps Script, **borrá todo** y pegá el código
completo de la sección 4. Reemplazá `TU_SECRETO_AQUI` por el mismo secreto
que ya tenías puesto ahí (así el camino viejo sigue funcionando sin
cambios mientras dure la transición).

## 4. Código completo para pegar

```javascript
const SHARED_SECRET   = 'TU_SECRETO_AQUI'; // el mismo de siempre — camino viejo, sin cambios
const ADMIN_EMAIL      = 'tintinaccs@gmail.com';
const STORE_NAME        = 'Tintin Accesorios';
const ADMIN_PANEL       = 'https://tintinaccs.github.io/tintin-web/admin.html';
const DEFAULT_STORE_WHATSAPP = '595981299331';

// Proyecto de Firebase y API key pública (la misma que ya está en
// js/firebase.js — no es un secreto, es la clave web pública de Firebase).
const FIREBASE_PROJECT_ID = 'tintin-accesorios';
const FIREBASE_API_KEY    = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ---- Acciones nuevas (Fase 0): autenticadas con el token real de
    // Firebase de quien hace la llamada, sin ningún secreto compartido ----
    if (data.action === 'createOrder') return jsonOut(handleCreateOrder_(data));
    if (data.action === 'resendEmail') return jsonOut(handleResendEmail_(data));

    // ---- Camino viejo — SIN CAMBIOS, sigue funcionando igual mientras
    // checkout.html/admin.html no migren a las acciones de arriba. Se borra
    // junto con SHARED_SECRET una vez completada la migración. ----
    if (data.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: 'unauthorized' });
    }
    const order    = data.order || {};
    const orderId  = data.orderId || '';
    const isResend = !!data.isResend;
    const shortId  = order.shortId || (orderId ? orderId.slice(0, 8).toUpperCase() : '—');

    const adminSubject = (isResend ? '🔁 [Reenviado] ' : '') +
      'Nuevo pedido #' + shortId + ' — ' + fmtPrice(order.total) + ' — ' + (order.userName || 'Cliente');
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: adminSubject,
      body: buildAdminText(shortId, order),
      htmlBody: buildAdminHtml(shortId, order)
    });
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

// ============================================================
// ACCIÓN NUEVA 1 — crear pedido validado server-side
// ============================================================
function handleCreateOrder_(data) {
  const idToken = data.idToken;
  if (!idToken) return { success: false, error: 'missing_token' };

  let account;
  try {
    account = verifyIdToken_(idToken);
  } catch (e) {
    return { success: false, error: 'invalid_token' };
  }
  if (!account.emailVerified) return { success: false, error: 'email_not_verified' };

  const uid   = account.localId;
  const email = String(account.email || '').toLowerCase();

  const userDoc = firestoreGetDoc_('users/' + uid);
  if (userDoc && userDoc.blocked === true) return { success: false, error: 'blocked' };

  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) return { success: false, error: 'empty_cart' };

  const resolvedItems = [];
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    const reqItem = items[i] || {};
    const product = firestoreGetDoc_('products/' + reqItem.id);
    if (!product) return { success: false, error: 'product_not_found:' + reqItem.id };
    if (product.active === false) return { success: false, error: 'product_inactive:' + reqItem.id };

    const qty = Math.max(1, parseInt(reqItem.qty, 10) || 1);
    if (product.stock !== null && product.stock !== undefined) {
      if (qty > Number(product.stock)) return { success: false, error: 'insufficient_stock:' + reqItem.id };
    }
    const price = Number(product.price || 0);
    resolvedItems.push({
      id: reqItem.id, name: product.name || '', cat: product.cat || '',
      price: price, qty: qty, variant: reqItem.variant || '',
      imageUrl: product.imageUrl || ''
    });
    subtotal += price * qty;
  }

  const settings = firestoreGetDoc_('settings/general') || {};
  const shippingMethod = data.shippingMethod;
  const city = data.city || '';
  let shippingCost = null;
  let zone = 'interior';

  if (shippingMethod === 'retiro') {
    shippingCost = 0;
  } else {
    const list = shippingMethod === 'delivery' ? (settings.deliveryCities || []) : (settings.encomiendaCities || []);
    let match = null;
    for (let j = 0; j < list.length; j++) {
      if (list[j] && list[j].name === city) { match = list[j]; break; }
    }
    if (match && match.price !== null && match.price !== undefined) shippingCost = Number(match.price);
    zone = shippingMethod === 'delivery' ? 'central' : 'interior';
  }
  const shippingPending = shippingCost === null;
  const total = subtotal + (shippingCost || 0);

  const now = new Date();
  const orderFields = {
    shortId: generateShortId_(),
    userId: uid,
    userEmail: email,
    userName: String(data.name || ''),
    userPhone: String(data.phone || ''),
    items: resolvedItems,
    subtotal: subtotal,
    shippingCost: shippingCost,
    shippingPending: shippingPending,
    total: total,
    storeWhatsapp: settings.whatsappNumber || DEFAULT_STORE_WHATSAPP,
    storeInstagram: settings.instagram || '',
    shipping: {
      method: shippingMethod, city: city,
      address: String(data.address || ''), referencia: String(data.referencia || ''),
      zone: zone, mapLocation: data.mapLocation || null
    },
    payment: { method: data.paymentMethod, status: 'pendiente' },
    paymentStatus: 'pendiente',
    status: 'pendiente',
    notes: String(data.notes || ''),
    notificationStatus: 'pending',
    createdAt: TS_(now),
    updatedAt: TS_(now)
  };

  const created = firestoreCreateDoc_('orders', orderFields);
  const orderId  = created.id;
  const shortId  = orderFields.shortId;
  const orderForEmail = Object.assign({}, orderFields, { createdAt: now.toISOString() });

  let mailOk = true;
  try {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: 'Nuevo pedido #' + shortId + ' — ' + fmtPrice(total) + ' — ' + (orderForEmail.userName || 'Cliente'),
      body: buildAdminText(shortId, orderForEmail),
      htmlBody: buildAdminHtml(shortId, orderForEmail)
    });
    if (orderForEmail.userEmail) {
      MailApp.sendEmail({
        to: orderForEmail.userEmail,
        subject: 'Recibimos tu pedido en Tintin 💗 Pedido #' + shortId,
        body: buildCustomerText(shortId, orderForEmail),
        htmlBody: buildCustomerHtml(shortId, orderForEmail)
      });
    }
  } catch (mailErr) {
    mailOk = false;
  }

  try {
    firestorePatchDoc_('orders/' + orderId, {
      notificationStatus: mailOk ? 'sent' : 'failed',
      updatedAt: TS_(new Date())
    });
  } catch (patchErr) {
    // El pedido ya se creó bien igual — si esto falla, el estado del correo
    // queda en "pending" en vez de reflejar el resultado real, pero el
    // pedido en sí nunca se pierde.
  }

  return {
    success: true, orderId: orderId, shortId: shortId,
    total: total, shippingCost: shippingCost,
    notificationStatus: mailOk ? 'sent' : 'failed'
  };
}

// ============================================================
// ACCIÓN NUEVA 2 — reenviar correo (reemplaza el secreto compartido)
// ============================================================
function handleResendEmail_(data) {
  const idToken = data.idToken;
  if (!idToken) return { success: false, error: 'missing_token' };

  let account;
  try {
    account = verifyIdToken_(idToken);
  } catch (e) {
    return { success: false, error: 'invalid_token' };
  }

  const userDoc = firestoreGetDoc_('users/' + account.localId);
  const role = userDoc && userDoc.role;
  const isAllowed = account.email === ADMIN_EMAIL || role === 'admin' || role === 'agent' || role === 'superadmin';
  if (!isAllowed) return { success: false, error: 'forbidden' };

  const orderId = data.orderId;
  const order = firestoreGetDoc_('orders/' + orderId);
  if (!order) return { success: false, error: 'order_not_found' };

  const shortId = order.shortId || String(orderId).slice(0, 8).toUpperCase();
  const orderForEmail = Object.assign({}, order, { createdAt: order.createdAt || new Date().toISOString() });

  try {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: '🔁 [Reenviado] Nuevo pedido #' + shortId + ' — ' + fmtPrice(order.total) + ' — ' + (order.userName || 'Cliente'),
      body: buildAdminText(shortId, orderForEmail),
      htmlBody: buildAdminHtml(shortId, orderForEmail)
    });
  } catch (e) {
    return { success: false, error: String(e) };
  }

  firestorePatchDoc_('orders/' + orderId, {
    resendCount: (Number(order.resendCount) || 0) + 1,
    lastResendAt: TS_(new Date()),
    notificationStatus: 'sent',
    updatedAt: TS_(new Date())
  });

  return { success: true };
}

// ============================================================
// Verificación del token real de sesión de Firebase (reemplaza el secreto)
// ============================================================
function verifyIdToken_(idToken) {
  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() >= 400) throw new Error('invalid_token');
  const body = JSON.parse(res.getContentText());
  const user = body.users && body.users[0];
  if (!user) throw new Error('invalid_token');
  return { localId: user.localId, email: user.email, emailVerified: !!user.emailVerified };
}

function generateShortId_() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin O/I, evita confusión visual
  let s = '';
  for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// ============================================================
// Cuenta de servicio → token de acceso a Firestore (cacheado ~55 min)
// ============================================================
function getServiceAccountAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('sa_access_token');
  if (cached) return cached;

  const keyJson = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_JSON');
  if (!keyJson) throw new Error('Falta SERVICE_ACCOUNT_JSON en Propiedades del script');
  const key = JSON.parse(keyJson);

  const now = Math.floor(Date.now() / 1000);
  const header   = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const b64 = function (obj) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  };
  const toSign = b64(header) + '.' + b64(claimSet);
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, key.private_key);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  const jwt = toSign + '.' + signature;

  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText());
  if (!body.access_token) throw new Error('No se pudo obtener token de acceso: ' + res.getContentText());
  cache.put('sa_access_token', body.access_token, 3300);
  return body.access_token;
}

// ============================================================
// Firestore REST — helpers mínimos (get / create / patch)
// ============================================================
function firestoreBaseUrl_() {
  return 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents';
}

function firestoreGetDoc_(path) {
  const token = getServiceAccountAccessToken_();
  const res = UrlFetchApp.fetch(firestoreBaseUrl_() + '/' + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() >= 400) throw new Error('Firestore GET ' + path + ' -> ' + res.getResponseCode() + ' ' + res.getContentText());
  return fromFirestoreDoc_(JSON.parse(res.getContentText()));
}

function firestoreCreateDoc_(collectionPath, fields) {
  const token = getServiceAccountAccessToken_();
  const res = UrlFetchApp.fetch(firestoreBaseUrl_() + '/' + collectionPath, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: toFirestoreFields_(fields) }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 400) throw new Error('Firestore CREATE ' + collectionPath + ' -> ' + res.getResponseCode() + ' ' + res.getContentText());
  const body = JSON.parse(res.getContentText());
  const name = body.name || '';
  return { id: name.split('/').pop(), data: fromFirestoreDoc_(body) };
}

function firestorePatchDoc_(path, fields) {
  const token = getServiceAccountAccessToken_();
  const mask = Object.keys(fields).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  const res = UrlFetchApp.fetch(firestoreBaseUrl_() + '/' + path + '?' + mask, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: toFirestoreFields_(fields) }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 400) throw new Error('Firestore PATCH ' + path + ' -> ' + res.getResponseCode() + ' ' + res.getContentText());
  return true;
}

function TS_(date) { return { __ts__: date }; }

function toFirestoreValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v && v.__ts__) return { timestampValue: Utilities.formatDate(v.__ts__, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue_) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields_(v) } };
  return { stringValue: String(v) };
}
function toFirestoreFields_(obj) {
  const out = {};
  Object.keys(obj).forEach(function (k) { out[k] = toFirestoreValue_(obj[k]); });
  return out;
}
function fromFirestoreValue_(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue_);
  if ('mapValue' in v) return fromFirestoreFields_(v.mapValue.fields || {});
  return null;
}
function fromFirestoreFields_(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(function (k) { out[k] = fromFirestoreValue_(fields[k]); });
  return out;
}
function fromFirestoreDoc_(doc) {
  return fromFirestoreFields_(doc.fields || {});
}

// ============================================================
// Helpers de correo — IDÉNTICOS a los que ya tenías (sin cambios), para no
// arriesgar nada de lo que ya funciona. Ver functions/EMAIL_SETUP.md.
// ============================================================
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
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
function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
}
function waGreetingToCustomer(shortId, order) {
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  return 'Hola' + (first ? ' ' + first : '') + '! 👋 Soy de ' + STORE_NAME + ', te escribo por tu pedido #' + shortId + '. 💗';
}
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
  return '<!DOCTYPE html><html><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#fef5f8;padding:24px">' +
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
  return '<!DOCTYPE html><html><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#fef5f8;padding:24px">' +
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

## 5. Volver a implementar (nueva versión)

Igual que siempre que editás el script:

1. **"Implementar"** → **"Administrar implementaciones"**
2. Click en el ✏️ (lápiz) de la implementación activa
3. **Versión**: "Nueva versión" → **"Implementar"**
4. La URL (`/exec`) **no cambia** — no hace falta tocar `js/email-config.js`
   todavía.

## 6. Cómo lo pruebo yo, sin tocar `checkout.html`

Una vez que esto esté desplegado, avisame la URL (si es la misma de
siempre, listo) y pruebo directo por HTTP, sin login real:

- Mando un `idToken` inválido → debe devolver `invalid_token`.
- Mando un producto inexistente → debe devolver `product_not_found`.
- Mando una cantidad mayor al stock → debe devolver `insufficient_stock`.
- Con datos válidos de una cuenta de prueba → debe crear el pedido con el
  precio/total recalculado, y devolver `notificationStatus`.

Recién cuando esto esté confirmado, sigo con el siguiente paso: cambiar
`checkout.html` para que llame a `createOrder` en vez de escribir el
pedido directo, y `admin.html` para que el botón "Reenviar" llame a
`resendEmail` — cada uno como su propio cambio, no mezclados.
