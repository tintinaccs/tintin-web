import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit,
  firestoreAdminGet, firestoreAdminList, updateFirebaseUserProfile,
} from '../../cloudflare/firebase-admin-ligero.js';

function eventId(prefix = 'EVT') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function clean(value, max = 1200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, requestUrl);

  try {
    const user = await requireFirebaseUser(request);
    const uid = clean(user.uid, 128);
    const profileDocument = await firestoreAdminGet(env, `users/${uid}`);
    if (!profileDocument) throw new Error('El perfil todavía no existe');
    const profile = decodeFirestoreFields(profileDocument.fields || {});
    // Un valor canónico vacío representa una retirada explícita. Solo perfiles
    // antiguos sin ese campo pueden recuperar la variante histórica.
    const photoURL = clean(profile.photoURL ?? profile.photoUrl);
    await updateFirebaseUserProfile(env, uid, { photoURL });

    const pendingPath = `users/${uid}/profilePhotoReconciliations`;
    const pendingDocuments = await firestoreAdminList(env, pendingPath, 20);
    const writes = [];
    let resolved = 0;
    for (const document of pendingDocuments) {
      const pending = decodeFirestoreFields(document.fields || {});
      if (pending.state !== 'pending' || clean(pending.photoURL) !== photoURL) continue;
      const path = `${pendingPath}/${String(document.name || '').split('/').pop()}`;
      writes.push({
        path,
        fields: encodeFirestoreFields({ state: 'resolved', attempts: Math.max(0, Number(pending.attempts) || 0) + 1, resolvedAt: new Date(), updatedAt: new Date(), lastError: '' }),
        mergeFields: ['state', 'attempts', 'resolvedAt', 'updatedAt', 'lastError'],
        currentDocument: { updateTime: document.updateTime },
      });
      resolved += 1;
    }
    if (resolved) {
      const now = new Date();
      const auditId = eventId();
      writes.push({
        path: `auditLog/${auditId}`,
        fields: encodeFirestoreFields({
          eventId: auditId, timestamp: now, createdAt: now, actorId: uid,
          actorEmail: clean(user.email, 254).toLowerCase(), actorRole: profile.role || 'client',
          action: 'reconciliacion_auth_resuelta', entityType: 'usuario', entityId: uid,
          origin: 'profile-avatar-reconciliation', result: 'success', resolved,
        }),
        currentDocument: { exists: false },
      });
      await firestoreAdminCommit(env, writes);
    }
    return jsonResponse({ ok: true, authSync: 'synchronized', resolved }, 200, origin, requestUrl);
  } catch (error) {
    const status = Number(error?.status) || 503;
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo reconciliar el perfil').slice(0, 300) }, status, origin, requestUrl);
  }
}
