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
  ensureUserProfile, isBlockedAccount, AUTH_METHOD
} from "./user-profile-store.js?v=tintin-20260803-profile-store-1";

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
    console.error(`[email-auth] ${path} respondió ${response.status}:`, err.code);
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
 * Crea o actualiza users/{uid} para un login por correo. La lógica vive en
 * js/user-profile-store.js, compartida con el login de Google — acá sólo se
 * fija el método de acceso.
 */
export async function ensureUserDocForEmailLogin(user) {
  return ensureUserProfile(db, user, AUTH_METHOD.EMAIL);
}

/** Mismo chequeo de cuenta bloqueada que usa el login con Google (Fase E). */
export async function checkBlockedEmailLogin(uid, email) {
  return isBlockedAccount(db, uid, email);
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
    'google_account_exists': 'Esta cuenta ya usa Google. Iniciá sesión con el botón de Google.',
    'login_failed': 'El código era correcto, pero no pudimos completar el ingreso. Probá de nuevo en unos segundos.',
  };
  return msgs[code] || 'Ocurrió un error. Intentá de nuevo.';
}
