// =============================================================
// TINTIN ACCESORIOS — Sin perfil completo no se usa la cuenta
// =============================================================
// Una cuenta con sesión iniciada y datos obligatorios faltantes (nombre,
// teléfono, usuario, fecha de nacimiento o ubicación) no puede usar el sitio:
// cualquier página autenticada la devuelve al login, donde sólo se muestra el
// paso con lo que falta. Aplica igual a cuentas nuevas y a cuentas que el
// equipo eliminó y volvieron a registrarse (nacen con perfil `incomplete`).
//
// Alcance: sólo cuentas con rol `client`. El personal (admin, agente,
// viewer) y el Super Admin entran igual — bloquearles el panel por no tener
// una dirección de entrega cargada no tendría sentido. Quien no tiene sesión
// sigue mirando la tienda sin restricciones.
//
// Salida: el modal del alta permite cerrar la sesión; la persona vuelve a la
// tienda como visitante, sin cuenta.

import { auth, db } from "../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1";
import { AUTH_STATES, subscribeSession } from "../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1";
import { recordAuthDiagnostic } from "../../core/auth/diagnostico-sesion.js?v=tintin-20260918-auth-diagnostics-1";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getProfileCompletionPlan } from "./configuracion-inicial-perfil.mjs?v=tintin-20261001-ultimos-datos-1";
import { SUPER_ADMIN } from "../../core/auth/roles.js?v=tintin-20260916-final-polish-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1";

// Evita releer el perfil en cada navegación de la misma sesión. Se guarda el
// uid y no un simple `true`: si se cambia de cuenta en la misma pestaña, el
// valor deja de coincidir y se vuelve a verificar.
const COMPLETE_KEY = 'tt_profile_complete_uid';
const STAFF_ROLES = ['superadmin', 'admin', 'agent', 'viewer'];

function markComplete(uid) {
  try { sessionStorage.setItem(COMPLETE_KEY, uid); } catch {}
}

function alreadyKnownComplete(uid) {
  try { return sessionStorage.getItem(COMPLETE_KEY) === uid; } catch { return false; }
}

/** Limpia la marca — al cerrar sesión, para que la próxima vuelva a verificar. */
export function clearProfileGateCache() {
  try { sessionStorage.removeItem(COMPLETE_KEY); } catch {}
}

// El correo de una cuenta bloqueada viaja al login (sólo en esta pestaña)
// para que el botón de WhatsApp lo incluya después de cerrar la sesión.
const BLOCKED_EMAIL_KEY = 'tt_blocked_email';

function rememberBlockedEmail(email) {
  try { sessionStorage.setItem(BLOCKED_EMAIL_KEY, String(email || '')); } catch {}
}

/** Devuelve (y borra) el correo de la cuenta bloqueada recién expulsada. */
export function consumeBlockedEmail() {
  try {
    const email = sessionStorage.getItem(BLOCKED_EMAIL_KEY) || '';
    sessionStorage.removeItem(BLOCKED_EMAIL_KEY);
    return email;
  } catch { return ''; }
}

/**
 * Nombre de la página actual, sin carpeta ni extensión heredada.
 *
 * Cloudflare Pages sirve las páginas mediante rutas limpias. Normalizamos el
 * último segmento para reconocer correctamente login y checkout incluso si
 * llega una URL antigua que Cloudflare todavía redirige por compatibilidad.
 */
function currentPageName() {
  const last = location.pathname.split('/').pop() || 'index';
  return last.replace(/\.html$/, '').toLowerCase();
}

function isLoginPage() {
  return currentPageName() === 'login';
}

/**
 * El guardia corre en todas las páginas con sesión salvo login, Mi perfil
 * (donde también se puede completar la cuenta) y el panel del personal.
 */
function isExemptPage() {
  const page = currentPageName();
  return page === 'login' || page === 'perfil' || page.startsWith('admin');
}

let redirecting = false;

