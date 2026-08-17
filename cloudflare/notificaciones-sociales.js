import {
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminMerge,
  getGoogleAccessToken,
} from './firebase-admin-ligero.js';

const MAX_TITLE = 180;
const MAX_BODY = 420;
const MAX_SNIPPET = 260;
const MAX_URL = 900;
const MAX_MARK_ALL_DOCUMENTS = 3000;
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

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
  if (/^(?:https?:|javascript:|data:|vbscript:|file:|\/\/)/i.test(url)) return '';
  if (!/^[A-Za-z0-9_./?=&%+#:-]+$/.test(url)) return '';
  return url;
}

function safeImageUrl(value) {
  const url = clean(value, 1200);
  if (!url) return '';
  if (/^(?:javascript:|data:|vbscript:|file:|\/\/)/i.test(url)) return '';
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  }
  return /^[A-Za-z0-9_./?=&%+#:-]+$/.test(url) ? url : '';
}

function normalizeDedupeKey(value) {
  let key = clean(value, 500);
  if (!key) return '';

  // Dar/quitar/dar Me gusta repetidamente no debe bombardear a la autora.
  // El estado del like sigue cambiando en tiempo real, pero la notificación
  // para el mismo actor/reseña se agrupa como máximo una vez por día UTC.
  const reviewLike = key.match(/^(review_like:[A-Za-z0-9_-]{1,180}:[A-Za-z0-9_-]{1,180}):(\d{10,})$/);
  if (reviewLike) {
    const timestamp = Number(reviewLike[2]);
    const day = Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    key = `${reviewLike[1]}:${day}`;
  }
  return key;
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
    actorPhotoUrl: safeImageUrl(event.actorPhotoUrl),
    title: clean(event.title, MAX_TITLE),
    body: clean(event.body, MAX_BODY),
    snippet: clean(event.snippet, MAX_SNIPPET),
    iconKey: clean(event.iconKey || 'bell', 40),
    targetUrl: safeTargetUrl(event.targetUrl),
    productId: clean(event.productId, 180),
    productName: clean(event.productName, 180),
    productImageUrl: safeImageUrl(event.productImageUrl),
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
  const key = normalizeDedupeKey(dedupeKey);
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
  const key = normalizeDedupeKey(dedupeKey);
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

function firestoreProjectId(env) {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no es un JSON válido');
  }
  const projectId = clean(serviceAccount?.project_id, 160);
  if (!/^[A-Za-z0-9_.:-]{2,160}$/.test(projectId)) throw new Error('Proyecto Firebase inválido');
  return projectId;
}

async function listNotificationPage(env, root, pageToken = '') {
  const projectId = firestoreProjectId(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${root}`);
  url.searchParams.set('pageSize', '300');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url.toString(), { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return { documents: [], nextPageToken: '' };
  if (!response.ok) throw new Error(`Firestore LIST de notificaciones falló (${response.status})`);
  const data = await response.json().catch(() => ({}));
  return {
    documents: Array.isArray(data.documents) ? data.documents : [],
    nextPageToken: clean(data.nextPageToken, 2000),
  };
}

export async function markAllNotificationsRead(env, { uid, admin = false, onUnread = null } = {}) {
  const root = admin ? 'adminNotifications' : `users/${safeId(uid, 'Cuenta')}/notifications`;
  let pageToken = '';
  let scanned = 0;
  let changed = 0;

  do {
    const page = await listNotificationPage(env, root, pageToken);
    const documents = page.documents;
    scanned += documents.length;
    const unread = documents.filter(document => document?.fields?.read?.booleanValue !== true);
    const timestampValue = new Date().toISOString();

    if (typeof onUnread === 'function' && unread.length) {
      await Promise.allSettled(unread.map(document => onUnread(document)));
    }

    for (let index = 0; index < unread.length; index += 20) {
      const writes = unread.slice(index, index + 20).map(document => {
        const path = String(document.name || '').split('/documents/').pop();
        return {
          path,
          fields: {
            ...(document.fields || {}),
            read: { booleanValue: true },
            updatedAt: { timestampValue },
          },
        };
      });
      if (writes.length) await firestoreAdminCommit(env, writes);
    }

    changed += unread.length;
    pageToken = scanned < MAX_MARK_ALL_DOCUMENTS ? page.nextPageToken : '';
  } while (pageToken);

  return changed;
}

export const socialNotificationClean = clean;
export const socialNotificationSafeId = safeId;
