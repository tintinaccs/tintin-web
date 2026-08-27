import { SUPERADMIN_EMAIL } from './seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminDelete,
  firestoreAdminGet,
  setFirebaseUserDisabled,
  fsBoolean,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ACTIONS = new Set(['softDelete', 'reactivate']);

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function makeEventId() {
  return `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
}

function lifecyclePatch(action, user, actorEmail, now, changeId, origin) {
  if (action === 'reactivate') {
    return {
      blocked: fsBoolean(false),
      deleted: fsBoolean(false),
      deletedAt: { nullValue: null },
      deletedBy: fsString(''),
      blockReason: fsString(''),
      role: fsString('client'),
      roleBeforeBlock: fsString(''),
      profileStatus: fsString(user.username && user.birthDate ? 'active' : 'incomplete'),
      lastChangeId: fsString(changeId),
      syncOrigin: fsString(origin),
      updatedAt: fsTimestamp(now),
    };
  }
  return {
    blocked: fsBoolean(true),
    deleted: fsBoolean(true),
    deletedAt: fsTimestamp(now),
    deletedBy: fsString(actorEmail),
    blockReason: fsString('Cuenta eliminada mediante tombstone histórico'),
    roleBeforeBlock: fsString(user.role && user.role !== 'client' ? user.role : ''),
    role: fsString('client'),
    phone: fsString(''),
    profileStatus: fsString('deleted'),
    lastChangeId: fsString(changeId),
    syncOrigin: fsString(origin),
    updatedAt: fsTimestamp(now),
  };
}

export async function applyUserLifecycle(env, options = {}) {
  const uid = clean(options.uid, 128);
  const action = clean(options.action || 'softDelete', 30);
  const actorEmail = clean(options.actorEmail || 'system', 254).toLowerCase();
  const actorId = clean(options.actorId || actorEmail || 'system', 128);
  const actorRole = clean(options.actorRole || 'system', 40);
  const reason = clean(options.reason, 500);
  const origin = clean(options.origin || 'system', 120);
  const requestedChangeId = clean(options.changeId, 120);
  const changeId = requestedChangeId || makeEventId();
  const baseChangeId = clean(options.baseChangeId, 120);

  if (!UID_PATTERN.test(uid) || !ACTIONS.has(action)) throw new Error('Usuario o acción inválidos.');

  const userDoc = await firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`);
  if (!userDoc) throw new Error('No se encontró la identidad solicitada.');
  const user = decodeFirestoreFields(userDoc.fields || {});
  if (clean(user.email, 254).toLowerCase() === SUPERADMIN_EMAIL) throw new Error('La cuenta Super Admin está protegida.');

  const currentChangeId = clean(user.lastChangeId, 120);
  if (requestedChangeId && currentChangeId === requestedChangeId) {
    return { uid, action, changeId, duplicate: true, tombstone: user.deleted === true };
  }
  if (baseChangeId && currentChangeId && baseChangeId !== currentChangeId) {
    const conflict = new Error('La cuenta cambió después de la última sincronización. Actualizá la hoja antes de volver a editar.');
    conflict.status = 409;
    throw conflict;
  }

  if (action === 'reactivate' && user.deleted !== true && user.profileStatus !== 'deleted') {
    throw new Error('La cuenta no está eliminada.');
  }
  if (action === 'softDelete' && user.deleted === true && user.blocked === true) {
    return { uid, action, changeId: currentChangeId || changeId, duplicate: true, tombstone: true };
  }

  await setFirebaseUserDisabled(env, uid, action === 'softDelete');
  const now = new Date();
  const eventId = makeEventId();
  const patch = lifecyclePatch(action, user, actorEmail, now, changeId, origin);
  const afterStatus = action === 'softDelete' ? 'deleted' : (user.username && user.birthDate ? 'active' : 'incomplete');
  const audit = encodeFirestoreFields({
    eventId,
    timestamp: now,
    createdAt: now,
    customerId: user.customerId || `CUS_${uid}`,
    username: user.username || '',
    actorId,
    actorEmail,
    actorRole,
    action: action === 'softDelete' ? 'eliminar_cuenta' : 'reactivar_cuenta',
    entityType: 'usuario',
    entityId: uid,
    before: { profileStatus: user.profileStatus || 'legacy', blocked: user.blocked === true, role: user.role || 'client' },
    after: { profileStatus: afterStatus, blocked: action === 'softDelete', role: 'client' },
    origin,
    result: 'success',
    reason: reason || (action === 'softDelete' ? 'Solicitud administrativa de eliminación' : 'Reactivación administrativa'),
    changeId,
  });

  await firestoreAdminCommit(env, [
    { path: `users/${uid}`, fields: patch, mergeFields: Object.keys(patch) },
    { path: `auditLog/${eventId}`, fields: audit, currentDocument: { exists: false } },
  ]);

  const phone = clean(user.phone || user.phoneNormalized, 40).replace(/\D/g, '');
  if (action === 'softDelete' && phone) await firestoreAdminDelete(env, `phoneReservations/${encodeURIComponent(phone)}`);

  return {
    uid,
    action,
    changeId,
    duplicate: false,
    tombstone: action === 'softDelete',
    authDisabled: action === 'softDelete',
    phoneReleased: action === 'softDelete' && Boolean(phone),
    auditEventId: eventId,
  };
}
