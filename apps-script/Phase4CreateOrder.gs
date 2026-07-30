/* =============================================================
   TINTIN — FASE 4: CREACIÓN DE PEDIDOS SIN LÍMITE DE PRODUCTOS

   Agregá este archivo al MISMO proyecto de Google Apps Script que ya
   tiene Código.gs y Phase3Security.gs. Reutiliza sus constantes y
   funciones (FIRESTORE_PROJECT_ID_, phase3DecodeFields_,
   verifyFirebaseIdToken_, SUPER_ADMIN_EMAIL, phase3EmailMatches_) — NO
   las vuelvas a declarar acá: todos los archivos .gs de un mismo
   proyecto comparten un único espacio global, y declarar una constante
   dos veces rompe el proyecto entero.

   Por qué existe: firestore.rules valida un pedido completo en una sola
   escritura, y Firestore tiene un límite duro de 1000 "expresiones"
   evaluadas por escritura. Con eso, un carrito de más de ~4 productos
   distintos ya se rechaza siempre (ver sparkOrderCreateValid en
   firestore.rules, y el comentario ahí mismo). Este archivo mueve la
   creación del pedido a un proceso privilegiado — la cuenta dueña de
   este Apps Script, que ya tiene acceso IAM al proyecto de Firebase —
   que NO pasa por esas reglas. Es la misma técnica que ya usa
   phase3UpdateOrderNotificationStatus_ en Phase3Security.gs (
   ScriptApp.getOAuthToken() en vez de un idToken de clienta). Acá no hay
   límite de productos ni de expresiones: es JavaScript común iterando
   un arreglo, con una transacción real de Firestore (beginTransaction/
   batchGet/commit) para que la lectura de stock y la escritura del
   pedido sean atómicas, igual que runTransaction() en el navegador.

   Ver functions/EMAIL_PHASE3_DEPLOY.md para cómo se agrega un archivo
   nuevo al proyecto y qué permisos necesita la cuenta dueña.
   ============================================================= */

var PHASE4_FIRESTORE_BASE_URL_ =
  'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID_ + '/databases/(default)/documents';
var PHASE4_MAX_ITEMS_ = 60; // Tope generoso contra payloads absurdos — no es el límite artificial de 4 que esto reemplaza.
var PHASE4_CHECKOUT_GUARD_WINDOW_MS_ = 5 * 60 * 1000;
var PHASE4_DEFAULT_STORE_WHATSAPP_ = '595981299331';

function phase4AuthHeaders_() {
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
}

function phase4DocName_(relativePath) {
  return 'projects/' + FIRESTORE_PROJECT_ID_ + '/databases/(default)/documents/' + relativePath;
}

function phase4BeginTransaction_() {
  var response = UrlFetchApp.fetch(PHASE4_FIRESTORE_BASE_URL_ + ':beginTransaction', {
    method: 'post',
    contentType: 'application/json',
    headers: phase4AuthHeaders_(),
    payload: JSON.stringify({ options: { readWrite: {} } }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    return { ok: false, error: 'transaction_begin_failed', status: code };
  }
  var body = JSON.parse(response.getContentText() || '{}');
  return { ok: true, transaction: body.transaction };
}

function phase4Rollback_(transactionId) {
  try {
    UrlFetchApp.fetch(PHASE4_FIRESTORE_BASE_URL_ + ':rollback', {
      method: 'post',
      contentType: 'application/json',
      headers: phase4AuthHeaders_(),
      payload: JSON.stringify({ transaction: transactionId }),
      muteHttpExceptions: true
    });
  } catch (error) {
    // No hay nada más que hacer — Firestore igual expira la transacción sola.
  }
}

function phase4BatchGet_(relativePaths, transactionId) {
  var documents = relativePaths.map(phase4DocName_);
  var response = UrlFetchApp.fetch(PHASE4_FIRESTORE_BASE_URL_ + ':batchGet', {
    method: 'post',
    contentType: 'application/json',
    headers: phase4AuthHeaders_(),
    payload: JSON.stringify({ documents: documents, transaction: transactionId }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('[Phase4CreateOrder] batchGet falló. HTTP ' + code);
    return { ok: false, error: 'batch_get_failed', status: code };
  }
  var rows = JSON.parse(response.getContentText() || '[]');
  var byPath = {};
  rows.forEach(function (row) {
    if (row.found) {
      byPath[row.found.name.split('/documents/')[1]] = phase3DecodeFields_(row.found.fields || {});
    } else if (row.missing) {
      byPath[row.missing.split('/documents/')[1]] = null;
    }
  });
  return { ok: true, documents: byPath };
}

function phase4EncodeValue_(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(phase4EncodeValue_) } };
  if (typeof value === 'object') return { mapValue: { fields: phase4EncodeFields_(value) } };
  return { nullValue: null };
}

function phase4EncodeFields_(obj) {
  var fields = {};
  Object.keys(obj || {}).forEach(function (key) {
    fields[key] = phase4EncodeValue_(obj[key]);
  });
  return fields;
}

function phase4CreateWrite_(relativePath, fields) {
  return {
    update: { name: phase4DocName_(relativePath), fields: phase4EncodeFields_(fields) },
    currentDocument: { exists: false }
  };
}

function phase4UpdateWrite_(relativePath, fields, updateMaskPaths) {
  return {
    update: { name: phase4DocName_(relativePath), fields: phase4EncodeFields_(fields) },
    updateMask: { fieldPaths: updateMaskPaths },
    currentDocument: { exists: true }
  };
}

function phase4Commit_(writes, transactionId) {
  var response = UrlFetchApp.fetch(PHASE4_FIRESTORE_BASE_URL_ + ':commit', {
    method: 'post',
    contentType: 'application/json',
    headers: phase4AuthHeaders_(),
    payload: JSON.stringify({ writes: writes, transaction: transactionId }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('[Phase4CreateOrder] commit falló. HTTP ' + code);
    return { ok: false, error: 'commit_failed', status: code };
  }
  return { ok: true };
}

function phase4CleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength || 500);
}

function phase4HasOnlyKeys_(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) === -1) return false;
  }
  return true;
}

