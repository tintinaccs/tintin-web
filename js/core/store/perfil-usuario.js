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
// Los perfiles viven en Firestore (colección `users`), que es donde el resto
// del sitio los lee: rol, cuenta bloqueada, reglas de seguridad, checkout y
// pedidos. Google Sheets en este proyecto sincroniza productos, no usuarios.

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SUPER_ADMIN } from "../auth/roles.js?v=tintin-20260716-cloudinary-fix-1";

/** Métodos de acceso válidos, tal como quedan guardados en `users.provider`. */
export const AUTH_METHOD = {
  GOOGLE: 'google',
  EMAIL: 'emailOtp',
};

async function registerSocialProfile(user) {
  if (!user || user.email === SUPER_ADMIN) return;
  const token = await user.getIdToken();
  const response = await fetch('/api/notifications', {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'profileCreated' }),
  });
  if (!response.ok) throw new Error(`No se pudo registrar la actividad social (${response.status})`);
}

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
 * un login no es el lugar donde se editan. Si la cuenta ya existe y se
 * registró con OTRO método, no toca nada y devuelve `wrongMethod` con el
 * método correcto, para que la pantalla indique por dónde tiene que entrar.
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
      name: method === AUTH_METHOD.GOOGLE ? (user.displayName || '') : '',
      email: user.email,
      phone: '',
      photoURL: method === AUTH_METHOD.GOOGLE ? (user.photoURL || '') : '',
      role,
      provider: method,
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
    registerSocialProfile(user).catch(error => console.warn('[user-profile] No se pudo registrar la notificación de alta:', error));
    return { role, blocked: false, isNew: true, welcomePending, method };
  }

  const data = snap.data();

  if (user.email === SUPER_ADMIN && data.role !== 'superadmin') {
    await setDoc(ref, { role: 'superadmin', updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true });
    return { role: 'superadmin', blocked: false, isNew: false, welcomePending: false, method };
  }

  const registeredMethod = getRegisteredMethod(data);
  if (registeredMethod !== method) {
    return { wrongMethod: registeredMethod };
  }

  setDoc(ref, { updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true })
    .catch(error => console.warn('[user-profile] No se pudo actualizar lastLogin:', error));

  const role = data.role || 'client';
  const welcomePending = role === 'client' && !data.welcomeTutorialSeen && data.onboardingCompleted !== true;
  return { role, blocked: !!data.blocked, isNew: false, welcomePending, method: registeredMethod };
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
