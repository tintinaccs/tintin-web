import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { fetchAppsScript } from './apps-script-fetch.js';
import { decodeFirestoreFields, firestoreAdminGet } from './firebase-admin-ligero.js';

function clean(value, max = 800) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function errorMessage(error) {
  return clean(error?.message || error || 'Error desconocido', 800);
}

function asIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function buildUserSheetRecord(uid, raw = {}) {
  const user = raw && typeof raw === 'object' ? raw : {};
  const checkoutDefaults = user.checkoutDefaults && typeof user.checkoutDefaults === 'object' ? user.checkoutDefaults : {};
  const savedLocation = user.savedLocation && typeof user.savedLocation === 'object' ? user.savedLocation : {};
  const invoice = user.invoice && typeof user.invoice === 'object' ? user.invoice : {};
  return {
    uid: clean(uid, 220),
    name: clean(user.name || user.displayName, 180),
    firstName: clean(user.firstName, 80),
    lastName: clean(user.lastName, 120),
    username: clean(user.username, 40),
    customerId: clean(user.customerId, 220),
    email: clean(user.email, 320),
    phone: clean(user.phone, 80),
    ci: clean(user.ci || checkoutDefaults.ci, 40),
    orders: Number(user.ordersCount || user.orders || user.purchaseCount || 0),
    totalSpent: Number(user.totalSpent || 0),
    role: clean(user.role || 'client', 40),
    blocked: user.blocked === true,
    profileStatus: clean(user.profileStatus, 60),
    usernameChangeUsed: user.usernameChangeUsed === true || Boolean(user.usernameChangedAt),
    internalNotes: clean(user.internalNotes, 2000),
    createdAt: asIso(user.createdAt || user.registeredAt),
    lastAccess: asIso(user.lastAccess || user.lastLoginAt || user.lastLogin),
    lastChangeId: clean(user.lastChangeId, 220),
    dob: asIso(user.dob || user.birthDate),
    address: clean(user.address || savedLocation.address, 500),
    locationName: clean(savedLocation.name, 180),
    addressLat: Number.isFinite(Number(savedLocation.lat)) ? Number(savedLocation.lat) : '',
    addressLng: Number.isFinite(Number(savedLocation.lng)) ? Number(savedLocation.lng) : '',
    departamento: clean(user.departamento || checkoutDefaults.departamento, 120),
    city: clean(user.city || checkoutDefaults.city, 160),
    reference: clean(user.reference || user.referencia || checkoutDefaults.reference || checkoutDefaults.referencia, 500),
    invoiceWanted: invoice.wanted === true || user.wantsInvoice === true,
    razonSocial: clean(invoice.razonSocial || user.razonSocial, 220),
    ruc: clean(invoice.ruc || user.ruc, 80),
    updatedAt: asIso(user.updatedAt),
  };
}

export function buildAuditSheetRecord(eventId, raw = {}) {
  const record = raw && typeof raw === 'object' ? raw : {};
  return {
    eventId: clean(eventId, 220),
    timestamp: asIso(record.createdAt || record.timestamp),
    customerId: clean(record.customerId, 220),
    actorId: clean(record.actorId || record.actorUid, 220),
    actorEmail: clean(record.actorEmail, 320),
    actorRole: clean(record.actorRole, 80),
    action: clean(record.action, 160),
    entityType: clean(record.entityType || record.entity, 120),
    entityId: clean(record.entityId || record.targetId, 220),
    before: record.before ?? null,
    after: record.after ?? null,
    origin: clean(record.origin || record.source || record.syncOrigin, 220),
    result: clean(record.result || record.details || record.reason || record.message, 2000),
    changeId: clean(record.changeId || record.lastChangeId, 220),
  };
}

async function postMirror(env, action, payload, fetchImpl) {
  const secret = clean(env?.SHEETS_ENGAGEMENT_SECRET, 500);
  if (!secret) return { ok: false, deferred: true, reason: 'missing_sheets_secret' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHEETS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action, secret, ...payload }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) throw new Error(body?.error || `Apps Script respondió ${response.status}.`);
    return { ok: true, deferred: false, row: Number(body.row || 0) || null };
  } catch (error) {
    console.warn(`[Tintin Mirrors] ${action} diferido; el reconciliador lo recuperará.`, error);
    return { ok: false, deferred: true, error: errorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncUserToSheetsBestEffort(env, uid, fetchImpl = fetchAppsScript) {
  const safeUid = clean(uid, 220);
  if (!safeUid) return { ok: false, deferred: true, reason: 'missing_uid' };
  try {
    const document = await firestoreAdminGet(env, `users/${encodeURIComponent(safeUid)}`);
    if (!document) return { ok: false, deferred: true, reason: 'missing_user' };
    const user = buildUserSheetRecord(safeUid, decodeFirestoreFields(document.fields || {}));
    return await postMirror(env, 'syncUser', { user }, fetchImpl);
  } catch (error) {
    console.warn('[Tintin Mirrors] No se pudo preparar el push inmediato del usuario.', error);
    return { ok: false, deferred: true, error: errorMessage(error) };
  }
}

export async function syncAuditToSheetsBestEffort(env, eventId, fetchImpl = fetchAppsScript) {
  const safeEventId = clean(eventId, 220);
  if (!safeEventId) return { ok: false, deferred: true, reason: 'missing_event_id' };
  try {
    const document = await firestoreAdminGet(env, `auditLog/${encodeURIComponent(safeEventId)}`);
    if (!document) return { ok: false, deferred: true, reason: 'missing_audit_event' };
    const audit = buildAuditSheetRecord(safeEventId, decodeFirestoreFields(document.fields || {}));
    return await postMirror(env, 'syncAudit', { audit }, fetchImpl);
  } catch (error) {
    console.warn('[Tintin Mirrors] No se pudo preparar el push inmediato de auditoría.', error);
    return { ok: false, deferred: true, error: errorMessage(error) };
  }
}
