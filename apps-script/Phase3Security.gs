/* =============================================================
   TINTIN — FASE 3: SEGURIDAD DE CORREOS DE PEDIDOS

   Agregá este archivo al MISMO proyecto de Google Apps Script que ya
   contiene Code.gs. No reemplaza los diseños de correo existentes.
   Ver functions/EMAIL_PHASE3_DEPLOY.md para los tres cambios pequeños
   que hay que hacer dentro de doPost(e).
   ============================================================= */

const FIRESTORE_PROJECT_ID_ = 'tintin-accesorios';
const FIRESTORE_DOCUMENTS_URL_ =
  'https://firestore.googleapis.com/v1/projects/' +
  FIRESTORE_PROJECT_ID_ +
  '/databases/(default)/documents/';
const ORIGINAL_ORDER_EMAIL_MAX_AGE_MS_ = 30 * 60 * 1000;

function phase3DecodeValue_(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(phase3DecodeValue_);
  }
  if (value.mapValue) {
    return phase3DecodeFields_(value.mapValue.fields || {});
  }
  if (value.geoPointValue) {
    return {
      latitude: Number(value.geoPointValue.latitude),
      longitude: Number(value.geoPointValue.longitude)
    };
  }
  return null;
}

function phase3DecodeFields_(fields) {
  const result = {};
  Object.keys(fields || {}).forEach(function (key) {
    result[key] = phase3DecodeValue_(fields[key]);
  });
  return result;
}

function phase3FetchDocument_(relativePath, idToken) {
  try {
    const headers = {};
    if (idToken) headers.Authorization = 'Bearer ' + idToken;
    const response = UrlFetchApp.fetch(
      FIRESTORE_DOCUMENTS_URL_ + relativePath,
      {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      }
    );
    const status = response.getResponseCode();
    if (status === 404) return { ok: false, error: 'document_not_found' };
    if (status !== 200) {
      return {
        ok: false,
        error: 'firestore_read_failed',
        status: status
      };
    }
    const body = JSON.parse(response.getContentText() || '{}');
    return {
      ok: true,
      data: phase3DecodeFields_(body.fields || {})
    };
  } catch (error) {
    return { ok: false, error: 'firestore_read_failed', detail: String(error) };
  }
}

function phase3CleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength || 500);
}

function phase3SafeHttpsUrl_(value) {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) ? url.slice(0, 1000) : '';
}

function phase3SanitizeOrder_(rawOrder) {
  const order = rawOrder && typeof rawOrder === 'object' ? rawOrder : {};
  const shipping = order.shipping && typeof order.shipping === 'object'
    ? order.shipping
    : {};
  const location = shipping.mapLocation && typeof shipping.mapLocation === 'object'
    ? shipping.mapLocation
    : null;

  return {
    requestId: phase3CleanText_(order.requestId, 120),
    source: phase3CleanText_(order.source, 80),
    shortId: phase3CleanText_(order.shortId, 20),
    userId: phase3CleanText_(order.userId, 160),
    userEmail: phase3CleanText_(order.userEmail, 254).toLowerCase(),
    contactEmail: phase3CleanText_(order.contactEmail, 254).toLowerCase(),
    userName: phase3CleanText_(order.userName, 120),
    userPhone: phase3CleanText_(order.userPhone, 40),
    items: (Array.isArray(order.items) ? order.items : []).slice(0, 20).map(function (item) {
      item = item && typeof item === 'object' ? item : {};
      return {
        id: phase3CleanText_(item.id, 180),
        name: phase3CleanText_(item.name, 180),
        cat: phase3CleanText_(item.cat, 120),
        price: Number(item.price || 0),
        qty: Number(item.qty || 0),
        variant: phase3CleanText_(item.variant, 120),
        imageUrl: phase3SafeHttpsUrl_(item.imageUrl)
      };
    }),
    subtotal: Number(order.subtotal || 0),
    shippingCost: Number(order.shippingCost || 0),
    shippingPending: order.shippingPending === true,
    total: Number(order.total || 0),
    shipping: {
      method: phase3CleanText_(shipping.method, 40),
      city: phase3CleanText_(shipping.city, 120),
      address: phase3CleanText_(shipping.address, 300),
      referencia: phase3CleanText_(shipping.referencia, 300),
      zone: phase3CleanText_(shipping.zone, 40),
      mapLocation: location
        ? {
            lat: Number(location.lat),
            lng: Number(location.lng),
            name: phase3CleanText_(location.name, 120),
            address: phase3CleanText_(location.address, 240)
          }
        : null
    },
    payment: {
      method: phase3CleanText_(order.payment && order.payment.method, 40),
      status: phase3CleanText_(order.payment && order.payment.status, 40)
    },
    paymentStatus: phase3CleanText_(order.paymentStatus, 40),
    status: phase3CleanText_(order.status, 40),
    notes: phase3CleanText_(order.notes, 1000),
    notificationStatus: phase3CleanText_(order.notificationStatus, 40),
    createdAt: order.createdAt || '',
    updatedAt: order.updatedAt || ''
  };
}

