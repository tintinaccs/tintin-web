import { SUPERADMIN_EMAIL } from './seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  deleteFirebaseUser,
  encodeFirestoreFields,
  firestoreAdminDelete,
  firestoreAdminGet,
  firestoreAdminListAll,
  firestoreAdminQueryByField,
  lookupFirebaseUser,
} from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit, firestoreAdminDeleteWhere, MAX_ADMIN_BATCH_WRITES } from './firestore-admin-batch.js';
import { adminPurgeUserEngagement } from './participacion-admin.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const EMAIL_PATTERN = /^[^\s@/]{1,64}@[^\s@/]{1,189}\.[^\s@/]{2,63}$/;
// 'softDelete' queda como alias: Google Sheets y versiones anteriores del
// panel lo siguen enviando, pero la baja ya no deja ningún rastro de la cuenta.
const ACTIONS = new Set(['delete', 'softDelete']);
const USER_SUBCOLLECTIONS = ['cart', 'favorites', 'reviews', 'reviewLikeProducts', 'notifications', 'socialLimits'];
const SUBCOLLECTION_SCAN_LIMIT = 2000;
const MAX_UIDS_PER_EMAIL = 5;
const PENDING_ERROR = 'Quedan documentos por borrar; reintentá la operación.';

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

function documentPath(document) {
  return String(document?.name || '').split('/documents/')[1] || '';
}

