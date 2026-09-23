import { SUPERADMIN_EMAIL } from './seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminDelete,
  firestoreAdminGet,
  setFirebaseUserDisabled,
  deleteFirebaseUser,
  fsBoolean,
  fsInteger,
  fsString,
  fsTimestamp,
} from './firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ACTIONS = new Set(['softDelete']);

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function makeEventId() {
  return `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
}

async function emailHistoryHash(value) {
  const email = clean(value, 254).toLowerCase();
  if (!email) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function historicalCommerceTombstone(user, actorEmail, now, changeId, origin, deletedEmailHash) {
  // No es un perfil reutilizable: se reemplaza completo y no conserva PII.
  // Sólo permanece la referencia comercial que una nueva cuenta verificada
  // podrá reclamar una única vez.
  return {
    customerId: fsString(user.customerId || `CUS_${user.uid}`),
    identityVersion: fsInteger(1),
    profileStatus: fsString('deleted'),
    deleted: fsBoolean(true),
    deletedAt: fsTimestamp(now),
    deletedBy: fsString(actorEmail),
    deletedEmailHash: fsString(deletedEmailHash),
    blocked: fsBoolean(true),
    role: fsString('client'),
    purchaseCount: fsInteger(user.purchaseCount || 0),
    orderCount: fsInteger(user.orderCount || user.totalOrders || 0),
    totalOrders: fsInteger(user.totalOrders || user.orderCount || 0),
    totalSpent: fsInteger(user.totalSpent || 0),
    completedOrders: fsInteger(user.completedOrders || 0),
    pendingOrders: fsInteger(user.pendingOrders || 0),
    cancelledOrders: fsInteger(user.cancelledOrders || 0),
    lastOrderId: fsString(user.lastOrderId || ''),
    lastPurchaseOrderId: fsString(user.lastPurchaseOrderId || ''),
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
  user.uid = uid;
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

  if (action === 'softDelete' && user.deleted === true && user.blocked === true) {
    return { uid, action, changeId: currentChangeId || changeId, duplicate: true, tombstone: true };
  }

  const now = new Date();
  const eventId = makeEventId();
  const deletedEmailHash = action === 'softDelete' ? await emailHistoryHash(user.email) : '';
  const patch = historicalCommerceTombstone(user, actorEmail, now, changeId, origin, deletedEmailHash);
  const afterStatus = 'deleted';
  const audit = encodeFirestoreFields({
    eventId,
    timestamp: now,
    createdAt: now,
    customerId: user.customerId || `CUS_${uid}`,
    actorId,
    actorEmail,
    actorRole,
    action: 'eliminar_cuenta',
    entityType: 'usuario',
    entityId: uid,
    before: { profileStatus: user.profileStatus || 'legacy', blocked: user.blocked === true, role: user.role || 'client' },
    after: { profileStatus: afterStatus, blocked: action === 'softDelete', role: 'client' },
    origin,
    result: 'success',
    reason: reason || 'Solicitud administrativa de eliminación',
    changeId,
  });

  // La cuenta se deshabilita antes de reemplazar el perfil. Si la escritura
  // fallara, nunca queda un acceso activo sin perfil seguro.
  await setFirebaseUserDisabled(env, uid, action === 'softDelete');
  await firestoreAdminCommit(env, [
    { path: `users/${uid}`, fields: patch },
    { path: `auditLog/${eventId}`, fields: audit, currentDocument: { exists: false } },
  ]);

  const phone = clean(user.phone || user.phoneNormalized, 40).replace(/\D/g, '');
  if (action === 'softDelete' && phone) await firestoreAdminDelete(env, `phoneReservations/${encodeURIComponent(phone)}`);
  if (action === 'softDelete') await deleteFirebaseUser(env, uid);

  return {
    uid,
    action,
    changeId,
    duplicate: false,
    tombstone: action === 'softDelete',
    authDeleted: action === 'softDelete',
    phoneReleased: action === 'softDelete' && Boolean(phone),
    auditEventId: eventId,
  };
}
