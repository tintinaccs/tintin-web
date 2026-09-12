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
import { SUPER_ADMIN } from "../auth/roles.js?v=tintin-20260821-accounts-phase-a-3";
import { customerIdForUid, ACCOUNT_CONTRACT } from '../auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';

/** Métodos de acceso válidos, tal como quedan guardados en `users.provider`. */
export const AUTH_METHOD = {
  GOOGLE: 'google',
  EMAIL: 'emailOtp',
};

export function getRegisteredMethod(profileData) {
  return profileData?.provider === AUTH_METHOD.EMAIL ? AUTH_METHOD.EMAIL : AUTH_METHOD.GOOGLE;
}

export async function ensureUserProfile(db, user, method) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const normalizedEmail = String(user.email || '').trim().toLowerCase();

  if (!snap.exists()) {
    const role = normalizedEmail === SUPER_ADMIN.toLowerCase() ? 'superadmin' : 'client';
    const welcomePending = role === 'client';
    await setDoc(ref, {
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
    return { role, blocked: false, isNew: true, welcomePending, method };
  }

  const data = snap.data();

  if (data.profileStatus === 'deleted' || data.deleted === true) {
    return { role: 'client', blocked: true, deleted: true, isNew: false, welcomePending: false, method };
  }

  if (normalizedEmail === SUPER_ADMIN.toLowerCase() && data.role !== 'superadmin') {
    setDoc(ref, { role: 'superadmin', updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true })
      .catch(error => console.warn('[user-profile] No se pudo reparar el rol del Super Admin en Firestore:', error));
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

  // Un login existente no puede cambiar el estado comercial del perfil.
  // El bootstrap legacy sólo aplica a documentos realmente anteriores al
  // contrato, es decir, cuando faltan customerId Y profileStatus. Si el perfil
  // ya declara `active` o `incomplete`, preservamos ese estado y dejamos la
  // migración de identidad fuera del login para no degradar onboarding.
  if (!data.customerId && !data.profileStatus) {
    identityPatch.customerId = customerIdForUid(user.uid);
    identityPatch.identityVersion = ACCOUNT_CONTRACT.identityVersion;
    identityPatch.profileStatus = 'legacy';
  }

  await setDoc(ref, identityPatch, { merge: true });

  const role = data.role || 'client';
  const welcomePending = role === 'client' && !data.welcomeTutorialSeen && data.onboardingCompleted !== true;
  return { role, blocked: !!data.blocked, isNew: false, welcomePending, method, authMethods };
}

export async function isBlockedAccount(db, uid, email) {
  if (email === SUPER_ADMIN) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
}
