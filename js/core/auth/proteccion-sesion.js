// =============================================
// TINTIN ACCESORIOS — Expiración de sesión
// =============================================
// Firebase Auth por sí solo mantiene la sesión activa indefinidamente
// (renueva el token solo). Acá se agrega un límite propio: pasados ~30
// minutos desde que la persona inició sesión, se cierra la sesión sola y
// hay que volver a loguearse — para todos los roles excepto el Super
// Admin (tintinaccs@gmail.com), que nunca se desloguea sola por esto (es
// quien tiene que poder quedarse trabajando en el panel sin cortes). Se
// importa una sola vez desde cada página pública y desde admin.html;
// marca el inicio real del login solo login.html (markSessionStart),
// pero el chequeo corre en todas.

import { auth } from "../firebase/firebase.js?v=tintin-20260730-appcheck-stable-4";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { SUPER_ADMIN } from "./roles.js?v=tintin-20260716-cloudinary-fix-1";
import { startProfileGate } from "../../pages/profile/control-acceso-perfil.js?v=tintin-20260803-profile-gate-1";

const SESSION_DURATION_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'tt_session_started_at';
const CHECK_INTERVAL_MS = 30 * 1000;

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

function goToExpiredLogin() {
  if (location.pathname.endsWith('/login.html') || location.pathname.endsWith('login.html')) return;
  location.href = 'login.html?expired=1';
}

async function enforce(user) {
  if (!user) { clearSessionStart(); return; }
  if (String(user.email || '').toLowerCase() === SUPER_ADMIN) { clearSessionStart(); return; }
  const startedAt = readSessionStart();
  if (startedAt === null) {
    // Sesión ya activa sin marca propia (login anterior a este cambio, u
    // otra pestaña que la vació) — se fija ahora en vez de dejarla sin
    // límite de tiempo.
    markSessionStart();
    return;
  }
  if (Date.now() - startedAt > SESSION_DURATION_MS) {
    clearSessionStart();
    try { await signOut(auth); } catch {}
    goToExpiredLogin();
  }
}

onAuthStateChanged(auth, enforce);
setInterval(() => { if (auth.currentUser) enforce(auth.currentUser); }, CHECK_INTERVAL_MS);

// Una cuenta sin nombre, teléfono ni ubicación no puede navegar logueada:
// se la manda a terminar el alta. Va enganchado acá porque esta hoja ya se
// carga en todas las páginas — no hace falta otro <script> por página ni
// otro guardia global (ver js/pages/profile/control-acceso-perfil.js).
startProfileGate();