const batchablePath = path => /^(?:[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)*$/.test(path);

async function deletePaths(env, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  const batchable = unique.filter(batchablePath);
  for (let index = 0; index < batchable.length; index += MAX_ADMIN_BATCH_WRITES) {
    await firestoreAdminBatchCommit(env, batchable.slice(index, index + MAX_ADMIN_BATCH_WRITES).map(path => ({ path, delete: true })));
  }
  // IDs antiguos con caracteres que el commit administrativo no acepta.
  for (const path of unique.filter(path => !batchablePath(path))) {
    await firestoreAdminDelete(env, path.split('/').map(encodeURIComponent).join('/'));
  }
  return unique.length;
}

async function deleteUserSubcollections(env, uid) {
  let deleted = 0;
  for (const name of USER_SUBCOLLECTIONS) {
    const documents = await firestoreAdminListAll(env, `users/${uid}/${name}`, SUBCOLLECTION_SCAN_LIMIT);
    deleted += await deletePaths(env, documents.map(documentPath));
    if (documents.length >= SUBCOLLECTION_SCAN_LIMIT) throw new Error(PENDING_ERROR);
  }
  return deleted;
}

// Tombstones del borrado anterior ("Historial protegido") que conservaban el
// hash del correo. Si quedan, la cuenta sigue apareciendo como eliminada.
async function legacyTombstonePaths(env, email) {
  const hash = await emailHistoryHash(email);
  if (!hash) return [];
  const documents = await firestoreAdminQueryByField(env, 'users', 'deletedEmailHash', hash, 50);
  return documents
    .filter(document => {
      const data = decodeFirestoreFields(document.fields || {});
      return data.deleted === true || data.profileStatus === 'deleted';
    })
    .map(documentPath);
}

function conflictError() {
  const conflict = new Error('La cuenta cambió después de la última sincronización. Actualizá la hoja antes de volver a editar.');
  conflict.status = 409;
  return conflict;
}

/**
 * Baja definitiva de una cuenta: borra su identidad de acceso, su perfil, sus
 * subcolecciones, reservas de teléfono y username, su participación social y
 * los avisos que generó, como si nunca se hubiera registrado. Los pedidos se
 * conservan porque son registros de venta de la tienda, no datos de la cuenta.
 *
 * Cada paso es idempotente y el perfil se borra al final junto con el
 * registro de auditoría: si algo se corta a mitad, repetir la acción completa
 * lo que falte sin dejar la cuenta en un estado intermedio visible.
 */
export async function applyUserLifecycle(env, options = {}) {
  const uid = clean(options.uid, 128);
  const action = clean(options.action || 'delete', 30);
  const actorEmail = clean(options.actorEmail || 'system', 254).toLowerCase();
  const actorId = clean(options.actorId || actorEmail || 'system', 128);
  const actorRole = clean(options.actorRole || 'system', 40);
  const reason = clean(options.reason, 500);
  const origin = clean(options.origin || 'system', 120);
  const changeId = clean(options.changeId, 120) || makeEventId();
  const baseChangeId = clean(options.baseChangeId, 120);

  if (!UID_PATTERN.test(uid) || !ACTIONS.has(action)) throw new Error('Usuario o acción inválidos.');

  const [userDoc, authUser] = await Promise.all([
    firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`),
    lookupFirebaseUser(env, { uid }),
  ]);
  const user = userDoc ? decodeFirestoreFields(userDoc.fields || {}) : {};
  const emails = [...new Set([clean(user.email, 254).toLowerCase(), clean(authUser?.email, 254).toLowerCase()].filter(Boolean))];
  if (emails.includes(SUPERADMIN_EMAIL)) throw new Error('La cuenta Super Admin está protegida.');
  if (!userDoc && !authUser) return { uid, action, changeId, alreadyDeleted: true, sheetEvents: [] };

  const legacyTombstone = user.deleted === true || user.profileStatus === 'deleted';
  const currentChangeId = clean(user.lastChangeId, 120);
  if (!legacyTombstone && baseChangeId && currentChangeId && baseChangeId !== currentChangeId) throw conflictError();

  const engagement = await adminPurgeUserEngagement(env, uid);
  const subcollectionDocs = await deleteUserSubcollections(env, uid);

  const phone = clean(user.phone || user.phoneNormalized, 40).replace(/\D/g, '');
  await Promise.all([
    firestoreAdminDeleteWhere(env, 'phoneReservations', 'uid', uid),
    firestoreAdminDeleteWhere(env, 'usernameReservations', 'uid', uid),
    firestoreAdminDeleteWhere(env, 'socialRateLimits', 'uid', uid),
  ]);
  const residualPaths = [`checkoutGuards/${uid}`, ...emails.map(email => `emailOtpCodes/${email}`)];
  if (phone) residualPaths.push(`phoneReservations/${phone}`);
  await deletePaths(env, residualPaths);

  if (authUser) await deleteFirebaseUser(env, uid);

  // El perfil se borra último y en el mismo commit que la auditoría. La
  // auditoría no guarda correo, nombre ni teléfono de la cuenta borrada.
  const now = new Date();
  const eventId = makeEventId();
  const audit = encodeFirestoreFields({
    eventId,
    timestamp: now,
    createdAt: now,
    actorId,
    actorEmail,
    actorRole,
    action: 'eliminar_cuenta',
    entityType: 'usuario',
    entityId: uid,
    before: {
      profileStatus: legacyTombstone ? 'deleted' : (user.profileStatus || (userDoc ? 'legacy' : 'sin_perfil')),
      blocked: user.blocked === true || authUser?.disabled === true,
      role: user.role || 'client',
    },
    after: { profileStatus: 'purged', blocked: false, role: '' },
    origin,
    result: 'success',
    reason: reason || 'Solicitud administrativa de eliminación',
    changeId,
    purged: {
      reviews: engagement.reviewsDeleted,
      replies: engagement.repliesRemoved,
      likes: engagement.likesDeleted,
      reports: engagement.reportsDeleted,
      notifications: engagement.notificationsDeleted,
      subcollectionDocs,
    },
  });
  await firestoreAdminBatchCommit(env, [
    { path: `users/${uid}`, delete: true },
    { path: `auditLog/${eventId}`, fields: audit, currentDocument: { exists: false } },
  ]);

  return {
    uid,
    action,
    changeId,
    duplicate: false,
    purged: true,
    authDeleted: Boolean(authUser),
    profileDeleted: Boolean(userDoc),
    legacyTombstone,
    auditEventId: eventId,
    sheetEvents: engagement.sheetEvents,
  };
}

/**
 * Baja por correo para cuentas que quedaron a medias (sin perfil visible en el
 * panel, o con el acceso deshabilitado por un borrado anterior). Resuelve los
 * UID asociados al correo en Auth y en Firestore y aplica la misma baja a UNO
 * por llamada, para no agotar el límite de subsolicitudes de Cloudflare; el
 * panel repite mientras `remainingAccounts` sea mayor que cero.
 */
export async function purgeUserByEmail(env, options = {}) {
  const email = clean(options.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error('Correo inválido.');
  if (email === SUPERADMIN_EMAIL) throw new Error('La cuenta Super Admin está protegida.');

  const [authUser, profileDocs, tombstones] = await Promise.all([
    lookupFirebaseUser(env, { email }),
    firestoreAdminQueryByField(env, 'users', 'email', email, MAX_UIDS_PER_EMAIL + 1),
    legacyTombstonePaths(env, email),
  ]);
  const uids = new Set();
  if (authUser?.uid) uids.add(authUser.uid);
  for (const document of profileDocs) uids.add(documentPath(document).split('/')[1] || '');
  for (const path of tombstones) uids.add(path.split('/')[1] || '');
  for (const uid of uids) if (!UID_PATTERN.test(uid)) uids.delete(uid);
  if (uids.size > MAX_UIDS_PER_EMAIL) throw new Error('Hay demasiadas cuentas con ese correo; eliminalas desde la lista.');

  if (!uids.size) {
    // Restos sin cuenta asociada (código de verificación pendiente).
    await deletePaths(env, [`emailOtpCodes/${email}`]);
    return { email, accountsFound: 0, remainingAccounts: 0, result: null, sheetEvents: [] };
  }
  const [uid] = uids;
  const { sheetEvents, ...result } = await applyUserLifecycle(env, { ...options, uid, action: 'delete' });
  return { email, accountsFound: uids.size, remainingAccounts: uids.size - 1, result, sheetEvents };
}