function phase4EmailValid_(value) {
  return typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phase4ExpectedMoneyValid_(value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1000000000;
}

function phase4ParseMoney_(value) {
  if (typeof value === 'number') return Math.round(value);
  var parsed = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
  return isFinite(parsed) ? Math.round(parsed) : NaN;
}

function phase4ParseStock_(value) {
  if (value === null || value === undefined || value === '') return null;
  var parsed = Number(value);
  return isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function phase4NormalizeCities_(list, fallbackCost) {
  return (Array.isArray(list) ? list : []).map(function (item, index) {
    if (typeof item === 'string') {
      return { name: phase4CleanText_(item, 120), price: phase4ParseMoney_(fallbackCost), sourceIndex: index };
    }
    if (!item || !item.name) return null;
    var price = item.price === null ? null : phase4ParseMoney_(item.price === undefined ? fallbackCost : item.price);
    return { name: phase4CleanText_(item.name, 120), price: isFinite(price) ? price : null, sourceIndex: index };
  }).filter(function (city) { return city; });
}

// Espejo de resolveShipping() en js/secure-checkout-order.js, sobre
// settings/general (paymentMethods, storeOpen) y settings/shippingRates
// (deliveryCities/encomiendaCities) — ver sparkShippingRatesPath() en
// firestore.rules para por qué viven separados.
function phase4ResolveShipping_(shippingRates, selectedCity) {
  if (selectedCity === '__retiro__') {
    return { ok: true, method: 'retiro', city: 'San Lorenzo (retiro)', cost: 0, pending: false, rateIndex: -1 };
  }
  var wanted = String(selectedCity || '').trim().toLowerCase();
  var delivery = phase4NormalizeCities_(shippingRates.deliveryCities, shippingRates.deliveryCost)
    .filter(function (city) { return city.name.toLowerCase() === wanted; })[0];
  if (delivery) {
    return { ok: true, method: 'delivery', city: delivery.name, cost: delivery.price, pending: delivery.price === null, rateIndex: delivery.sourceIndex };
  }
  var encomienda = phase4NormalizeCities_(shippingRates.encomiendaCities, shippingRates.encomiendaCost)
    .filter(function (city) { return city.name.toLowerCase() === wanted; })[0];
  if (encomienda) {
    return { ok: true, method: 'encomienda', city: encomienda.name, cost: encomienda.price, pending: encomienda.price === null, rateIndex: encomienda.sourceIndex };
  }
  return { ok: false, error: 'shipping_invalid' };
}

/**
 * action: 'createOrder'. payload es el mismo "draft" que ya arma
 * buildDraft() en js/secure-checkout-order.js: requestId, cartLines
 * ([{id, qty, variants}]), name, phone, contactEmail, notes,
 * selectedCity, departamento, address, referencia, mapLocation,
 * paymentMethod, expectedSubtotal, expectedShippingCost,
 * expectedShippingPending, expectedTotal.
 *
 * A diferencia del checkout actual (que crea el pedido en estado
 * "pending" y recién después reserva stock en una segunda escritura,
 * porque las reglas de Firestore no dejan a la clienta reescribir su
 * propio pedido pendiente), acá todo pasa en UNA sola transacción: se
 * lee stock/precio real y se crea el pedido ya "reservado" al mismo
 * tiempo, porque no hay reglas de por medio que lo impidan.
 *
 * Nota: si Firestore aborta el commit por una escritura concurrente
 * sobre el mismo producto (alguien más compró justo antes), esta
 * versión no reintenta sola todavía — devuelve el error y quien llama
 * puede reintentar la misma acción (mismo requestId, así que no duplica
 * nada: ver el chequeo de "pedido ya existe" más abajo).
 */
function phase4CreateOrder_(payload, idToken) {
  var auth = verifyFirebaseIdToken_(idToken);
  if (!auth.ok) return auth;
  if (!auth.emailVerified) return { ok: false, error: 'email_not_verified' };

  var uid = auth.uid;
  var email = String(auth.email || '').trim().toLowerCase();
  var isSuperAdmin = phase3EmailMatches_(email, SUPER_ADMIN_EMAIL);

  payload = payload && typeof payload === 'object' ? payload : {};
  if (!phase4HasOnlyKeys_(payload, [
    'action', 'idToken', 'requestId', 'cartLines', 'name', 'phone',
    'contactEmail', 'notes', 'selectedCity', 'departamento', 'address',
    'referencia', 'mapLocation', 'paymentMethod', 'expectedSubtotal',
    'expectedShippingCost', 'expectedShippingPending', 'expectedTotal'
  ])) {
    return { ok: false, error: 'invalid_payload' };
  }

  var requestId = phase4CleanText_(payload.requestId, 100);
  if (!requestId || !/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) {
    return { ok: false, error: 'invalid_request_id' };
  }
  var orderId = uid + '_' + requestId;

  var cartLines = Array.isArray(payload.cartLines) ? payload.cartLines : [];
  if (!cartLines.length) return { ok: false, error: 'empty_cart' };
  if (cartLines.length > PHASE4_MAX_ITEMS_) return { ok: false, error: 'too_many_products' };
  for (var i = 0; i < cartLines.length; i++) {
    var rawLine = cartLines[i];
    if (!phase4HasOnlyKeys_(rawLine, ['id', 'qty', 'variants', 'variant'])) {
      return { ok: false, error: 'invalid_cart' };
    }
    var rawQty = Number(rawLine && rawLine.qty);
    var rawId = phase4CleanText_(rawLine && rawLine.id, 180);
    var rawVariants = Array.isArray(rawLine && rawLine.variants)
      ? rawLine.variants
      : (rawLine && rawLine.variant ? [rawLine.variant] : []);
    if (
      !rawId ||
      !isFinite(rawQty) ||
      !Number.isInteger(rawQty) ||
      rawQty < 1 ||
      rawQty > 99 ||
      rawVariants.length > 10 ||
      rawVariants.some(function (variant) {
        return typeof variant !== 'string' || variant.length > 120;
      })
    ) {
      return { ok: false, error: 'invalid_cart' };
    }
  }

  var name = phase4CleanText_(payload.name, 120);
  if (name.length < 2) return { ok: false, error: 'name_required' };
  var paymentMethod = String(payload.paymentMethod || '');
  if (paymentMethod !== 'efectivo' && paymentMethod !== 'transferencia') {
    return { ok: false, error: 'payment_required' };
  }
  var phone = phase4CleanText_(payload.phone, 40);
  var contactEmail = phase4CleanText_(payload.contactEmail, 254).toLowerCase() || email;
  var notes = phase4CleanText_(payload.notes, 1000);
  var selectedCity = phase4CleanText_(payload.selectedCity, 120);
  var departamento = phase4CleanText_(payload.departamento, 80);
  var address = phase4CleanText_(payload.address, 300);
  var referencia = phase4CleanText_(payload.referencia, 300);

  if (!/^\d{8,20}$/.test(phone)) return { ok: false, error: 'phone_invalid' };
  if (!phase4EmailValid_(contactEmail)) return { ok: false, error: 'email_invalid' };
  if (!selectedCity) return { ok: false, error: 'shipping_invalid' };
  if (
    !phase4ExpectedMoneyValid_(payload.expectedSubtotal) ||
    !phase4ExpectedMoneyValid_(payload.expectedShippingCost) ||
    typeof payload.expectedShippingPending !== 'boolean' ||
    !phase4ExpectedMoneyValid_(payload.expectedTotal)
  ) {
    return { ok: false, error: 'invalid_quote' };
  }

  var mapLocation = null;
  if (payload.mapLocation !== null && payload.mapLocation !== undefined) {
    if (!phase4HasOnlyKeys_(payload.mapLocation, ['lat', 'lng', 'name', 'address'])) {
      return { ok: false, error: 'map_invalid' };
    }
    var latitude = Number(payload.mapLocation.lat);
    var longitude = Number(payload.mapLocation.lng);
    if (
      !isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return { ok: false, error: 'map_invalid' };
    }
    mapLocation = {
      lat: latitude,
      lng: longitude,
      name: phase4CleanText_(payload.mapLocation.name, 120),
      address: phase4CleanText_(payload.mapLocation.address, 240)
    };
  }

  var tx = phase4BeginTransaction_();
  if (!tx.ok) return tx;
  var transactionId = tx.transaction;

  try {
    var readPaths = [
      'orders/' + orderId,
      'settings/general',
      'settings/shippingRates',
      'users/' + uid,
      'checkoutGuards/' + uid
    ];
    var productPaths = cartLines.map(function (line) { return 'products/' + phase4CleanText_(line.id, 180); });
    var batch = phase4BatchGet_(readPaths.concat(productPaths), transactionId);
    if (!batch.ok) { phase4Rollback_(transactionId); return batch; }
    var docs = batch.documents;

    var existingOrder = docs['orders/' + orderId];
    if (existingOrder) {
      phase4Rollback_(transactionId);
      if (existingOrder.inventoryState === 'pending' || existingOrder.inventoryState === 'reserved') {
        return { ok: true, orderId: orderId, order: existingOrder, created: false };
      }
      return { ok: false, error: 'order_state_invalid' };
    }

    var settings = docs['settings/general'] || {};
    var shippingRates = docs['settings/shippingRates'] || {};
    var userData = docs['users/' + uid];
    var guardData = docs['checkoutGuards/' + uid];

    if (!userData) { phase4Rollback_(transactionId); return { ok: false, error: 'profile_missing' }; }

    if (!isSuperAdmin) {
      if (settings.storeOpen !== true) { phase4Rollback_(transactionId); return { ok: false, error: 'store_closed' }; }
      if (userData.blocked === true) { phase4Rollback_(transactionId); return { ok: false, error: 'blocked_account' }; }
      if (!guardData || guardData.lastCheckoutOrderId !== orderId) {
        phase4Rollback_(transactionId);
        return { ok: false, error: 'checkout_guard_missing' };
      }
      var guardAtMs = Date.parse((guardData.lastCheckoutAt && guardData.lastCheckoutAt.value) || guardData.lastCheckoutAt || '');
      if (!guardAtMs || (Date.now() - guardAtMs) > PHASE4_CHECKOUT_GUARD_WINDOW_MS_) {
        phase4Rollback_(transactionId);
        return { ok: false, error: 'checkout_guard_expired' };
      }
    }

    if ((settings.paymentMethods || {})[paymentMethod] === false) {
      phase4Rollback_(transactionId);
      return { ok: false, error: 'payment_unavailable' };
    }

    // Respaldo en settings/general por si settings/shippingRates todavía no
    // se migró del todo (ver js/create-order-client.js y la migración
    // automática en js/admin-app.js) — el mismo respaldo que ya usa
    // mergeShippingRates() en js/secure-checkout-order.js, para que el
    // cliente y el servidor calculen el mismo costo de envío siempre.
    var shippingRatesMerged = {
      deliveryCities: Array.isArray(shippingRates.deliveryCities) ? shippingRates.deliveryCities : settings.deliveryCities,
      encomiendaCities: Array.isArray(shippingRates.encomiendaCities) ? shippingRates.encomiendaCities : settings.encomiendaCities,
      deliveryCost: shippingRates.deliveryCost != null ? shippingRates.deliveryCost : settings.deliveryCost,
      encomiendaCost: shippingRates.encomiendaCost != null ? shippingRates.encomiendaCost : settings.encomiendaCost
    };
    var shipping = phase4ResolveShipping_(shippingRatesMerged, selectedCity);
    if (!shipping.ok) { phase4Rollback_(transactionId); return shipping; }
    if (shipping.method === 'delivery' && (!mapLocation || !mapLocation.name)) {
      phase4Rollback_(transactionId);
      return { ok: false, error: 'map_required' };
    }
    if (shipping.method === 'encomienda' && address.length < 5) {
      phase4Rollback_(transactionId);
      return { ok: false, error: 'address_required' };
    }

    var resolvedItems = [];
    var subtotal = 0;
    for (var idx = 0; idx < cartLines.length; idx++) {
      var line = cartLines[idx];
      var productId = phase4CleanText_(line.id, 180);
      var product = docs['products/' + productId];
      if (!product) { phase4Rollback_(transactionId); return { ok: false, error: 'product_not_found', productId: productId }; }
      if (product.active === false) { phase4Rollback_(transactionId); return { ok: false, error: 'product_inactive', productId: productId }; }
      var price = phase4ParseMoney_(product.price);
      if (!isFinite(price) || price < 0) { phase4Rollback_(transactionId); return { ok: false, error: 'invalid_price', productId: productId }; }
      var stock = phase4ParseStock_(product.stock);
      var qty = Number(line.qty);
      if (stock !== null && qty > stock) {
        phase4Rollback_(transactionId);
        return { ok: false, error: 'insufficient_stock', productId: productId, available: stock, requested: qty };
      }
      var variants = Array.isArray(line.variants) ? line.variants : (line.variant ? [line.variant] : []);
      resolvedItems.push({
        id: productId,
        name: phase4CleanText_(product.name || product.title || 'Producto', 180),
        cat: phase4CleanText_(product.category || product.collectionSlug || product.collection || product.cat || '', 120),
        price: price,
        qty: qty,
        variant: phase4CleanText_(variants.join(' / '), 120),
        imageUrl: phase4CleanText_(product.imageUrl || product.image || '', 900)
      });
      subtotal += price * qty;
    }

    var shippingCost = shipping.cost === null ? 0 : shipping.cost;
    var total = subtotal + shippingCost;
    if (
      Number(payload.expectedSubtotal) !== subtotal ||
      Number(payload.expectedShippingCost) !== shippingCost ||
      Boolean(payload.expectedShippingPending) !== shipping.pending ||
      Number(payload.expectedTotal) !== total
    ) {
      phase4Rollback_(transactionId);
      return {
        ok: false,
        error: 'quote_changed',
        quote: { items: resolvedItems, subtotal: subtotal, shippingCost: shippingCost, shippingPending: shipping.pending, total: total }
      };
    }

    var shortId = requestId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
    var nowIso = new Date().toISOString();
    var orderData = {
      requestId: requestId,
      source: 'spark-checkout-v1',
      shortId: shortId,
      userId: uid,
      userEmail: email,
      contactEmail: contactEmail,
      userName: name,
      userPhone: phone,
      items: resolvedItems,
      subtotal: subtotal,
      shippingCost: shippingCost,
      shippingPending: shipping.pending,
      total: total,
      storeWhatsapp: String(settings.whatsappNumber || settings.whatsapp || PHASE4_DEFAULT_STORE_WHATSAPP_).replace(/\D/g, ''),
      storeInstagram: phase4CleanText_(settings.instagram, 120),
      shipping: {
        method: shipping.method,
        city: shipping.city,
        departamento: departamento,
        rateIndex: shipping.rateIndex,
        address: address,
        referencia: referencia,
        zone: shipping.method === 'encomienda' ? 'interior' : 'central',
        mapLocation: shipping.method === 'delivery' ? mapLocation : null
      },
      payment: { method: paymentMethod, status: 'pendiente' },
      paymentStatus: 'pendiente',
      status: 'pendiente',
      notes: notes,
      notificationStatus: 'pending',
      inventoryState: 'reserved',
      inventoryRevision: 1,
      inventoryUpdatedAt: nowIso,
      inventoryUpdatedBy: email,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    var writes = [phase4CreateWrite_('orders/' + orderId, orderData)];
    resolvedItems.forEach(function (item) {
      var stock = phase4ParseStock_(docs['products/' + item.id].stock);
      if (stock !== null) {
        writes.push(phase4UpdateWrite_('products/' + item.id, {
          stock: stock - item.qty,
          lastStockOrderId: orderId,
          updatedAt: nowIso
        }, ['stock', 'lastStockOrderId', 'updatedAt']));
      }
    });

    var commit = phase4Commit_(writes, transactionId);
    if (!commit.ok) return commit;

    return { ok: true, orderId: orderId, order: orderData, created: true };
  } catch (error) {
    phase4Rollback_(transactionId);
    console.error('[Phase4CreateOrder] Error inesperado:', error);
    return { ok: false, error: 'create_order_failed' };
  }
}
