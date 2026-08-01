// =============================================================
// TINTIN ACCESORIOS — Login por correo (código de 6 dígitos)
// Comparte lógica entre login.html y checkout.html — mismo criterio de
// creación/actualización de usuario y de cuenta bloqueada que ya usa el
// login con Google (ver login.html → guardarUsuario/checkBlocked), para que
// los dos métodos terminen exactamente en el mismo lugar con los mismos
// permisos. El código se genera, guarda y valida en un backend propio
// (functions/api/email-otp-send.js / email-otp-verify.js, Cloudflare Pages
// Functions) — Firebase Auth solo entra al final, para firmar la sesión real
// con el Custom Token que devuelve la verificación.
// =============================================================
import { auth, db } from "./firebase.js?v=tintin-20260730-appcheck-stable-4";
import {
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { SUPER_ADMIN } from "./roles.js?v=tintin-20260716-cloudinary-fix-1";

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const err = new Error(data?.error || 'request_failed');
    err.code = data?.error || 'request_failed';
    err.retryAfterSeconds = data?.retryAfterSeconds;
    err.attemptsRemaining = data?.attemptsRemaining;
    throw err;
  }
  return data;
}

/** Pide que se mande un código de 6 dígitos al correo (vence en 5 minutos). */
export async function requestOtpCode(email) {
  await postJson('/api/email-otp-send', { email });
}

/**
 * Verifica el código contra el backend y, si es correcto, firma la sesión
 * real de Firebase Auth con el Custom Token que devuelve — recién ahí existe
 * un usuario autenticado de verdad, nunca antes.
 */
export async function verifyOtpCode(email, code) {
  const data = await postJson('/api/email-otp-verify', { email, code });
  const cred = await signInWithCustomToken(auth, data.customToken);
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
      name: '',
      email: user.email,
      phone: '',
      photoURL: '',
      role,
      provider: 'emailOtp',
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
  // Son marcas informativas y no conceden acceso. Se guardan sin bloquear la
  // navegación de una cuenta cuyo perfil ya fue leído y validado.
  setDoc(ref, { updatedAt: serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true })
    .catch(error => console.warn('[email-auth] No se pudo actualizar lastLogin:', error));
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

/** Traduce los códigos de error del login por correo a mensajes en español. */
export function otpErrorMessage(code) {
  const msgs = {
    'invalid_email': 'Escribí un correo con formato válido (ej: tu@email.com).',
    'invalid_code_format': 'El código tiene que tener 6 dígitos.',
    'cooldown_active': 'Esperá unos segundos antes de pedir otro código.',
    'daily_limit_exceeded': 'Se alcanzó el límite de códigos por hoy para este correo. Probá más tarde o usá Google.',
    'code_not_found': 'Ese código no es válido. Pedí uno nuevo.',
    'code_expired': 'Ese código venció. Pedí uno nuevo.',
    'code_mismatch': 'Código incorrecto. Revisá los 6 dígitos e intentá de nuevo.',
    'too_many_attempts': 'Demasiados intentos con este código. Pedí uno nuevo.',
    'origin_not_allowed': 'No se pudo validar el pedido. Recargá la página e intentá de nuevo.',
    'resend_not_configured': 'El envío de correos no está disponible en este momento. Probá con "Continuar con Google".',
  };
  return msgs[code] || 'Ocurrió un error. Intentá de nuevo.';
}
