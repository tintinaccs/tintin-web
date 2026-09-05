import { jsonResponse, originIsAllowed, preflightResponse, requireStaffPermission } from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit, firestoreAdminGet,
  updateFirebaseUserProfile,
} from '../../cloudflare/firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const PUBLIC_ID_PATTERN = /^tintin_profile_[a-f0-9]{24}$/;
const MAX_BODY_BYTES = 8 * 1024;
const clean = (value, max = 1200) => String(value == null ? '' : value).trim().slice(0, max);
const eventId = () => `EVT_${crypto.randomUUID().replaceAll('-', '')}`;

async function profilePublicId(uid) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(uid)));
  return `tintin_profile_${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24)}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const body = JSON.parse(raw);
    const actor = await requireStaffPermission(request, env, 'usuarios', 'gestionarFotos');
    const uid = clean(body.uid, 128);
    const photoURL = clean(body.photoURL, 1200);
    const publicId = clean(body.publicId, 120);
    if (!UID_PATTERN.test(uid) || !PUBLIC_ID_PATTERN.test(publicId) || publicId !== await profilePublicId(uid)) throw new Error('Identificador de foto inválido');
    let parsed;
    try { parsed = new URL(photoURL); } catch { throw new Error('URL de foto inválida'); }
    const cloudName = clean(env.CLOUDINARY_CLOUD_NAME, 80);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !cloudName || parsed.pathname.includes('..') || !parsed.pathname.includes(`${cloudName}/image/upload/`) || !parsed.pathname.includes(`/${publicId}`)) throw new Error('La foto no pertenece al almacenamiento autorizado');
    const currentDocument = await firestoreAdminGet(env, `users/${uid}`);
    if (!currentDocument) throw new Error('El perfil no existe');
    const before = decodeFirestoreFields(currentDocument.fields || {});
    const targetEmail = clean(before.email, 254).toLowerCase();
    if (before.role === 'superadmin' || targetEmail === 'tintinaccs@gmail.com') { const e = new Error('La cuenta oficial no puede ser modificada por esta vía'); e.status = 403; throw e; }
    const expected = clean(body.expectedPhotoURL);
    const currentPhotoURL = clean(before.photoURL || before.photoUrl);
    if (expected !== currentPhotoURL) { const e = new Error('La foto cambió mientras se editaba; actualizá la lista'); e.status = 409; throw e; }
    const now = new Date();
    const auditId = eventId();
    const audit = {
      eventId: auditId, timestamp: now, createdAt: now, actorId: actor.uid,
      actorEmail: clean(actor.email, 254).toLowerCase(), actorRole: actor.role,
      customerId: before.customerId || `CUS_${uid}`, username: before.username || '',
      action: 'reemplazar_foto_perfil', entityType: 'usuario', entityId: uid,
      before: { photoURL: currentPhotoURL }, after: { photoURL },
      origin: 'profile-avatar-admin', result: 'success', changeId: auditId,
    };
    await firestoreAdminCommit(env, [
      { path: `users/${uid}`, fields: encodeFirestoreFields({ photoURL, updatedAt: now, lastChangeId: auditId }), mergeFields: ['photoURL', 'updatedAt', 'lastChangeId'], currentDocument: { updateTime: currentDocument.updateTime } },
      { path: `users/${uid}/profilePhotoHistory/${auditId}`, fields: encodeFirestoreFields({ eventId: auditId, uid, oldPhotoURL: currentPhotoURL, newPhotoURL: photoURL, createdAt: now, action: 'replace', actorId: actor.uid }), currentDocument: { exists: false } },
      { path: `auditLog/${auditId}`, fields: encodeFirestoreFields(audit), currentDocument: { exists: false } },
    ]);
    let authSync = 'synchronized';
    try { await updateFirebaseUserProfile(env, uid, { photoURL }); }
    catch (error) {
      authSync = 'pending';
      const retryId = eventId();
      await firestoreAdminCommit(env, [
        { path: `users/${uid}/profilePhotoReconciliations/${auditId}`, fields: encodeFirestoreFields({ eventId: auditId, uid, photoURL, state: 'pending', attempts: 0, lastError: clean(error?.message || 'Error desconocido', 300), createdAt: now, updatedAt: now, nextAttemptAt: new Date(now.getTime() + 60_000) }), currentDocument: { exists: false } },
        { path: `auditLog/${retryId}`, fields: encodeFirestoreFields({ eventId: retryId, timestamp: now, createdAt: now, actorId: actor.uid, actorEmail: clean(actor.email, 254).toLowerCase(), actorRole: actor.role, action: 'reconciliacion_auth_pendiente', entityType: 'usuario', entityId: uid, origin: 'profile-avatar-admin-reconciliation', result: 'pending', sourceEventId: auditId, error: clean(error?.message || 'Error desconocido', 300) }), currentDocument: { exists: false } },
      ]);
    }
    return jsonResponse({ ok: true, uid, photoURL, auditId, authSync }, authSync === 'pending' ? 202 : 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || (error?.code === 'version_conflict' ? 409 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo reemplazar la foto').slice(0, 300) }, status, origin, request.url);
  }
}