function goCompleteProfile() {
  if (redirecting) return;
  redirecting = true;

  // `from` conserva a dónde quería ir, para devolverla ahí apenas termine.
  // Nunca se arrastra un `from` previo: encadenarlo fue lo que produjo el
  // bucle histórico. Si el destino terminara siendo el propio login, se va
  // al login limpio sin parámetros para que el guardia nunca pueda colgarlo.
  const page = currentPageName();
  if (page === 'login') {
    recordAuthDiagnostic('REDIRECT_REASON', { source: 'profile-gate', reason: 'profile-incomplete' });
    recordAuthDiagnostic('REDIRECT_REQUESTED', { source: 'profile-gate', destination: 'login' });
    location.replace('/login');
    return;
  }

  const from = `${location.pathname || `/${page}`}${location.search || ''}${location.hash || ''}`;
  recordAuthDiagnostic('REDIRECT_REASON', { source: 'profile-gate', reason: 'profile-incomplete' });
  recordAuthDiagnostic('REDIRECT_REQUESTED', { source: 'profile-gate', destination: 'login' });
  location.replace(`/login?from=${encodeURIComponent(from)}`);
}

function isSuperAdminUser(user) {
  return String(user?.email || '').trim().toLowerCase() === SUPER_ADMIN.toLowerCase();
}

let leaving = false;

// Bloqueo: cierra la sesión en el acto y lleva al aviso con WhatsApp. Se
// dispara al cargar la página y también si el Super Admin bloquea la cuenta
// mientras la persona está navegando (el perfil se escucha en vivo).
async function leaveBlockedAccount(user) {
  if (leaving) return;
  leaving = true;
  redirecting = true;
  recordAuthDiagnostic('REDIRECT_REASON', { source: 'profile-gate', reason: 'account-blocked' });
  rememberBlockedEmail(user?.email);
  clearProfileGateCache();
  try { await signOut(auth); } catch {}
  location.replace('/login?blocked=1');
}

function enforceProfileComplete(user, data) {
  if (redirecting) return;
  if (alreadyKnownComplete(user.uid)) return;

  // Sólo el personal conocido queda exento. Un rol vacío, mal escrito o
  // desconocido es una clienta: antes cualquier valor distinto de 'client'
  // la dejaba navegar sin completar sus datos.
  const rawRole = String(data.role || '').trim().toLowerCase();
  const role = STAFF_ROLES.includes(rawRole) ? rawRole : 'client';
  if (role !== 'client') {
    markComplete(user.uid);
    return;
  }

  const plan = getProfileCompletionPlan({
    profile: data,
    user,
    role,
    superAdminEmail: SUPER_ADMIN,
  });

  if (plan.skip) {
    markComplete(user.uid);
    return;
  }

  goCompleteProfile();
}

let watchedUid = '';
let stopWatching = null;

function watchProfile(user) {
  if (!user || user.isAnonymous || isSuperAdminUser(user)) {
    if (user && isSuperAdminUser(user)) markComplete(user.uid);
    if (stopWatching) { stopWatching(); stopWatching = null; watchedUid = ''; }
    return;
  }
  if (watchedUid === user.uid && stopWatching) return;
  if (stopWatching) stopWatching();
  watchedUid = user.uid;
  stopWatching = onSnapshot(doc(db, 'users', user.uid), snapshot => {
    const data = snapshot.exists() ? (snapshot.data() || {}) : {};
    if (data.blocked === true) {
      leaveBlockedAccount(user);
      return;
    }
    enforceProfileComplete(user, data);
  }, error => {
    // Sin poder leer el perfil no se bloquea la navegación: un problema de
    // red no tiene por qué dejar a alguien afuera de la tienda. El bloqueo
    // real lo siguen imponiendo las reglas de Firestore y el servidor.
    console.warn('[profile-gate] No se pudo verificar el perfil:', error);
  });
}

export function startProfileGate() {
  if (isExemptPage()) return;
  recordAuthDiagnostic('AUTH_RESTORE_START', { source: 'profile-gate' });
  subscribeSession(snapshot => {
    if (snapshot.status === AUTH_STATES.RESTORING || snapshot.status === AUTH_STATES.UNKNOWN) return;
    recordAuthDiagnostic('AUTH_STATE_READY', { source: 'profile-gate', authState: snapshot.status });
    recordAuthDiagnostic('COORDINATOR_READY', { source: 'profile-gate', sessionCoordinatorState: snapshot.status });
    if (snapshot.user) recordAuthDiagnostic('AUTH_USER_AVAILABLE', { source: 'profile-gate', authState: snapshot.status });
    if (!snapshot.user) clearProfileGateCache();
    watchProfile(snapshot.user);
  });
}