function phase3EmailMatches_(left, right) {
  return String(left || '').trim().toLowerCase() ===
    String(right || '').trim().toLowerCase();
}

function phase3CanResend_(authContext, idToken) {
  if (phase3EmailMatches_(authContext.email, SUPER_ADMIN_EMAIL)) return { ok: true };

  const userResult = phase3FetchDocument_(
    'users/' + encodeURIComponent(authContext.uid),
    idToken
  );
  if (!userResult.ok) return { ok: false, error: 'resend_user_not_found' };

  const userData = userResult.data || {};
  if (userData.blocked === true) return { ok: false, error: 'blocked_account' };
  const role = String(userData.role || '').trim();
  if (role !== 'admin' && role !== 'agent') {
    return { ok: false, error: 'resend_role_not_allowed' };
  }

  const permissionResult = phase3FetchDocument_('rolePermissions/main', idToken);
  if (!permissionResult.ok) return { ok: false, error: 'resend_permission_unavailable' };
  const allowed = permissionResult.data &&
    permissionResult.data[role] &&
    permissionResult.data[role].pedidos &&
    permissionResult.data[role].pedidos.reenviarCorreo === true;
  return allowed
    ? { ok: true }
    : { ok: false, error: 'resend_permission_denied' };
}

/**
 * Carga el pedido real usando el token de quien hace la solicitud.
 * Firestore aplica además sus propias reglas durante esta lectura.
 */
function phase3LoadOrderContext_(orderId, idToken, isResend) {
  const authContext = verifyFirebaseIdToken_(idToken);
  if (!authContext.ok) return authContext;
  if (!authContext.emailVerified) {
    return { ok: false, error: 'email_not_verified' };
  }

  const normalizedId = String(orderId || '').trim();
  if (!normalizedId || normalizedId.length > 220 || normalizedId.indexOf('/') !== -1) {
    return { ok: false, error: 'invalid_order_id' };
  }

  const orderResult = phase3FetchDocument_(
    'orders/' + encodeURIComponent(normalizedId),
    idToken
  );
  if (!orderResult.ok) return orderResult;

  const originalOrder = orderResult.data || {};
  if (isResend) {
    const permission = phase3CanResend_(authContext, idToken);
    if (!permission.ok) return permission;
  } else {
    if (originalOrder.userId !== authContext.uid) {
      return { ok: false, error: 'order_owner_mismatch' };
    }
    if (!phase3EmailMatches_(originalOrder.userEmail, authContext.email)) {
      return { ok: false, error: 'order_email_mismatch' };
    }
    if (originalOrder.source !== 'spark-checkout-v1') {
      return { ok: false, error: 'invalid_order_source' };
    }
    if (normalizedId.indexOf(authContext.uid + '_') !== 0) {
      return { ok: false, error: 'invalid_order_id_owner' };
    }

    const createdMs = Date.parse(originalOrder.createdAt || '');
    if (!createdMs || Math.abs(Date.now() - createdMs) > ORIGINAL_ORDER_EMAIL_MAX_AGE_MS_) {
      return { ok: false, error: 'original_email_window_expired' };
    }
  }

  const order = phase3SanitizeOrder_(originalOrder);
  // La confirmación se manda al correo de contacto del pedido. La identidad
  // propietaria se comprobó antes contra userEmail, no contra este campo.
  order.userEmail = order.contactEmail || order.userEmail;

  return {
    ok: true,
    auth: authContext,
    order: order
  };
}

/**
 * Lee los tres interruptores mínimos desde settings/storeGate. No acepta que
 * el navegador decida qué correos se mandan.
 */
function phase3LoadEmailAccess_(idToken) {
  const result = phase3FetchDocument_('settings/storeGate', idToken);
  const access = result.ok && result.data && result.data.emailAccess
    ? result.data.emailAccess
    : {};
  return {
    orderEmailsEnabled: access.orderEmailsEnabled !== false,
    internalEmailEnabled: access.internalEmailEnabled !== false,
    customerEmailEnabled: access.customerEmailEnabled !== false
  };
}
