import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  setFirebaseUserDisabled,
} from '../../cloudflare/firebase-admin-ligero.js';
import { jsonResponse, SUPERADMIN_EMAIL } from '../../cloudflare/seguridad-cloudinary.js';
import { applyUserLifecycle } from '../../cloudflare/user-lifecycle-domain.js';
import { applyOrderAdminMutation, createOrderAdmin } from '../../cloudflare/order-admin-domain.js';

const MAX_BODY_BYTES = 64 * 1024;
const ROLES = new Set(['client', 'viewer', 'agent', 'admin']);
const ADMIN_SYNC_REVISION = 'admin-sync-v4';

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function id(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(normalized)) throw new Error(`${label} inválido`);
  return normalized;
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function changeId(value) {
  const normalized = text(value, 120);
  return /^[A-Za-z0-9:_-]{8,120}$/.test(normalized)
    ? normalized
    : `sheet_${crypto.randomUUID().replaceAll('-', '')}`;
}

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

async function updateUser(env, input) {
  const uid = id(input.uid, 'UID');
  const action = text(input.action || 'updateUser', 40);
  const nextChangeId = changeId(input.changeId);
  const baseChangeId = text(input.baseChangeId, 120);
  const origin = text(input.source || 'google-sheets:Usuarios web', 120);

  if (action === 'deleteUser' || action === 'softDeleteUser') {
    return applyUserLifecycle(env, {
      uid,
      action: 'softDelete',
      actorId: 'google-sheets',
      actorEmail: 'google-sheets@tintin.internal',
      actorRole: 'sheets-sync',
      reason: 'Acción administrativa desde Usuarios web',
      origin,
      changeId: nextChangeId,
      baseChangeId,
    });
  }
  if (action === 'reactivateUser') {
    return applyUserLifecycle(env, {
      uid,
      action: 'reactivate',
      actorId: 'google-sheets',
      actorEmail: 'google-sheets@tintin.internal',
      actorRole: 'sheets-sync',
      reason: 'Reactivación administrativa desde Usuarios web',
      origin,
      changeId: nextChangeId,
      baseChangeId,
    });
  }
  if (action !== 'updateUser') throw new Error('Acción de usuario no permitida');

  const currentDoc = await firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`);
  if (!currentDoc) throw new Error('No se encontró la identidad solicitada.');
  const current = decodeFirestoreFields(currentDoc.fields || {});
  if (text(current.email, 254).toLowerCase() === SUPERADMIN_EMAIL) throw new Error('La cuenta Super Admin está protegida.');
  if (current.deleted === true || current.profileStatus === 'deleted') {
    throw new Error('La cuenta está eliminada; primero debe reactivarse.');
  }

  const currentChangeId = text(current.lastChangeId, 120);
  if (currentChangeId && currentChangeId === nextChangeId) {
    return { uid, duplicate: true, role: current.role || 'client', blocked: current.blocked === true, changeId: currentChangeId };
  }
  if (baseChangeId && currentChangeId && baseChangeId !== currentChangeId) {
    throw conflict('La cuenta cambió después de la última sincronización. Actualizá la hoja antes de volver a editar.');
  }

  const requestedRole = text(input.role, 20).toLowerCase();
  if (!ROLES.has(requestedRole)) throw new Error('Rol no permitido');
  const blocked = input.blocked === true;
  const roleBeforeBlock = blocked
    ? (current.role && current.role !== 'client' ? current.role : current.roleBeforeBlock || '')
    : '';
  const role = blocked ? 'client' : requestedRole;
  const now = new Date();
  const eventId = `EVT_${crypto.randomUUID().replaceAll('-', '')}`;

  await setFirebaseUserDisabled(env, uid, blocked);
  await firestoreAdminCommit(env, [
    {
      path: `users/${uid}`,
      fields: encodeFirestoreFields({
        role,
        blocked,
        roleBeforeBlock,
        internalNotes: text(input.internalNotes, 1000),
        updatedAt: now,
        lastChangeId: nextChangeId,
        syncOrigin: origin,
      }),
      mergeFields: ['role', 'blocked', 'roleBeforeBlock', 'internalNotes', 'updatedAt', 'lastChangeId', 'syncOrigin'],
    },
    {
      path: `auditLog/${eventId}`,
      fields: encodeFirestoreFields({
        eventId,
        timestamp: now,
        createdAt: now,
        customerId: current.customerId || `CUS_${uid}`,
        actorId: 'google-sheets',
        actorEmail: 'google-sheets@tintin.internal',
        actorRole: 'sheets-sync',
        action: blocked ? 'bloquear_usuario' : 'actualizar_usuario',
        entityType: 'usuario',
        entityId: uid,
        before: { role: current.role || 'client', blocked: current.blocked === true },
        after: { role, blocked },
        origin,
        result: 'success',
        changeId: nextChangeId,
      }),
      currentDocument: { exists: false },
    },
  ]);
  return { uid, role, blocked, duplicate: false, changeId: nextChangeId };
}

async function handleOrder(env, input) {
  const action = text(input.action || 'updateOrder', 40);
  const actor = {
    uid: 'google-sheets',
    email: 'google-sheets@tintin.internal',
    role: 'sheets-sync',
    origin: text(input.source || 'google-sheets:Pedidos web', 120),
  };
  if (action === 'createOrder') {
    return createOrderAdmin(env, {
      ...input,
      changeId: changeId(input.changeId),
    }, actor);
  }
  if (action !== 'updateOrder') throw new Error('Acción de pedido no permitida');
  return applyOrderAdminMutation(env, {
    ...input,
    changeId: changeId(input.changeId),
    baseChangeId: text(input.baseChangeId, 120),
  }, actor);
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return jsonResponse({ ok: false, error: 'No autorizado', revision: ADMIN_SYNC_REVISION }, 401, '', request.url);
  }
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud inválida');
    const input = JSON.parse(raw);

    if (input.action === 'diagnose') {
      return jsonResponse({
        ok: true,
        authenticated: true,
        destructiveUserDelete: false,
        writableEntities: ['user', 'order'],
        readOnlyMirrors: ['audit'],
        orderMutationsUseInventoryDomain: true,
        orderCreationUsesCanonicalSequence: true,
        revision: ADMIN_SYNC_REVISION,
      }, 200, '', request.url);
    }

    let result;
    if (input.entity === 'user') result = await updateUser(env, input);
    else if (input.entity === 'order') result = await handleOrder(env, input);
    else throw new Error('Entidad no permitida');

    return jsonResponse({ ok: true, result, revision: ADMIN_SYNC_REVISION }, 200, '', request.url);
  } catch (error) {
    const status = Number(error?.status) === 409 ? 409 : 400;
    return jsonResponse({
      ok: false,
      error: String(error?.message || 'No se pudo sincronizar').slice(0, 300),
      code: String(error?.code || '').slice(0, 80),
      revision: ADMIN_SYNC_REVISION,
    }, status, '', request.url);
  }
}
