// =============================================================
// TINTIN ACCESORIOS — Perfil de usuario: única fuente de verdad
// =============================================================
// Antes existían dos implementaciones casi idénticas de "crear el perfil si
// no existe, si no actualizar lastLogin": guardarUsuario() en login.html
// (Google) y ensureUserDocForEmailLogin() en js/email/correo-autenticacion.js (código por
// correo). Se desincronizaban con cada cambio — de hecho la de Google nunca
// llegó a guardar el método de registro. Acá vive una sola versión, con el
// método de acceso como parámetro.
//
// Los perfiles viven en Firestore (colección `users`), que es la autoridad
// canónica. Superadmin los escucha en tiempo real y Sheets mantiene un espejo:
// después de cada commit se dispara una réplica best-effort de la versión que
// el servidor vuelve a leer desde Firestore.

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SUPER_ADMIN } from "../auth/roles.js?v=tintin-20260821-accounts-phase-a-1";
import { customerIdForUid, ACCOUNT_CONTRACT } from '../auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';
import { pushUserProfileToMirrorsSoon } from '../sync/sincronizacion-usuario.js?v=tintin-20260903-user-mirror-push-1';

/** Métodos de acceso válidos, tal como quedan guardados en `users.provider`. */
export const AUTH_METHOD = {
  GOOGLE: 'google',
  EMAIL: 'emailOtp',
};

/**
 * Método con el que se registró un perfil ya guardado.
 *
 * Los perfiles creados por Google antes de este cambio no tienen el campo
 * `provider`, porque la versión vieja de guardarUsuario() nunca lo escribía.
 * Para esos, la ausencia del campo se interpreta como Google: es el único
 * método que podía crear un perfil sin marcarlo (el de correo siempre grabó
 * `emailOtp`).
 */
export function getRegisteredMethod(profileData) {
  return profileData?.provider === AUTH_METHOD.EMAIL ? AUTH_METHOD.EMAIL : AUTH_METHOD.GOOGLE;
}

/**
 * Crea el perfil la primera vez, o sólo refresca lastLogin las siguientes.
 *
 * Nunca pisa datos ya guardados (nombre, teléfono, dirección, rol, bloqueo):
 * un login no es el lugar donde se editan. Google y PIN son métodos de acceso
 * de una misma identidad Firebase, no tipos de cuenta excluyentes.
 *
 * @param {object} db        Instancia de Firestore.
 * @param {object} user      Usuario de Firebase Auth ya autenticado.
 * @param {string} method    AUTH_METHOD.GOOGLE | AUTH_METHOD.EMAIL
 */
export async function ensureUserProfile(db, user, method) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const role = user.email === SUPER_ADMIN ? 'superadmin' : 'client';
    const welcomePending = role === 'client';
    await setDoc(ref, {
      // Google entrega un nombre; el correo no entrega ninguno. En los dos
      // casos el setup posterior lo confirma o lo pide antes de darlo por
      // bueno — acá sólo se deja el valor de partida.
      name: method === AUTH_METHOD.GOOGLE ? (user.displayName || '') : '',
      email: user.email,
      customerId: customerIdForUid(user.uid),
      identityVersion: ACCOUNT_CONTRACT.identityVersion,
      profileStatus: 'incomplete',
      phone: '',
      photoURL: method === AUTH_METHOD.GOOGLE ? (user.photoURL || '') : '',
      role,
      provider: method,
      authMethods: [method],
      lastAuthMethod: method,
      onboardingCompleted: !welcomePending,
      welcomeTutorialSeen: !welcomePending,
      welcomeTutorialPending: welcomePending,
      welcomeTutorialVersion: 'home-welcome-v4-unified',
      blocked: false,
      purchaseCount: 0,
      totalSpent: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
    pushUserProfileToMirrorsSoon(user);
    return { role, blocked: false, isNew: true, welcomePending, method };
  }

  const data = snap.data();

  if (data.profileStatus === 'deleted' || data.deleted === true) {
    return { role: 'client', blocked: true, deleted: true, isNew: false, welcomePending: false, method };
  }

  if (user.email === SUPER_ADMIN && data.role !== 'superadmin') {
    await setDoc(ref, { role: 'superadmin', updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true });
    pushUserProfileToMirrorsSoon(user);
    return { role: 'superadmin', blocked: false, isNew: false, welcomePending: false, method };
  }

  const registeredMethod = getRegisteredMethod(data);
  const authMethods = [...new Set([
    ...(Array.isArray(data.authMethods) ? data.authMethods : [registeredMethod]),
    method,
  ].filter(value => Object.values(AUTH_METHOD).includes(value)))];
  const identityPatch = {
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    lastAuthMethod: method,
    authMethods,
  };
  // Migración progresiva: UID sigue siendo la clave de Auth y el customerId
  // comercial se deriva una sola vez de ese identificador aleatorio. No se
  // inventan username ni fecha de nacimiento para perfiles históricos.
  if (!data.customerId) {
    identityPatch.customerId = customerIdForUid(user.uid);
    identityPatch.identityVersion = ACCOUNT_CONTRACT.identityVersion;
    identityPatch.profileStatus = 'legacy';
  }
  setDoc(ref, identityPatch, { merge: true })
    .then(() => pushUserProfileToMirrorsSoon(user))
    .catch(error => console.warn('[user-profile] No se pudo actualizar lastLogin:', error));

  const role = data.role || 'client';
  const welcomePending = role === 'client' && !data.welcomeTutorialSeen && data.onboardingCompleted !== true;
  return { role, blocked: !!data.blocked, isNew: false, welcomePending, method, authMethods };
}

/** Mismo chequeo de cuenta bloqueada para los dos métodos de acceso. */
export async function isBlockedAccount(db, uid, email) {
  if (email === SUPER_ADMIN) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
}
