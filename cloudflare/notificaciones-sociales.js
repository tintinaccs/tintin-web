import {
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminMerge,
} from './firebase-admin-ligero.js';

const MAX_TITLE = 180;
const MAX_BODY = 420;
const MAX_SNIPPET = 260;
const MAX_URL = 900;

const clean = (value, max = 180) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const safeId = (value, label = 'Identificador') => {
  const result = clean(value, 180);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(result)) throw new Error(`${label} inválido`);
  return result;
};

function safeTargetUrl(value) {
  const url = clean(value, MAX_URL);
  if (!url) return '';
  if (/^(?:https?:|javascript:|data:|\/\/)/i.test(url)) return '';
  if (!/^[A-Za-z0-9_./?=&%+#:-]+$/.test(url)) return '';
  return url;
}

async function hashId(seed) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(seed)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

function normalizeEvent(event = {}) {
  const now = event.createdAt instanceof Date ? event.createdAt : new Date();
  return {
    schemaVersion: 1,
    kind: clean(event.kind || 'activity', 60),
    actorType: ['customer', 'store', 'system'].includes(event.actorType) ? event.actorType : 'system',
    actorUid: clean(event.actorUid, 180),
    actorName: clean(event.actorName || 'Tintin', 160),
    title: clean(event.title, MAX_TITLE),
    body: clean(event.body, MAX_BODY),
    snippet: clean(event.snippet, MAX_SNIPPET),
    iconKey: clean(event.iconKey || 'bell', 40),
    targetUrl: safeTargetUrl(event.targetUrl),
    productId: clean(event.productId, 180),
    productName: clean(event.productName, 180),
    productImageUrl: clean(event.productImageUrl, 1200),
    reviewId: clean(event.reviewId, 180),
    orderId: clean(event.orderId, 220),
    orderNumber: clean(event.orderNumber, 80),
    status: clean(event.status, 80),
    sourceType: clean(event.sourceType, 60),
    sourceId: clean(event.sourceId, 220),
    read: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildUserNotificationWrite(recipientUid, event, dedupeKey) {
  const uid = safeId(recipientUid, 'Cuenta destinataria');
  const key = clean(dedupeKey, 500);
  if (!key) throw new Error('La notificación requiere clave de deduplicación');
  const notificationId = await hashId(`user:${uid}:${key}`);
  const record = {
    ...normalizeEvent(event),
    notificationId,
    audience: 'user',
    recipientUid: uid,
    dedupeKey: key,
  };
  return {
    id: notificationId,
    path: `users/${uid}/notifications/${notificationId}`,
    record,
    write: { path: `users/${uid}/notifications/${notificationId}`, fields: encodeFirestoreFields(record) },
  };
}

export async function buildAdminNotificationWrite(event, dedupeKey) {
  const key = clean(dedupeKey, 500);
  if (!key) throw new Error('La notificación requiere clave de deduplicación');
  const notificationId = await hashId(`admin:${key}`);
  const record = {
    ...normalizeEvent(event),
    notificationId,
    audience: 'admin',
    recipientUid: '',
    dedupeKey: key,
  };
  return {
    id: notificationId,
    path: `adminNotifications/${notificationId}`,
    record,
    write: { path: `adminNotifications/${notificationId}`, fields: encodeFirestoreFields(record) },
  };
}

async function persistIfAbsent(env, built) {
  const existing = await firestoreAdminGet(env, built.path);
  if (existing) return { created: false, id: built.id };
  try {
    await firestoreAdminCommit(env, [{ ...built.write, currentDocument: { exists: false } }]);
    return { created: true, id: built.id };
  } catch (error) {
    if (error?.code === 'version_conflict') return { created: false, id: built.id };
    throw error;
  }
}

export async function notifyUserIfAbsent(env, recipientUid, event, dedupeKey) {
  return persistIfAbsent(env, await buildUserNotificationWrite(recipientUid, event, dedupeKey));
}

export async function notifyAdminIfAbsent(env, event, dedupeKey) {
  return persistIfAbsent(env, await buildAdminNotificationWrite(event, dedupeKey));
}

export async function markNotificationRead(env, { uid, notificationId, admin = false }) {
  const id = safeId(notificationId, 'Notificación');
  const path = admin ? `adminNotifications/${id}` : `users/${safeId(uid, 'Cuenta')}/notifications/${id}`;
  const existing = await firestoreAdminGet(env, path);
  if (!existing) return false;
  await firestoreAdminMerge(env, path, encodeFirestoreFields({ read: true, updatedAt: new Date() }));
  return true;
}

export async function markAllNotificationsRead(env, { uid, admin = false, limit = 100 }) {
  const root = admin ? 'adminNotifications' : `users/${safeId(uid, 'Cuenta')}/notifications`;
  const documents = await firestoreAdminList(env, root, Math.max(1, Math.min(200, Number(limit) || 100)));
  const unread = documents.filter(document => document?.fields?.read?.booleanValue !== true);
  const fields = encodeFirestoreFields({ read: true, updatedAt: new Date() });

  for (let index = 0; index < unread.length; index += 10) {
    await Promise.all(unread.slice(index, index + 10).map(document => {
      const path = String(document.name || '').split('/documents/').pop();
      return firestoreAdminMerge(env, path, fields);
    }));
  }
  return unread.length;
}

export const socialNotificationClean = clean;
export const socialNotificationSafeId = safeId;
