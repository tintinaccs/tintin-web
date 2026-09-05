import {
  cloudinarySignature, getCloudinaryConfig, jsonResponse, originIsAllowed,
  preflightResponse, requireStaffPermission, SUPERADMIN_EMAIL,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit, firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_BODY_BYTES = 8 * 1024;
const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const PROFILE_ID_PATTERN = /^tintin_profile_[a-f0-9]{24}$/;

function clean(value, max = 1200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

async function profilePublicId(uid) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(uid)));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
  return `tintin_profile_${hash}`;
}

function eventId(prefix = 'EVT') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

async function destroyProfileAsset(publicId, config) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedParameters = { invalidate: 'true', public_id: publicId, timestamp, type: 'upload' };
  const signature = await cloudinarySignature(signedParameters, config.apiSecret);
  const form = new URLSearchParams({
    api_key: config.apiKey, invalidate: 'true', public_id: publicId,
    signature, timestamp: String(timestamp), type: 'upload',
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !['ok', 'not found'].includes(data.result)) {
    throw new Error(data?.error?.message || `Cloudinary no confirmó el borrado (HTTP ${response.status})`);
  }
  return data.result;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, requestUrl);

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud vacía o demasiado grande');
    const body = JSON.parse(raw);
    const actor = await requireStaffPermission(request, env, 'usuarios', 'gestionarFotos');
    const uid = clean(body.uid, 128);
    const action = clean(body.action, 32);
    if (!UID_PATTERN.test(uid) || action !== 'remove') throw new Error('Operación de foto inválida');

    const currentDocument = await firestoreAdminGet(env, `users/${uid}`);
    if (!currentDocument) throw new Error('El perfil no existe');
    const before = decodeFirestoreFields(currentDocument.fields || {});
    const targetEmail = clean(before.email, 254).toLowerCase();
    if (before.role === 'superadmin' || (targetEmail && targetEmail === String(SUPERADMIN_EMAIL).toLowerCase())) {
      const error = new Error('La cuenta oficial no puede ser moderada');
      error.status = 403;
      throw error;
    }

    const currentPhotoURL = clean(before.photoURL || before.photoUrl);
    const publicId = await profilePublicId(uid);
    if (!PROFILE_ID_PATTERN.test(publicId) || !currentPhotoURL.includes(`/${publicId}`)) {
      throw new Error('La foto actual no pertenece al perfil autorizado');
    }
    const expectedPhotoURL = clean(body.photoURL);
    if (expectedPhotoURL && expectedPhotoURL !== currentPhotoURL) {
      const error = new Error('La foto cambió mientras se moderaba; actualizá la lista');
      error.status = 409;
      throw error;
    }

    const now = new Date();
    const auditId = eventId();
    const historyPath = `users/${uid}/profilePhotoHistory/${auditId}`;
    const auditPath = `auditLog/${auditId}`;
    const audit = {
      eventId: auditId, timestamp: now, createdAt: now, actorId: actor.uid,
      actorEmail: clean(actor.email, 254).toLowerCase(), actorRole: actor.role,
      username: before.username || '', customerId: before.customerId || `CUS_${uid}`,
      action: 'quitar_foto_perfil', entityType: 'usuario', entityId: uid,
      before: { photoURL: currentPhotoURL }, after: { photoURL: '' },
      origin: 'profile-avatar-moderation', result: 'success', changeId: auditId,
    };
    // El dato visible se quita primero y queda protegido por la versión leída.
    // La limpieza de Cloudinary se ejecuta después y deja su propio evento si falla.
    await firestoreAdminCommit(env, [
      {
        path: `users/${uid}`,
        fields: encodeFirestoreFields({ photoURL: '', photoUrl: '', updatedAt: now, lastChangeId: auditId }),
        mergeFields: ['photoURL', 'photoUrl', 'updatedAt', 'lastChangeId'],
        currentDocument: { updateTime: currentDocument.updateTime },
      },
      {
        path: historyPath,
        fields: encodeFirestoreFields({ eventId: auditId, uid, oldPhotoURL: currentPhotoURL, newPhotoURL: '', createdAt: now, action: 'remove', actorId: actor.uid }),
        currentDocument: { exists: false },
      },
      { path: auditPath, fields: encodeFirestoreFields(audit), currentDocument: { exists: false } },
    ]);

    let cleanup = 'pending';
    let cleanupError = '';
    try {
      cleanup = await destroyProfileAsset(publicId, getCloudinaryConfig(env));
    } catch (error) {
      cleanupError = String(error?.message || 'No se pudo limpiar el recurso externo').slice(0, 300);
      cleanup = 'error';
      const cleanupId = eventId('CLEANUP');
      await firestoreAdminCommit(env, [{
        path: `auditLog/${cleanupId}`,
        fields: encodeFirestoreFields({
          eventId: cleanupId, timestamp: new Date(), createdAt: new Date(), actorId: actor.uid,
          actorEmail: clean(actor.email, 254).toLowerCase(), actorRole: actor.role,
          action: 'limpieza_foto_perfil_fallida', entityType: 'usuario', entityId: uid,
          publicId, sourceEventId: auditId, result: 'error', error: cleanupError,
        }),
        currentDocument: { exists: false },
      }]);
    }
    return jsonResponse({ ok: true, uid, photoURL: '', auditId, cleanup, cleanupError }, 200, origin, requestUrl);
  } catch (error) {
    const status = Number(error?.status) || (error?.code === 'version_conflict' ? 409 : 400);
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo quitar la foto').slice(0, 300) }, status, origin, requestUrl);
  }
}
