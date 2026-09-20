import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser, requireSuperAdmin, statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, firestoreAdminGet, firestoreAdminMerge,
} from '../../cloudflare/firebase-admin-ligero.js';
import {
  markAllNotificationsRead,
  markNotificationRead,
  notifyAdminIfAbsent,
  notifyUserIfAbsent,
  socialNotificationClean as clean,
  socialNotificationSafeId as safeId,
} from '../../cloudflare/notificaciones-sociales.js';

const MAX_BODY_BYTES = 6 * 1024;
const PROFILE_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGIN_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function markSourceSeen(env, notification) {
  const sourceType = clean(notification?.sourceType, 60);
  const sourceId = clean(notification?.sourceId, 220);
  if (!sourceId) return;
  if (sourceType === 'review') {
    await firestoreAdminMerge(env, `reviewRecords/${safeId(sourceId, 'Reseña')}`, {
      unread: { booleanValue: false },
      updatedAt: { timestampValue: new Date().toISOString() },
    });
  } else if (sourceType === 'favorite') {
    await firestoreAdminMerge(env, `likeRecords/${safeId(sourceId, 'Me gusta')}`, {
      unread: { booleanValue: false },
      updatedAt: { timestampValue: new Date().toISOString() },
    });
  }
}

async function registerProfileNotification(env, user) {
  const uid = safeId(user.uid, 'Cuenta');
  const userDocument = await firestoreAdminGet(env, `users/${uid}`);
  if (!userDocument) throw new Error('El perfil todavía no existe');
  const profile = decodeFirestoreFields(userDocument.fields || {});
  const fullName = clean([profile.firstName, profile.lastName].filter(Boolean).join(' '), 160);
  const name = fullName || clean(profile.name || profile.displayName || String(user.email || '').split('@')[0] || 'Nueva clienta', 160);
  const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
  const createdAtMs = createdAt?.getTime?.();
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > PROFILE_RECOVERY_WINDOW_MS) {
    return { created: false, skipped: true, reason: 'existing_profile' };
  }

  const adminResult = await notifyAdminIfAbsent(env, {
    kind: 'user_joined', actorType: 'customer', actorUid: uid, actorName: name,
    actorPhotoUrl: profile.photoURL,
    title: `${name} se sumó a Tintin Accesorios`,
    body: 'Hay una nueva cuenta registrada en Tintin.',
    iconKey: 'user', targetUrl: 'admin.html#section-usuarios',
    sourceType: 'user', sourceId: uid, createdAt,
  }, `user_joined:${uid}`);

  return adminResult;
}

/**
 * Registra un inicio de sesión sin enviar identidad ni datos personales en el
 * push. El `auth_time` sólo viene del ID token verificado en el servidor: el
 * navegador no puede inventarlo y también funciona como deduplicación entre
 * reintentos, redirects de Google y recargas de la página de acceso.
 */
async function registerLoginNotification(env, user) {
  const authTimeSeconds = Math.trunc(Number(user?.claims?.auth_time) || 0);
  const authTimeMs = authTimeSeconds * 1000;
  if (!authTimeSeconds || !Number.isFinite(authTimeMs)) {
    return { created: false, skipped: true, reason: 'missing_auth_time' };
  }
  if (authTimeMs > Date.now() + 60 * 1000 || Date.now() - authTimeMs > LOGIN_ALERT_MAX_AGE_MS) {
    return { created: false, skipped: true, reason: 'stale_auth_time' };
  }

  const uid = safeId(user.uid, 'Cuenta');
  return notifyAdminIfAbsent(env, {
    kind: 'user_login',
    actorType: 'customer',
    actorUid: uid,
    // La campana interna puede conservar la cuenta de origen para auditoría,
    // pero el texto visible y el push quedan deliberadamente genéricos.
    actorName: 'Una cuenta',
    title: 'Inicio de sesión',
    body: 'Una cuenta ingresó a Tintin Accesorios.',
    iconKey: 'user',
    targetUrl: 'admin.html#section-usuarios',
    sourceType: 'auth',
    sourceId: uid,
    createdAt: new Date(authTimeMs),
  }, `user_login:${uid}:${authTimeSeconds}`);
}

