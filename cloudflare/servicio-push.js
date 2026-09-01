// =============================================================
// TINTIN — Envío de Web Push desde Cloudflare Pages Functions
// =============================================================
// Corre sólo en el runtime de Cloudflare. Usa la API HTTP v1 de Firebase
// Cloud Messaging con un access token OAuth 2.0 de corta duración firmado
// por la cuenta de servicio (cloudflare/firebase-admin-ligero.js, que ya
// hacía exactamente eso para el login por código). No se usa la API
// heredada de FCM ni ninguna server key: sólo HTTP v1 + Web Crypto.
//
// Nada de este archivo llega al navegador y nada de acá se registra con
// tokens, claves ni datos personales adentro.

import { getGoogleAccessToken, parseServiceAccount } from './firebase-admin-ligero.js';
import {
  PUSH_DEVICES_COLLECTION,
  PUSH_EVENTS_COLLECTION,
  buildFcmMessage,
  buildPushContent,
  buildTestPushContent,
  classifyFcmError,
  cleanText,
  deviceDocumentId,
  eventDocumentId,
  sanitizeError,
  tokenFingerprint
} from './nucleo-push.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const PROCESSING_TAKEOVER_MS = 60 * 1000;
const MAX_EVENT_ATTEMPTS = 5;
const MAX_DEVICES_PER_SEND = 20;
const PUSH_SETTINGS_PATH = 'pushSettings/global';

export function pushEnabled(env) {
  const flag = cleanText(env?.TINTIN_PUSH_ENABLED, 10).toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'on';
}

function documentsUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function firestoreFetch(env, path, init = {}) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(`${documentsUrl(sa.project_id)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// --- Codificación mínima de valores Firestore ------------------------------

const fsString = value => ({ stringValue: String(value) });
const fsBool = value => ({ booleanValue: Boolean(value) });
const fsInt = value => ({ integerValue: String(Math.trunc(Number(value) || 0)) });
const fsTime = date => ({ timestampValue: (date instanceof Date ? date : new Date(date)).toISOString() });

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

// --- Lecturas y escrituras usadas por el sistema de push -------------------

export async function readOrder(env, orderId) {
  const result = await firestoreFetch(env, `/orders/${encodeURIComponent(orderId)}`);
  if (result.status === 404) return null;
  if (!result.ok) throw new Error('No se pudo leer el pedido.');
  return decodeFields(result.data.fields || {});
}

async function patchDocument(env, path, fields) {
  const mask = Object.keys(fields)
    .map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');
  const result = await firestoreFetch(env, `/${path}?${mask}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields })
  });
  if (!result.ok) throw new Error(`No se pudo guardar ${path.split('/')[0]}.`);
  return decodeFields(result.data.fields || {});
}

async function getDocument(env, path) {
  const result = await firestoreFetch(env, `/${path}`);
  if (result.status === 404) return null;
  if (!result.ok) throw new Error(`No se pudo leer ${path.split('/')[0]}.`);
  return decodeFields(result.data.fields || {});
}

