import {
  createFirebaseCustomToken,
  decodeFirestoreFields,
  firestoreAdminFindFirstByFields,
} from './firebase-admin-ligero.js';
import { SUPER_ADMIN_EMAIL } from './contrato-cuentas-generado.js';

// Clave web pública del proyecto Firebase. No es una credencial privada: la
// misma clave ya forma parte del cliente web y del service worker de Firebase.
const FIREBASE_WEB_API_KEY = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';

function documentId(document) {
  return String(document?.name || '').split('/').pop() || '';
}

/**
 * Crea un ID token efímero para operaciones internas que necesitan pasar por
 * el mismo contrato de Apps Script que el Super Admin. No almacena contraseña,
 * refresh token ni sesión persistente en Cloudflare.
 */
export async function createSuperAdminServiceIdToken(env, { fetchImpl = fetch } = {}) {
  const userDocument = await firestoreAdminFindFirstByFields(
    env,
    'users',
    ['email'],
    SUPER_ADMIN_EMAIL,
  );
  if (!userDocument) throw new Error('No existe el perfil Firestore del Super Admin.');
  const profile = decodeFirestoreFields(userDocument.fields || {});
  const uid = String(profile?.uid || documentId(userDocument)).trim();
  if (!uid) throw new Error('El perfil del Super Admin no tiene UID.');

  const customToken = await createFirebaseCustomToken(env, uid, { maintenance: true });
  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.idToken) {
    throw new Error(`No se pudo crear la sesión efímera de mantenimiento (${response.status}).`);
  }
  return String(data.idToken);
}
