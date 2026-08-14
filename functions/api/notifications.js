import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser, requireSuperAdmin,
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
  const name = clean(profile.name || profile.displayName || String(user.email || '').split('@')[0] || 'Nueva clienta', 160);
  const createdAt = profile.createdAt ? new Date(profile.createdAt) : new Date();

  const adminResult = await notifyAdminIfAbsent(env, {
    kind: 'user_joined', actorType: 'customer', actorUid: uid, actorName: name,
    title: `${name} se sumó a Tintin Accesorios`,
    body: 'Hay una nueva cuenta registrada en Tintin.',
    iconKey: 'user', targetUrl: 'admin.html#section-usuarios',
    sourceType: 'user', sourceId: uid, createdAt,
  }, `user_joined:${uid}`);

  await notifyUserIfAbsent(env, uid, {
    kind: 'welcome', actorType: 'store', actorName: 'Tintin Accesorios',
    title: 'Bienvenida a Tintin ✨',
    body: 'Tu cuenta ya está lista. Desde acá vas a recibir novedades de tus pedidos, respuestas y actividad relacionada con vos.',
    iconKey: 'sparkle', targetUrl: 'index.html', sourceType: 'user', sourceId: uid, createdAt,
  }, `welcome:${uid}`);

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
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
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
        const count = await markAllNotificationsRead(env, { admin: true, limit: 150 });
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
      const count = await markAllNotificationsRead(env, { uid: user.uid, limit: 150 });
      return jsonResponse({ ok: true, count }, 200, origin, request.url);
    }
    if (action === 'profileCreated') {
      const result = await registerProfileNotification(env, user);
      return jsonResponse({ ok: true, result }, 200, origin, request.url);
    }
    throw new Error('Acción no permitida');
  } catch (error) {
    const status = error?.code === 'version_conflict' ? 409 : 400;
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo completar la acción').slice(0, 300) }, status, origin, request.url);
  }
}
