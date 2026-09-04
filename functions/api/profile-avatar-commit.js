import {
  jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit, firestoreAdminGet, updateFirebaseUserProfile,
} from '../../cloudflare/firebase-admin-ligero.js';
import { notifyAdminIfAbsent } from '../../cloudflare/notificaciones-sociales.js';

const MAX_BODY_BYTES = 8 * 1024;
const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const PUBLIC_ID_PATTERN = /^tintin_profile_[a-f0-9]{24}$/;

function clean(value, max = 1200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

async function profilePublicId(uid) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(uid)));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
  return `tintin_profile_${hash}`;
}

function eventId() {
  return `EVT_${crypto.randomUUID().replaceAll('-', '')}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const body = JSON.parse(raw);
    const user = await requireFirebaseUser(request);
    if (!UID_PATTERN.test(String(user.uid || ''))) throw new Error('Identidad inválida');

    const publicId = clean(body.publicId, 120);
    const photoURL = clean(body.photoURL, 1200);
    const expectedPublicId = await profilePublicId(user.uid);
    if (!PUBLIC_ID_PATTERN.test(publicId) || publicId !== expectedPublicId) throw new Error('Identificador de foto inválido');

    const configName = clean(env.CLOUDINARY_CLOUD_NAME, 80);
    let parsed;
    try { parsed = new URL(photoURL); } catch { throw new Error('URL de foto inválida'); }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !configName || parsed.pathname.includes('..')) {
      throw new Error('La foto no pertenece al almacenamiento autorizado');
    }
    const path = parsed.pathname.replace(/^\//, '');
    if (!path.includes(`${configName}/image/upload/`) || !path.includes(`/${publicId}`)) {
      throw new Error('La foto no coincide con el archivo autorizado');
    }

    const userPath = `users/${user.uid}`;
    const currentDocument = await firestoreAdminGet(env, userPath);
    if (!currentDocument) throw new Error('El perfil todavía no existe');
    const before = decodeFirestoreFields(currentDocument.fields || {});
    const now = new Date();
    const auditId = eventId();
    const historyPath = `${userPath}/profilePhotoHistory/${auditId}`;
    const auditPath = `auditLog/${auditId}`;
    const audit = {
      eventId: auditId, timestamp: now, createdAt: now,
      customerId: before.customerId || `CUS_${user.uid}`,
      username: before.username || '', actorId: user.uid,
      actorEmail: clean(user.email, 254).toLowerCase(), actorRole: before.role || 'client',
      action: 'actualizar_foto_perfil', entityType: 'usuario', entityId: user.uid,
      before: { photoURL: before.photoURL || '' }, after: { photoURL },
      origin: 'profile-avatar', result: 'success', changeId: auditId,
    };
    await firestoreAdminCommit(env, [
      { path: userPath, fields: encodeFirestoreFields({ photoURL, updatedAt: now, lastChangeId: auditId }), mergeFields: ['photoURL', 'updatedAt', 'lastChangeId'], currentDocument: { updateTime: currentDocument.updateTime } },
      { path: historyPath, fields: encodeFirestoreFields({ eventId: auditId, uid: user.uid, oldPhotoURL: before.photoURL || '', newPhotoURL: photoURL, createdAt: now, action: 'upload' }), currentDocument: { exists: false } },
      { path: auditPath, fields: encodeFirestoreFields(audit), currentDocument: { exists: false } },
    ]);

    let authSync = 'synchronized';
    try {
      await updateFirebaseUserProfile(env, user.uid, { photoURL });
    } catch (authError) {
      authSync = 'pending';
      const reconciliationPath = `${userPath}/profilePhotoReconciliations/${auditId}`;
      const reconciliationAuditId = eventId();
      await firestoreAdminCommit(env, [
        { path: reconciliationPath, fields: encodeFirestoreFields({
          eventId: auditId, uid: user.uid, photoURL, state: 'pending', attempts: 0,
          lastError: clean(authError?.message || 'Error desconocido', 300), createdAt: now,
          updatedAt: now, nextAttemptAt: new Date(now.getTime() + 60_000),
        }), currentDocument: { exists: false } },
        { path: `auditLog/${reconciliationAuditId}`, fields: encodeFirestoreFields({
          eventId: reconciliationAuditId, timestamp: now, createdAt: now,
          customerId: before.customerId || `CUS_${user.uid}`, username: before.username || '',
          actorId: user.uid, actorEmail: clean(user.email, 254).toLowerCase(),
          actorRole: before.role || 'client', action: 'reconciliacion_auth_pendiente',
          entityType: 'usuario', entityId: user.uid,
          before: { photoURL: before.photoURL || '' }, after: { photoURL },
          origin: 'profile-avatar-reconciliation', result: 'pending', changeId: auditId,
          error: clean(authError?.message || 'Error desconocido', 300),
        }), currentDocument: { exists: false } },
      ]);
      console.error('[profile-avatar] Auth quedó pendiente de reconciliación', { uid: user.uid, auditId, error: authError });
    }

    await notifyAdminIfAbsent(env, {
      kind: 'profile_photo_updated', actorType: 'customer', actorUid: user.uid,
      actorName: before.name || before.displayName || before.username || user.email?.split('@')[0] || 'Una clienta',
      actorPhotoUrl: photoURL, title: 'Se actualizó una foto de perfil',
      body: 'Una cuenta actualizó su foto de perfil.', iconKey: 'user',
      targetUrl: 'admin.html#section-usuarios', sourceType: 'user', sourceId: user.uid, createdAt: now,
    }, `profile_photo_updated:${user.uid}:${auditId}`).catch(error => console.warn('[profile-avatar] aviso admin no enviado:', error));

    return jsonResponse({ ok: true, photoURL, auditId, authSync }, authSync === 'pending' ? 202 : 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || (error?.code === 'version_conflict' ? 409 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo consolidar la foto').slice(0, 300) }, status, origin, request.url);
  }
}
