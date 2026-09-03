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
import { auth, db } from "../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-3";
import {
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  ensureUserProfile, isBlockedAccount, AUTH_METHOD
} from "../core/store/perfil-usuario.js?v=tintin-20260821-accounts-phase-a-1";
import { apiUrl } from "../core/firebase/origen-funciones.js?v=tintin-20260716-cloudinary-fix-1";

const LOCAL_FUNCTIONS_ORIGIN = 'https://tintinaccesorios.pages.dev';

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/** Arma el body del POST según el identificador sea un email o un username. */
function identifierBody(identifier) {
  const value = String(identifier || '').trim();
  return isValidEmailFormat(value) ? { email: value.toLowerCase() } : { username: value };
}

async function postJson(name, body) {
  // apiUrl() y no una ruta relativa: el sitio también se publica en GitHub
  // Pages, donde las funciones /api/* no existen y un fetch relativo da 404
  // (ver js/core/firebase/origen-funciones.js).
  const relativePath = apiUrl(name);
  // El servidor local de pruebas publica HTML/JS, pero no ejecuta Pages
  // Functions. Mantener el fallback acá evita que el login por correo o
  // username intente llamar a un /api inexistente en localhost.
  const localHost = typeof window !== 'undefined' && /^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const path = localHost ? `${LOCAL_FUNCTIONS_ORIGIN}/api/${name}` : relativePath;
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (networkError) {
    // fetch sólo rechaza cuando el pedido no llegó a destino: sin conexión,
    // DNS caído, o una extensión del navegador bloqueando la llamada. No es
    // lo mismo que un error del servidor y no debe leerse igual.
    console.error(`[email-auth] ${path} no se pudo enviar:`, networkError);
    const err = new Error('network_error');
    err.code = 'network_error';
    throw err;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    // Una respuesta sin cuerpo JSON (502/504 de la plataforma, HTML de error)
    // dejaba `undefined` como código y caía en el mensaje genérico.
    const code = data?.error || (response.status >= 500 ? 'server_error' : 'request_failed');
    const err = new Error(code);
    err.code = code;
    err.status = response.status;
    err.retryAfterSeconds = data?.retryAfterSeconds;
    err.attemptsRemaining = data?.attemptsRemaining;
    console.error(`[email-auth] ${path} respondió ${response.status}:`, code, data?.detail || '');
    throw err;
  }
  return data;
}

/**
 * Pide que se mande un código de 6 dígitos al correo (vence en 5 minutos).
 * `identifier` puede ser el email de la cuenta o su username de login.
 */
export async function requestOtpCode(identifier) {
  await postJson('email-otp-send', identifierBody(identifier));
}

/**
 * Verifica el código contra el backend y, si es correcto, firma la sesión
 * real de Firebase Auth con el Custom Token que devuelve — recién ahí existe
 * un usuario autenticado de verdad, nunca antes. `identifier` puede ser el
 * email de la cuenta o su username de login.
 */
export async function verifyOtpCode(identifier, code) {
  const data = await postJson('email-otp-verify', { ...identifierBody(identifier), code });
  const cred = await signInWithCustomToken(auth, data.customToken);
  return cred.user;
}

/**
 * Crea o actualiza users/{uid} para un login por correo. La lógica vive en
 * js/core/store/perfil-usuario.js, compartida con el login de Google — acá sólo se
 * fija el método de acceso.
 */
export async function ensureUserDocForEmailLogin(user) {
  return ensureUserProfile(db, user, AUTH_METHOD.EMAIL);
}

/** Mismo chequeo de cuenta bloqueada que usa el login con Google (Fase E). */
export async function checkBlockedEmailLogin(uid, email) {
  return isBlockedAccount(db, uid, email);
}

/**
 * Traduce los códigos de error a un mensaje que explique qué pasó y qué
 * hacer. El detalle técnico queda en la consola (ver postJson): acá va sólo
 * lo que le sirve a la persona que está intentando entrar.
 */
export function otpErrorMessage(code) {
  const msgs = {
    // Correo
    'invalid_email': 'Escribí un correo con formato válido (ej: tu@email.com).',
    'email_not_allowed': 'Ese correo no puede recibir el código. Probá con otro o entrá con Google.',

    // Código
    'invalid_code_format': 'El código son 6 dígitos, sin letras ni espacios.',
    'code_not_found': 'No hay ningún código pendiente para este correo. Pedí uno nuevo.',
    'code_expired': 'Ese código venció. Pedí uno nuevo y usalo dentro de los 5 minutos.',
    'code_mismatch': 'Código incorrecto. Revisá los 6 dígitos del correo e intentá de nuevo.',
    'code_already_used': 'Ese código ya se usó. Pedí uno nuevo para volver a entrar.',
    'too_many_attempts': 'Demasiados intentos con este código. Pedí uno nuevo.',

    // Envío
    'cooldown_active': 'Esperá unos segundos antes de pedir otro código.',
    'daily_limit_exceeded': 'Se alcanzó el límite de códigos por hoy para este correo. Probá más tarde o entrá con Google.',
    'resend_not_configured': 'El envío de correos no está disponible en este momento. Entrá con "Continuar con Google".',
    'send_failed': 'No pudimos enviar el código a tu correo. Revisá que esté bien escrito e intentá de nuevo.',

    // Infraestructura
    'origin_not_allowed': 'No se pudo validar el pedido. Recargá la página e intentá de nuevo.',
    'invalid_request': 'No pudimos procesar el pedido. Recargá la página e intentá de nuevo.',
    'storage_unavailable': 'No pudimos leer tus datos en este momento. Probá de nuevo en unos segundos.',
    'login_failed': 'El código era correcto, pero no pudimos completar el ingreso. Probá de nuevo en unos segundos.',
    'server_error': 'El servidor no respondió bien. Esperá unos segundos y probá de nuevo.',
    'network_error': 'No pudimos conectarnos. Revisá tu conexión y volvé a intentar.',
  };
  return msgs[code] || 'Ocurrió un error. Intentá de nuevo.';
}