async function registerOrderCreated(env, user, orderId) {
  const id = safeId(orderId, 'Pedido');
  const [document, userDocument] = await Promise.all([
    firestoreAdminGet(env, `orders/${id}`),
    firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}`),
  ]);
  if (!document) throw new Error('No se encontró el pedido');
  const order = decodeFirestoreFields(document.fields || {});
  if (clean(order.userId, 180) !== user.uid) throw new Error('El pedido no pertenece a esta cuenta');
  if (clean(order.userEmail, 254).toLowerCase() !== clean(user.email, 254).toLowerCase()) throw new Error('El correo del pedido no coincide con la cuenta');

  const profile = userDocument ? decodeFirestoreFields(userDocument.fields || {}) : {};
  const orderNumber = clean(order.orderNumber || order.shortId || id, 80);
  const customerName = clean(order.userName || String(user.email || '').split('@')[0] || 'Una clienta', 160);
  const total = Math.max(0, Math.round(Number(order.total) || 0));
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const totalText = total ? `${total.toLocaleString('es-PY')} Gs.` : 'Monto a confirmar.';

  // El push de "pedido creado" ya lo garantiza dispatchOrderPushEvent (webhook
  // firmado de Apps Script y, como respaldo, order-email.js), ambos con el
  // mismo eventId order.created:<orderId>. Este aviso solo escribe la campana
  // del panel; enviar push acá también duplicaría la notificación real.
  const adminResult = await notifyAdminIfAbsent(env, {
    kind: 'order_created', actorType: 'customer', actorUid: user.uid, actorName: customerName,
    actorPhotoUrl: profile.photoURL,
    title: `${customerName} realizó el pedido ${orderNumber}`,
    body: `Nuevo pedido por ${totalText}`,
    iconKey: 'order', targetUrl: 'admin.html#section-pedidos',
    orderId: id, orderNumber, status: clean(order.status || 'pendiente', 80),
    sourceType: 'order', sourceId: id, createdAt,
  }, `order_created:${id}`, { skipPush: true });

  await notifyUserIfAbsent(env, user.uid, {
    kind: 'order_created', actorType: 'store', actorName: 'Tintin Accesorios',
    title: `Recibimos tu pedido ${orderNumber}`,
    body: 'Tu pedido ya está registrado. Te vamos a avisar por acá cada cambio importante de estado.',
    iconKey: 'order', targetUrl: `perfil.html#pedido-${encodeURIComponent(id)}`,
    orderId: id, orderNumber, status: clean(order.status || 'pendiente', 80),
    sourceType: 'order', sourceId: id, createdAt,
  }, `order_created:${id}`);

  return adminResult;
}

