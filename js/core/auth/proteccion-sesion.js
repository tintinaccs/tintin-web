// =============================================
// TINTIN ACCESORIOS — Expiración de sesión
// =============================================
// Firebase Auth mantiene la sesión y renueva su token. El Super Admin conserva
// su sesión hasta cerrar manualmente; el resto de las cuentas debe volver a
// autenticarse después de 30 minutos sin actividad.

import { auth } from "../firebase/firebase.js?v=tintin-20260903-app-check-singleton-2";
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
  if (!user) { currentRole = ''; roleUid = ''; clearSessionStart(); return; }
  if (roleUid !== user.uid) {
    try {
      currentRole = await getUserRole(user.uid, user.email);
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
    clearSessionStart();
    try { await signOut(auth); } catch {}
    goToExpiredLogin();
  }
}

function goToExpiredLogin() {
  if (location.pathname === '/login' || location.pathname.endsWith('/login.html') || location.pathname.endsWith('login.html')) return;
  location.href = '/login?expired=1';
}

onAuthStateChanged(auth, enforce);
setInterval(() => { if (auth.currentUser) enforce(auth.currentUser); }, CHECK_INTERVAL_MS);
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
  window.addEventListener(eventName, recordActivity, { passive: true });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) recordActivity();
});

// Una cuenta sin nombre, teléfono ni ubicación no puede navegar logueada:
// se la manda a terminar el alta. Va enganchado acá porque esta hoja ya se
// carga en todas las páginas — no hace falta otro <script> por página ni
// otro guardia global (ver js/pages/profile/control-acceso-perfil.js).
startProfileGate();
