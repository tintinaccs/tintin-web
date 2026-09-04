// =============================================
// TINTIN ACCESORIOS — Expiración de sesión
// =============================================
// Firebase Auth mantiene la sesión y renueva su token. El Super Admin conserva
// su sesión hasta cerrar manualmente; el resto de las cuentas debe volver a
// autenticarse después de 30 minutos sin actividad.

import { auth } from "../firebase/firebase.js?v=tintin-20260904-auth-runtime-cache-reset-1";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getUserRole } from "./roles.js?v=tintin-20260821-accounts-phase-a-1";
import { startProfileGate } from "../../pages/profile/control-acceso-perfil.js?v=tintin-20260901-username-visible-1";

const STAFF_INACTIVITY_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'tt_session_last_activity_at';
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;
let currentRole = '';
let roleUid = '';
let lastActivityWrite = 0;
let sessionCheckTimer = 0;
let enforceSequence = 0;
let redirectingToLogin = false;

export function markSessionStart() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
}

function clearSessionStart() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function readSessionStart() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch {}
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function recordActivity() {
  if (!currentRole || currentRole === 'superadmin') return;
  const now = Date.now();
  if (now - lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
  lastActivityWrite = now;
  try { localStorage.setItem(STORAGE_KEY, String(now)); } catch {}
}

async function enforce(user) {
  const sequence = ++enforceSequence;
  if (!user) { currentRole = ''; roleUid = ''; clearSessionStart(); return; }
  if (roleUid !== user.uid) {
    try {
      const nextRole = await getUserRole(user.uid, user.email);
      if (sequence !== enforceSequence || auth.currentUser?.uid !== user.uid) return;
      currentRole = nextRole;
      roleUid = user.uid;
    } catch {
      // Un fallo transitorio leyendo el rol no debe expulsar a una clienta.
      return;
    }
  }
  // La sesión que inicia el Super Admin es persistente. No se debe cerrar
  // automáticamente por inactividad ni expulsar a tintinaccs del panel.
  if (currentRole === 'superadmin') return;
  const startedAt = readSessionStart();
  if (startedAt === null) {
    markSessionStart();
    return;
  }
  if (Date.now() - startedAt > STAFF_INACTIVITY_MS) {
    if (redirectingToLogin) return;
    redirectingToLogin = true;
    clearSessionStart();
    try { await signOut(auth); } catch {}
    goToExpiredLogin();
  }
}

function goToExpiredLogin() {
  if (redirectingToLogin === false) return;
  if (location.pathname === '/login' || location.pathname.endsWith('/login.html') || location.pathname.endsWith('login.html')) return;
  location.href = '/login?expired=1';
}

function stopSessionChecks() {
  if (sessionCheckTimer) window.clearInterval(sessionCheckTimer);
  sessionCheckTimer = 0;
}

function startSessionChecks() {
  stopSessionChecks();
  if (document.hidden || !auth.currentUser) return;
  sessionCheckTimer = window.setInterval(() => {
    if (document.hidden || !auth.currentUser) return;
    void enforce(auth.currentUser);
  }, CHECK_INTERVAL_MS);
}

onAuthStateChanged(auth, user => {
  if (!user) {
    redirectingToLogin = false;
    stopSessionChecks();
  } else {
    void enforce(user);
    startSessionChecks();
  }
});
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
  window.addEventListener(eventName, recordActivity, { passive: true });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSessionChecks();
  else {
    recordActivity();
    startSessionChecks();
    if (auth.currentUser) void enforce(auth.currentUser);
  }
});

// Una cuenta sin nombre, teléfono ni ubicación no puede navegar logueada:
// se la manda a terminar el alta. Va enganchado acá porque esta hoja ya se
// carga en todas las páginas — no hace falta otro <script> por página ni
// otro guardia global (ver js/pages/profile/control-acceso-perfil.js).
startProfileGate();