async function notifyOrderStatus(env, actor, orderId) {
  const id = safeId(orderId, 'Pedido');
  const document = await firestoreAdminGet(env, `orders/${id}`);
  if (!document) throw new Error('No se encontró el pedido');
  const order = decodeFirestoreFields(document.fields || {});
  const uid = clean(order.userId, 180);
  if (!uid) return { skipped: true, reason: 'order_without_account' };
  safeId(uid, 'Cuenta del pedido');
  const orderNumber = clean(order.orderNumber || order.shortId || id, 80);
  const status = clean(order.status || 'actualizado', 80);
  const paymentStatus = clean(order.paymentStatus || order.payment?.status, 80);
  const revision = Number(order.inventoryRevision || 0);

  // El primer estado reservado/pendiente pertenece a la creación y ya tiene
  // su propia notificación "Recibimos tu pedido". Esto permite revalidar
  // pedidos recientes al abrir Super Admin sin generar una segunda alerta.
  if (revision <= 1 && ['pendiente', 'inventory_pending'].includes(status) && (!paymentStatus || paymentStatus === 'pendiente')) {
    return { skipped: true, reason: 'initial_order_state' };
  }

  const statusLabel = status.replace(/_/g, ' ');
  return notifyUserIfAbsent(env, uid, {
    kind: 'order_status', actorType: 'store', actorUid: actor.uid, actorName: 'Tintin Accesorios',
    title: `Tu pedido ${orderNumber} fue actualizado`,
    body: `Estado: ${statusLabel}${paymentStatus ? ` · Pago: ${paymentStatus.replace(/_/g, ' ')}` : ''}.`,
    iconKey: 'order', targetUrl: `perfil.html#pedido-${encodeURIComponent(id)}`,
    orderId: id, orderNumber, status, sourceType: 'order', sourceId: id,
  }, `order_status:${id}:${revision}:${status}:${paymentStatus}`);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, POST, OPTIONS');
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    // Sonda privada, estrictamente de lectura. Comprueba Firebase Auth y el
    // acceso server-side a la colección propia sin devolver ni cambiar una
    // notificación; se usa desde Flujo de conexiones.
    if (request.method === 'GET') {
      const user = await requireFirebaseUser(request);
      const action = new URL(request.url).searchParams.get('action');
      if (action !== 'health') throw Object.assign(new Error('Acción no permitida'), { status: 400 });
      await firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}/notifications/__tfc_health_probe__`);
      return jsonResponse({ ok: true, mode: 'read_only' }, 200, origin, request.url);
    }
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const input = JSON.parse(raw);
    const action = clean(input.action, 80);

    if (action.startsWith('admin')) {
      const actor = await requireSuperAdmin(request);
      if (action === 'adminNotificationSeen') {
        const id = safeId(input.notificationId, 'Notificación');
        const document = await firestoreAdminGet(env, `adminNotifications/${id}`);
        if (document) {
          const notification = decodeFirestoreFields(document.fields || {});
          await markNotificationRead(env, { notificationId: id, admin: true });
          await markSourceSeen(env, notification);
        }
        return jsonResponse({ ok: true }, 200, origin, request.url);
      }
      if (action === 'adminNotificationsSeenAll') {
        const count = await markAllNotificationsRead(env, {
          admin: true,
          onUnread: document => markSourceSeen(env, decodeFirestoreFields(document.fields || {})),
        });
        return jsonResponse({ ok: true, count }, 200, origin, request.url);
      }
      if (action === 'adminOrderStatusChanged') {
        const result = await notifyOrderStatus(env, actor, input.orderId);
        return jsonResponse({ ok: true, result }, 200, origin, request.url);
      }
      throw new Error('Acción administrativa no permitida');
    }

    const user = await requireFirebaseUser(request);
    if (action === 'notificationSeen') {
      await markNotificationRead(env, { uid: user.uid, notificationId: input.notificationId });
      return jsonResponse({ ok: true }, 200, origin, request.url);
    }
    if (action === 'notificationsSeenAll') {
      const count = await markAllNotificationsRead(env, { uid: user.uid });
      return jsonResponse({ ok: true, count }, 200, origin, request.url);
    }
    if (action === 'profileCreated') {
      const result = await registerProfileNotification(env, user);
      return jsonResponse({ ok: true, result }, 200, origin, request.url);
    }
    if (action === 'loginObserved') {
      const result = await registerLoginNotification(env, user);
      return jsonResponse({ ok: true, result }, 200, origin, request.url);
    }
    if (action === 'orderCreated') {
      const result = await registerOrderCreated(env, user, input.orderId);
      return jsonResponse({ ok: true, result }, 200, origin, request.url);
    }
    throw new Error('Acción no permitida');
  } catch (error) {
    const status = statusFromError(error, error?.code === 'version_conflict' ? 409 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) }, status, origin, request.url);
  }
}
