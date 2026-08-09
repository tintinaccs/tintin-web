import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  SUPERADMIN_EMAIL
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields,
  deleteFirebaseUser,
  firestoreAdminDelete,
  firestoreAdminGet,
  firestoreAdminList
} from '../../cloudflare/firebase-admin-ligero.js';

const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

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
    await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || raw.length > 2000) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    const uid = String(body.uid || '').trim();
    if (!UID_PATTERN.test(uid)) throw new Error('Usuario inválido.');

    const userDoc = await firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`);
    const user = userDoc ? decodeFirestoreFields(userDoc.fields) : {};
    if (String(user.email || '').trim().toLowerCase() === SUPERADMIN_EMAIL) {
      throw new Error('La cuenta Super Admin está protegida.');
    }

    // Revoca primero el acceso; los reintentos son idempotentes si Auth ya no existe.
    await deleteFirebaseUser(env, uid);
    const cartDocs = await firestoreAdminList(env, `users/${encodeURIComponent(uid)}/cart`, 300);
    const favoriteDocs = await firestoreAdminList(env, `users/${encodeURIComponent(uid)}/favorites`, 300);
    await Promise.all([...cartDocs.map(item => {
      const id = String(item.name || '').split('/').pop();
      return id ? firestoreAdminDelete(env, `users/${encodeURIComponent(uid)}/cart/${encodeURIComponent(id)}`) : null;
    }), ...favoriteDocs.map(item => {
      const id = String(item.name || '').split('/').pop();
      return id ? firestoreAdminDelete(env, `users/${encodeURIComponent(uid)}/favorites/${encodeURIComponent(id)}`) : null;
    })]);
    const phone = String(user.phone || user.phoneNormalized || '').replace(/\D/g, '');
    if (phone) await firestoreAdminDelete(env, `phoneReservations/${encodeURIComponent(phone)}`);
    await firestoreAdminDelete(env, `users/${encodeURIComponent(uid)}`);
    return jsonResponse({ ok: true, deleted: { auth: true, profile: true, cart: cartDocs.length, favorites: favoriteDocs.length, phone: Boolean(phone) } }, 200, origin, requestUrl);
  } catch (error) {
    console.error('[admin-delete-user]', error?.message || error);
    const safeMessage = /^(Solicitud inválida|Usuario inválido|La cuenta Super Admin está protegida)\.?$/.test(String(error?.message || ''))
      ? error.message
      : 'No se pudo eliminar el usuario.';
    return jsonResponse({ ok: false, error: safeMessage }, 400, origin, requestUrl);
  }
}
