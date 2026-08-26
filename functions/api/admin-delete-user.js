import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  SUPERADMIN_EMAIL
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminDelete,
  firestoreAdminGet,
  setFirebaseUserDisabled,
  fsBoolean,
  fsString,
  fsTimestamp
} from '../../cloudflare/firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ACTIONS = new Set(['softDelete', 'reactivate']);

function safeText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function eventId() {
  return `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
}

function userPatch(action, user, actor, now) {
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
      updatedAt: fsTimestamp(now),
    };
  }
  return {
    blocked: fsBoolean(true),
    deleted: fsBoolean(true),
    deletedAt: fsTimestamp(now),
    deletedBy: fsString(actor.email),
    blockReason: fsString('Cuenta eliminada mediante tombstone histórico'),
    roleBeforeBlock: fsString(user.role && user.role !== 'client' ? user.role : ''),
    role: fsString('client'),
    phone: fsString(''),
    profileStatus: fsString('deleted'),
    updatedAt: fsTimestamp(now),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || raw.length > 3000) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    const uid = safeText(body.uid, 128);
    const action = safeText(body.action || 'softDelete', 30);
    const reason = safeText(body.reason, 500);
    if (!UID_PATTERN.test(uid) || !ACTIONS.has(action)) throw new Error('Usuario o acción inválidos.');

    const userDoc = await firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`);
    if (!userDoc) throw new Error('No se encontró la identidad solicitada.');
    const user = decodeFirestoreFields(userDoc.fields);
    if (safeText(user.email, 254).toLowerCase() === SUPERADMIN_EMAIL) {
      throw new Error('La cuenta Super Admin está protegida.');
    }
    if (action === 'reactivate' && user.deleted !== true && user.profileStatus !== 'deleted') {
      throw new Error('La cuenta no está eliminada.');
    }

    await setFirebaseUserDisabled(env, uid, action === 'softDelete');

    const now = new Date();
    const id = eventId();
    const patch = userPatch(action, user, actor, now);
    const audit = encodeFirestoreFields({
      eventId: id,
      timestamp: now,
      createdAt: now,
      customerId: user.customerId || `CUS_${uid}`,
      username: user.username || '',
      actorId: actor.uid,
      actorEmail: actor.email,
      actorRole: 'superadmin',
      action: action === 'softDelete' ? 'eliminar_cuenta' : 'reactivar_cuenta',
      entityType: 'usuario',
      entityId: uid,
      before: { profileStatus: user.profileStatus || 'legacy', blocked: user.blocked === true, role: user.role || 'client' },
      after: { profileStatus: action === 'softDelete' ? 'deleted' : (user.username && user.birthDate ? 'active' : 'incomplete'), blocked: action === 'softDelete', role: 'client' },
      origin: 'superadmin',
      result: 'success',
      reason: reason || (action === 'softDelete' ? 'Solicitud administrativa de eliminación' : 'Reactivación administrativa'),
      changeId: id,
    });

    await firestoreAdminCommit(env, [
      { path: `users/${uid}`, fields: patch, mergeFields: Object.keys(patch) },
      { path: `auditLog/${id}`, fields: audit, currentDocument: { exists: false } },
    ]);

    // El teléfono sí puede reutilizarse. Username/email/customerId quedan
    // reservados porque su identidad histórica permanece como tombstone.
    const phone = safeText(user.phone || user.phoneNormalized, 40).replace(/\D/g, '');
    if (action === 'softDelete' && phone) {
      await firestoreAdminDelete(env, `phoneReservations/${encodeURIComponent(phone)}`);
    }

    return jsonResponse({
      ok: true,
      action,
      tombstone: action === 'softDelete',
      authDisabled: action === 'softDelete',
      phoneReleased: action === 'softDelete' && Boolean(phone),
      auditEventId: id,
    }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-delete-user]', error?.message || error);
    const message = safeText(error?.message, 300);
    const safeMessage = /^(Solicitud inválida|Usuario o acción inválidos|No se encontró la identidad solicitada|La cuenta Super Admin está protegida|La cuenta no está eliminada)\.?$/.test(message)
      ? message
      : 'No se pudo actualizar el estado de la cuenta.';
    return jsonResponse({ ok: false, error: safeMessage }, 400, origin, requestUrl);
  }
}