/** Crea el documento sólo si todavía no existe (precondición del servidor). */
async function createDocumentIfAbsent(env, path, fields) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(`${documentsUrl(sa.project_id)}:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: { name: `projects/${sa.project_id}/databases/(default)/documents/${path}`, fields },
        currentDocument: { exists: false }
      }]
    })
  });
  if (response.ok) return { created: true };
  const data = await response.json().catch(() => ({}));
  const status = cleanText(data?.error?.status, 40).toUpperCase();
  if (response.status === 409 || status === 'ALREADY_EXISTS' || status === 'FAILED_PRECONDITION') {
    return { created: false };
  }
  throw new Error('No se pudo registrar el evento de notificación.');
}

async function runQuery(env, structuredQuery) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const response = await fetch(`${documentsUrl(sa.project_id)}:runQuery`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  });
  if (!response.ok) throw new Error('No se pudieron leer los dispositivos registrados.');
  const rows = await response.json().catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row?.document)
    .map(row => ({
      id: String(row.document.name).split('/').pop(),
      ...decodeFields(row.document.fields || {})
    }));
}

// --- Dispositivos ----------------------------------------------------------

export async function listActiveDevices(env) {
  const devices = await runQuery(env, {
    from: [{ collectionId: PUSH_DEVICES_COLLECTION }],
    where: {
      fieldFilter: { field: { fieldPath: 'enabled' }, op: 'EQUAL', value: { booleanValue: true } }
    },
    limit: MAX_DEVICES_PER_SEND
  });
  return devices.filter(device => cleanText(device.token, 400).length > 20);
}

/** Lectura administrativa: nunca se expone el token completo al navegador. */
export async function listAdminDevices(env) {
  const devices = await runQuery(env, {
    from: [{ collectionId: PUSH_DEVICES_COLLECTION }],
    limit: 100
  });
  return devices
    .map(device => ({
      id: cleanText(device.id, 140),
      deviceId: cleanText(device.deviceId, 64),
      deviceLabel: cleanText(device.deviceLabel, 60) || 'Dispositivo de Tintin',
      platform: cleanText(device.platform, 20) || 'otro',
      email: cleanText(device.email, 160),
      uid: cleanText(device.uid, 160),
      enabled: device.enabled === true,
      tokenPreview: device.token ? `${String(device.token).slice(0, 6)}…${String(device.token).slice(-4)}` : '',
      updatedAt: cleanText(device.updatedAt, 40),
      lastSeenAt: cleanText(device.lastSeenAt, 40),
      disabledReason: cleanText(device.disabledReason, 80)
    }))
    .sort((a, b) => String(b.lastSeenAt || b.updatedAt).localeCompare(String(a.lastSeenAt || a.updatedAt)));
}

export async function readPushSettings(env) {
  const existing = await getDocument(env, PUSH_SETTINGS_PATH);
  return {
    enabled: existing?.enabled !== false,
    foregroundSound: ['default', 'none', 'custom'].includes(existing?.foregroundSound) ? existing.foregroundSound : 'default',
    foregroundSoundUrl: cleanText(existing?.foregroundSoundUrl, 500),
    foregroundSoundOrder: ['default', 'none', 'custom'].includes(existing?.foregroundSoundOrder) ? existing.foregroundSoundOrder : 'default',
    foregroundSoundOrderUrl: cleanText(existing?.foregroundSoundOrderUrl, 500),
    foregroundSoundReview: ['default', 'none', 'custom'].includes(existing?.foregroundSoundReview) ? existing.foregroundSoundReview : 'default',
    foregroundSoundReviewUrl: cleanText(existing?.foregroundSoundReviewUrl, 500),
    foregroundSoundLike: ['default', 'none', 'custom'].includes(existing?.foregroundSoundLike) ? existing.foregroundSoundLike : 'default',
    foregroundSoundLikeUrl: cleanText(existing?.foregroundSoundLikeUrl, 500),
    updatedAt: cleanText(existing?.updatedAt, 40),
    updatedBy: cleanText(existing?.updatedBy, 160)
  };
}

export async function savePushSettings(env, { enabled, foregroundSound, foregroundSoundUrl, foregroundSoundOrder, foregroundSoundOrderUrl, foregroundSoundReview, foregroundSoundReviewUrl, foregroundSoundLike, foregroundSoundLikeUrl, updatedBy }) {
  const mode = ['default', 'none', 'custom'].includes(foregroundSound) ? foregroundSound : 'default';
  const url = mode === 'custom' && /^https:\/\//i.test(String(foregroundSoundUrl || '').trim())
    ? cleanText(foregroundSoundUrl, 500)
    : '';
  const tone = value => ['default', 'none', 'custom'].includes(value) ? value : 'default';
  const toneUrl = (value, valueUrl) => tone(value) === 'custom' && /^https:\/\//i.test(String(valueUrl || '').trim()) ? cleanText(valueUrl, 500) : '';
  const now = new Date();
  await patchDocument(env, PUSH_SETTINGS_PATH, {
    enabled: fsBool(enabled !== false),
    foregroundSound: fsString(mode),
    foregroundSoundUrl: fsString(url),
    foregroundSoundOrder: fsString(tone(foregroundSoundOrder)),
    foregroundSoundOrderUrl: fsString(toneUrl(foregroundSoundOrder, foregroundSoundOrderUrl)),
    foregroundSoundReview: fsString(tone(foregroundSoundReview)),
    foregroundSoundReviewUrl: fsString(toneUrl(foregroundSoundReview, foregroundSoundReviewUrl)),
    foregroundSoundLike: fsString(tone(foregroundSoundLike)),
    foregroundSoundLikeUrl: fsString(toneUrl(foregroundSoundLike, foregroundSoundLikeUrl)),
    updatedAt: fsTime(now),
    updatedBy: fsString(cleanText(updatedBy, 160))
  });
  return readPushSettings(env);
}

function soundForType(settings, type) {
  const prefix = String(type || '').startsWith('social.review') ? 'Review'
    : String(type || '').startsWith('social.like') ? 'Like'
      : String(type || '').startsWith('admin.') ? 'Review' : 'Order';
  const mode = settings[`foregroundSound${prefix}`] || settings.foregroundSound || 'default';
  const url = settings[`foregroundSound${prefix}Url`] || (prefix === 'Order' ? settings.foregroundSoundUrl : '');
  return { mode, url };
}

export async function dispatchSocialPushEvent(env, { type, eventId, title, body, url = '/admin.html?section=notificaciones-push' }) {
  if (!pushEnabled(env)) return { ok: true, skipped: 'disabled' };
  const settings = await readPushSettings(env);
  if (!settings.enabled) return { ok: true, skipped: 'paused_by_superadmin' };
  const id = cleanText(eventId, 260) || `${type}:${crypto.randomUUID()}`;
  const claim = await claimEvent(env, { eventId: id, type, orderId: '' });
  if (!claim.claimed) return { ok: true, duplicate: Boolean(claim.duplicate), skipped: claim.inProgress ? 'in_progress' : undefined };
  const sound = soundForType(settings, type);
  const content = { title: cleanText(title, 100), body: cleanText(body, 220), foregroundSound: sound.mode, data: { type: cleanText(type, 40), orderId: '', shortId: '', url, eventId: id, tag: id, title: cleanText(title, 100), body: cleanText(body, 220), foregroundSoundUrl: sound.url } };
  const devices = await listActiveDevices(env);
  const result = devices.length ? await sendToDevices(env, devices, content) : { attempted: 0, successCount: 0, failureCount: 0, disabledCount: 0, lastError: '' };
  const status = await closeEvent(env, claim.path, result);
  return { ok: status === 'sent' || status === 'partial' || status === 'no_devices', status, attempted: result.attempted, successCount: result.successCount, failureCount: result.failureCount };
}

export async function revokeDeviceByDocumentId(env, deviceDocId, reason = 'revocado_por_superadmin') {
  const safeId = cleanText(deviceDocId, 140);
  if (!/^[A-Za-z0-9_-]{16,160}$/.test(safeId)) throw new Error('Identificador de dispositivo inválido.');
  const existing = await getDocument(env, `${PUSH_DEVICES_COLLECTION}/${safeId}`);
  if (!existing) return { found: false };
  await disableDeviceById(env, safeId, reason);
  await patchDocument(env, `${PUSH_DEVICES_COLLECTION}/${safeId}`, { token: fsString('') });
  return { found: true };
}

export async function revokeAllDevices(env, reason = 'revocado_por_superadmin') {
  const devices = await listAdminDevices(env);
  let count = 0;
  for (const device of devices.filter(item => item.enabled)) {
    await revokeDeviceByDocumentId(env, device.id, reason);
    count += 1;
  }
  return { count };
}

export async function findDeviceByToken(env, token) {
  const devices = await runQuery(env, {
    from: [{ collectionId: PUSH_DEVICES_COLLECTION }],
    where: {
      fieldFilter: { field: { fieldPath: 'token' }, op: 'EQUAL', value: { stringValue: String(token) } }
    },
    limit: 5
  });
  return devices;
}

export async function registerDevice(env, { uid, email, deviceId, deviceLabel, token, platform, userAgent }) {
  const docId = await deviceDocumentId(uid, deviceId);
  const now = new Date();
  const existing = await getDocument(env, `${PUSH_DEVICES_COLLECTION}/${docId}`);

  // Si Firebase entregó un token nuevo para el mismo dispositivo, cualquier
  // otro documento que todavía guarde ese token queda inactivo: así el mismo
  // celular no recibe dos veces el mismo aviso.
  const duplicates = await findDeviceByToken(env, token);
  for (const duplicate of duplicates) {
    if (duplicate.id === docId) continue;
    await patchDocument(env, `${PUSH_DEVICES_COLLECTION}/${duplicate.id}`, {
      enabled: fsBool(false),
      disabledReason: fsString('token_reasignado'),
      disabledAt: fsTime(now),
      updatedAt: fsTime(now)
    });
  }

  const fields = {
    token: fsString(token),
    uid: fsString(uid),
    email: fsString(email),
    deviceId: fsString(deviceId),
    deviceLabel: fsString(deviceLabel),
    platform: fsString(platform),
    userAgent: fsString(userAgent),
    enabled: fsBool(true),
    disabledReason: fsString(''),
    updatedAt: fsTime(now),
    lastSeenAt: fsTime(now),
    createdAt: fsTime(existing?.createdAt ? new Date(existing.createdAt) : now)
  };
  await patchDocument(env, `${PUSH_DEVICES_COLLECTION}/${docId}`, fields);
  return { deviceDocId: docId, tokenPreview: await tokenFingerprint(token) };
}

export async function unregisterDevice(env, { uid, deviceId }) {
  const docId = await deviceDocumentId(uid, deviceId);
  const existing = await getDocument(env, `${PUSH_DEVICES_COLLECTION}/${docId}`);
  if (!existing) return { found: false };
  const now = new Date();
  await patchDocument(env, `${PUSH_DEVICES_COLLECTION}/${docId}`, {
    enabled: fsBool(false),
    token: fsString(''),
    disabledReason: fsString('desactivado_por_la_administradora'),
    disabledAt: fsTime(now),
    updatedAt: fsTime(now)
  });
  return { found: true };
}

export async function deviceStatus(env, { uid, deviceId }) {
  const docId = await deviceDocumentId(uid, deviceId);
  const existing = await getDocument(env, `${PUSH_DEVICES_COLLECTION}/${docId}`);
  if (!existing) return { registered: false };
  return {
    registered: existing.enabled === true,
    deviceLabel: cleanText(existing.deviceLabel, 60),
    platform: cleanText(existing.platform, 40),
    updatedAt: cleanText(existing.updatedAt, 40),
    lastSeenAt: cleanText(existing.lastSeenAt, 40)
  };
}

async function disableDeviceById(env, deviceDocId, reason) {
  const now = new Date();
  await patchDocument(env, `${PUSH_DEVICES_COLLECTION}/${deviceDocId}`, {
    enabled: fsBool(false),
    disabledReason: fsString(cleanText(reason, 60)),
    disabledAt: fsTime(now),
    updatedAt: fsTime(now)
  }).catch(() => {});
}

// --- Envío a FCM -----------------------------------------------------------

async function sendToDevice(env, device, content) {
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FCM_SCOPE]);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(buildFcmMessage({ token: device.token, content }))
    }
  );
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => ({}));
  return { ok: false, ...classifyFcmError(response.status, payload) };
}

/** Envía a una lista de dispositivos y limpia los tokens definitivamente muertos. */
export async function sendToDevices(env, devices, content) {
  let successCount = 0;
  let failureCount = 0;
  let disabledCount = 0;
  let lastError = '';

  for (const device of devices) {
    let result;
    try {
      result = await sendToDevice(env, device, content);
    } catch (error) {
      result = { ok: false, permanent: false, reason: sanitizeError(error, 80) };
    }
    if (result.ok) {
      successCount += 1;
      continue;
    }
    failureCount += 1;
    lastError = cleanText(result.reason, 80);
    if (result.permanent) {
      await disableDeviceById(env, device.id, result.reason);
      disabledCount += 1;
    }
  }

  return { attempted: devices.length, successCount, failureCount, disabledCount, lastError };
}

// --- Idempotencia ----------------------------------------------------------

function eventStatusFrom(result) {
  if (!result.attempted) return 'no_devices';
  if (result.successCount && !result.failureCount) return 'sent';
  if (result.successCount && result.failureCount) return 'partial';
  return 'failed';
}

/**
 * Reserva el evento para esta ejecución. Devuelve `{claimed:false}` cuando ya
 * fue enviado (duplicado) o cuando otra ejecución lo tomó hace pocos segundos.
 */
async function claimEvent(env, { eventId, type, orderId }) {
  const docId = await eventDocumentId(eventId);
  const path = `${PUSH_EVENTS_COLLECTION}/${docId}`;
  const now = new Date();
  const baseFields = {
    eventId: fsString(eventId),
    type: fsString(type),
    orderId: fsString(orderId),
    status: fsString('processing'),
    attempts: fsInt(1),
    createdAt: fsTime(now),
    updatedAt: fsTime(now),
    successCount: fsInt(0),
    failureCount: fsInt(0),
    lastError: fsString('')
  };

  const created = await createDocumentIfAbsent(env, path, baseFields);
  if (created.created) return { claimed: true, path, attempts: 1 };

  const existing = await getDocument(env, path);
  if (!existing) return { claimed: true, path, attempts: 1 };

  if (existing.status === 'sent') return { claimed: false, duplicate: true, path };

  const attempts = Number(existing.attempts) || 0;
  const updatedAtMs = Date.parse(existing.updatedAt || '') || 0;
  const stale = Date.now() - updatedAtMs > PROCESSING_TAKEOVER_MS;
  if (existing.status === 'processing' && !stale) {
    return { claimed: false, inProgress: true, path };
  }
  if (attempts >= MAX_EVENT_ATTEMPTS) {
    return { claimed: false, exhausted: true, path };
  }

  await patchDocument(env, path, {
    status: fsString('processing'),
    attempts: fsInt(attempts + 1),
    updatedAt: fsTime(now)
  });
  return { claimed: true, path, attempts: attempts + 1 };
}

async function closeEvent(env, path, result) {
  const now = new Date();
  const status = eventStatusFrom(result);
  await patchDocument(env, path, {
    status: fsString(status),
    updatedAt: fsTime(now),
    sentAt: fsTime(now),
    successCount: fsInt(result.successCount),
    failureCount: fsInt(result.failureCount),
    lastError: fsString(cleanText(result.lastError, 200))
  }).catch(() => {});
  return status;
}

/**
 * Punto de entrada server-side reutilizable. Lo llaman el webhook firmado de
 * Apps Script y, como respaldo, functions/api/order-email.js — siempre con el
 * mismo eventId (`order.created:<orderId>`), así que el segundo camino no
 * genera un segundo aviso.
 *
 * Cuando se agregue PayPal, la verificación server-side de su webhook oficial
 * podrá llamar a esta misma función con type 'payment.completed' y un
 * externalEventId que incluya el capture ID.
 */
export async function dispatchOrderPushEvent(env, type, orderId, externalEventId) {
  if (!pushEnabled(env)) return { ok: true, skipped: 'disabled' };
  const settings = await readPushSettings(env);
  if (!settings.enabled) return { ok: true, skipped: 'paused_by_superadmin' };

  const eventId = cleanText(externalEventId, 260) || `${type}:${orderId}`;
  const order = await readOrder(env, orderId);
  if (!order) return { ok: false, error: 'order_not_found' };

  const claim = await claimEvent(env, { eventId, type, orderId });
  if (!claim.claimed) {
    if (claim.duplicate) return { ok: true, duplicate: true };
    if (claim.inProgress) return { ok: true, skipped: 'in_progress' };
    return { ok: false, error: 'attempts_exhausted' };
  }

  const devices = await listActiveDevices(env);
  const sound = soundForType(settings, type);
  const content = buildPushContent({ type, orderId, order, eventId, foregroundSound: sound.mode, foregroundSoundUrl: sound.url });
  const result = devices.length
    ? await sendToDevices(env, devices, content)
    : { attempted: 0, successCount: 0, failureCount: 0, disabledCount: 0, lastError: '' };
  const status = await closeEvent(env, claim.path, result);
  return {
    ok: status === 'sent' || status === 'partial' || status === 'no_devices',
    duplicate: false,
    status,
    attempted: result.attempted,
    successCount: result.successCount,
    failureCount: result.failureCount,
    disabledCount: result.disabledCount
  };
}

/** Notificación de prueba: contenido fijo del servidor y eventId siempre único. */
export async function sendTestPush(env, { onlyToken }) {
  if (!pushEnabled(env)) return { ok: false, error: 'push_disabled' };
  const settings = await readPushSettings(env);
  if (!settings.enabled) return { ok: false, error: 'push_paused_by_superadmin' };
  const eventId = `push.test:${crypto.randomUUID()}`;
  const sound = soundForType(settings, 'order.created');
  const content = buildTestPushContent(eventId, sound.mode, sound.url);
  const active = await listActiveDevices(env);
  const devices = onlyToken ? active.filter(device => device.token === onlyToken) : active;
  if (!devices.length) return { ok: false, error: 'no_devices', attempted: 0 };
  const result = await sendToDevices(env, devices, content);
  // Una prueba sólo se considera exitosa si FCM llegó a por lo menos un
  // dispositivo activo.
  return { ok: result.successCount > 0, ...result, lastError: undefined };
}
