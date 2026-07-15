// =============================================
// TINTIN ACCESORIOS — Login por correo (Firebase Email Link / enlace mágico)
// Comparte lógica entre login.html y checkout.html — mismo criterio de
// creación/actualización de usuario y de cuenta bloqueada que ya usa el
// login con Google (ver login.html → guardarUsuario/checkBlocked), para que
// los dos métodos terminen exactamente en el mismo lugar con los mismos
// permisos. No depende de ningún backend propio: Firebase Auth genera,
// manda y valida el enlace — acá solo se completa el inicio de sesión y se
// sincroniza el documento de Firestore.
// =============================================
import { auth, db } from "./firebase.js";
import {
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { SUPER_ADMIN } from "./roles.js";

const STORAGE_EMAIL_KEY = 'tt_email_link_pending';

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * Manda el enlace de acceso al correo escrito. `continueUrl` tiene que ser
 * una URL absoluta de este mismo sitio (Firebase vuelve ahí después de
 * validar el enlace) — normalmente `login.html?from=...`, para reusar
 * exactamente el mismo camino de regreso que ya usa Google.
 */
export async function sendLoginEmailLink(email, continueUrl) {
  await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
  // Se guarda el email tipeado para completar el inicio de sesión sin
  // volver a pedirlo cuando abra el enlace en ESTE MISMO navegador —
  // Firebase lo exige como paso de seguridad extra (confirma que quien abre
  // el enlace es quien lo pidió). Si lo abre en otro dispositivo/navegador
  // no vamos a tener este dato, así que se le vuelve a preguntar el email
  // en completeEmailLinkSignIn.
  try { window.localStorage.setItem(STORAGE_EMAIL_KEY, email); } catch {}
}

/** ¿La URL actual es un enlace de acceso válido de Firebase? */
export function isEmailLinkUrl() {
  return isSignInWithEmailLink(auth, window.location.href);
}

/**
 * Completa el inicio de sesión a partir del enlace ya abierto. Si no se le
 * pasa un email explícito, usa el que quedó guardado en este navegador al
 * pedir el enlace. Firebase mismo rechaza el enlace si venció o ya se usó
 * — de eso no hay que ocuparse acá, solo de traducir el error.
 * @param {string} [emailOverride] - úsalo si el email guardado no está disponible (otro dispositivo)
 */
export async function completeEmailLinkSignIn(emailOverride) {
  let storedEmail = emailOverride;
  if (!storedEmail) {
    try { storedEmail = window.localStorage.getItem(STORAGE_EMAIL_KEY); } catch {}
  }
  if (!storedEmail) {
    const err = new Error('Falta confirmar el email para completar el ingreso.');
    err.code = 'tintin/missing-email-for-link';
    throw err;
  }
  const cred = await signInWithEmailLink(auth, storedEmail, window.location.href);
  try { window.localStorage.removeItem(STORAGE_EMAIL_KEY); } catch {}
  return cred.user;
}

/**
 * Crea o actualiza users/{uid} para un login por correo — mismo criterio
 * que guardarUsuario() de login.html (Google): la primera vez crea el
 * perfil como 'client' (o 'superadmin' si es literalmente
 * tintinaccs@gmail.com), las veces siguientes SOLO toca
 * lastLogin/updatedAt — nunca pisa role, blocked, name ni ningún dato ya
 * guardado por otro proveedor (Google incluido, si la cuenta ya existía).
 */
export async function ensureUserDocForEmailLogin(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const role = user.email === SUPER_ADMIN ? 'superadmin' : 'client';
    const welcomePending = role === 'client';
    await setDoc(ref, {
      name: user.displayName || '',
      email: user.email,
      phone: '',
      photoURL: user.photoURL || '',
      role,
      provider: 'emailLink',
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
    return { role, blocked: false, isNew: true, welcomePending };
  }
  const data = snap.data();
  if (user.email === SUPER_ADMIN && data.role !== 'superadmin') {
    await setDoc(ref, { role: 'superadmin', updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true });
    return { role: 'superadmin', blocked: false, isNew: false };
  }
  await setDoc(ref, { updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true });
  const role = data.role || 'client';
  const welcomePending = role === 'client' && !data.welcomeTutorialSeen && data.onboardingCompleted !== true;
  return { role, blocked: !!data.blocked, isNew: false, welcomePending };
}

/** Mismo chequeo de cuenta bloqueada que usa el login con Google (Fase E). */
export async function checkBlockedEmailLogin(uid, email) {
  if (email === SUPER_ADMIN) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
}

/** Traduce los códigos de error de Firebase Auth a mensajes en español para la clienta. */
export function emailLinkErrorMessage(code) {
  const msgs = {
    'auth/invalid-email': 'Ese correo no tiene un formato válido.',
    'auth/missing-email': 'Escribí tu correo antes de continuar.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada. Escribinos por WhatsApp.',
    'auth/network-request-failed': 'Sin conexión — revisá tu internet e intentá de nuevo.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá un momento e intentá de nuevo.',
    'auth/invalid-action-code': 'Este enlace ya venció o no es válido. Pedí uno nuevo.',
    'auth/expired-action-code': 'Este enlace ya venció. Pedí uno nuevo.',
    'tintin/missing-email-for-link': 'Abrí el enlace desde el mismo navegador donde lo pediste, o escribí tu correo para confirmar.',
  };
  return msgs[code] || 'Ocurrió un error. Intentá de nuevo.';
}
