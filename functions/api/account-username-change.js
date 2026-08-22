import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import { usernameKey } from '../../js/components/forms/utilidades-username.js';

const MAX_BODY_BYTES = 2048;

function safeText(value, max = 300) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function eventId() {
  return `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      throw new Error('Solicitud inválida.');
    }
    const body = JSON.parse(raw);
    const nextUsername = usernameKey(body.username);
    if (!nextUsername) throw new Error('El nombre de usuario no es válido.');

    const userPath = `users/${encodeURIComponent(user.uid)}`;
    const userDoc = await firestoreAdminGet(env, userPath);
    if (!userDoc) throw new Error('No encontramos tu perfil.');

    const profile = decodeFirestoreFields(userDoc.fields || {});
    if (profile.blocked === true || profile.deleted === true || profile.profileStatus === 'deleted') {
      throw new Error('La cuenta no está disponible para cambios.');
    }

    const currentUsername = usernameKey(profile.username || '');
    const usedChanges = Math.max(0, Number(profile.usernameChangeCount || 0));
    const isInitialAssignment = !currentUsername;
    const isActualChange = Boolean(currentUsername && currentUsername !== nextUsername);

    if (!isInitialAssignment && !isActualChange) {
      return jsonResponse({
        ok: true,
        username: currentUsername,
        changed: false,
        remainingChanges: usedChanges >= 1 ? 0 : 1,
      }, 200, origin, requestUrl);
    }
    if (isActualChange && usedChanges >= 1) {
      return jsonResponse({ ok: false, error: 'Ya utilizaste el único cambio disponible para tu @username.' }, 409, origin, requestUrl);
    }

    const nextReservationPath = `usernameReservations/${encodeURIComponent(nextUsername)}`;
    const nextReservationDoc = await firestoreAdminGet(env, nextReservationPath);
    const nextReservation = nextReservationDoc
      ? decodeFirestoreFields(nextReservationDoc.fields || {})
      : null;
    if (nextReservation?.uid && String(nextReservation.uid) !== user.uid) {
      return jsonResponse({ ok: false, error: 'Ese @username ya está en uso.' }, 409, origin, requestUrl);
    }

    const oldReservationPath = currentUsername
      ? `usernameReservations/${encodeURIComponent(currentUsername)}`
      : '';
    const oldReservationDoc = oldReservationPath
      ? await firestoreAdminGet(env, oldReservationPath)
      : null;
    const oldReservation = oldReservationDoc
      ? decodeFirestoreFields(oldReservationDoc.fields || {})
      : null;

    const now = new Date();
    const customerId = safeText(profile.customerId, 180) || `CUS_${user.uid}`;
    const profilePatch = {
      username: nextUsername,
      usernameChangeCount: isActualChange ? 1 : usedChanges,
      updatedAt: now,
    };
    if (isInitialAssignment) profilePatch.usernameAssignedAt = now;
    if (isActualChange) profilePatch.usernameChangedAt = now;

    const writes = [];
    if (!nextReservationDoc) {
      writes.push({
        path: nextReservationPath,
        fields: encodeFirestoreFields({ uid: user.uid, createdAt: now }),
        currentDocument: { exists: false },
      });
    }

    writes.push({
      path: `users/${user.uid}`,
      fields: encodeFirestoreFields(profilePatch),
      mergeFields: Object.keys(profilePatch),
      currentDocument: { updateTime: userDoc.updateTime },
    });

    if (
      isActualChange &&
      oldReservationDoc &&
      String(oldReservation?.uid || '') === user.uid &&
      oldReservationPath !== nextReservationPath
    ) {
      writes.push({
        path: oldReservationPath,
        delete: true,
        currentDocument: { updateTime: oldReservationDoc.updateTime },
      });
    }

    const auditId = eventId();
    writes.push({
      path: `auditLog/${auditId}`,
      fields: encodeFirestoreFields({
        eventId: auditId,
        timestamp: now,
        createdAt: now,
        customerId,
        actorId: user.uid,
        actorEmail: user.email,
        actorRole: 'client',
        action: isInitialAssignment ? 'asignar_username' : 'cambiar_username',
        entityType: 'usuario',
        entityId: user.uid,
        before: { username: currentUsername || '', usernameChangeCount: usedChanges },
        after: { username: nextUsername, usernameChangeCount: isActualChange ? 1 : usedChanges },
        origin: 'perfil',
        result: 'success',
        changeId: auditId,
      }),
      currentDocument: { exists: false },
    });

    await firestoreAdminCommit(env, writes);

    return jsonResponse({
      ok: true,
      username: nextUsername,
      changed: isActualChange,
      initialAssignment: isInitialAssignment,
      remainingChanges: isActualChange ? 0 : (usedChanges >= 1 ? 0 : 1),
      auditEventId: auditId,
    }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[account-username-change]', error?.message || error);
    const message = safeText(error?.message, 300);
    const safeMessages = new Set([
      'Solicitud inválida.',
      'El nombre de usuario no es válido.',
      'No encontramos tu perfil.',
      'La cuenta no está disponible para cambios.',
      'La sesión venció; volvé a iniciar sesión',
      'La cuenta debe tener un correo verificado',
    ]);
    return jsonResponse({
      ok: false,
      error: safeMessages.has(message) ? message : 'No pudimos actualizar tu @username.',
    }, error?.status === 409 ? 409 : 400, origin, requestUrl);
  }
}
