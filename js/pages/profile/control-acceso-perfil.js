// =============================================================
// TINTIN ACCESORIOS — Guardia canónico de acceso a compra
// =============================================================
// Checkout sólo se habilita cuando la sesión está resuelta y el perfil del
// cliente es apto para comprar. Si falta sesión o perfil, se conserva el
// destino solicitado y se deriva a Login, que es la única superficie dueña
// del alta/completitud y del regreso posterior.

import { db } from "../../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1";
import { subscribeAuthState } from "../../core/auth/coordinador-sesion.js?v=tintin-20260914-session-authority-1";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getProfileCompletionPlan } from "./configuracion-inicial-perfil.mjs?v=tintin-20260912-post-login-profile-1";
import { SUPER_ADMIN } from "../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-3";

const COMPLETE_KEY = 'tt_profile_complete_uid';
const GUARDED_PAGES = ['checkout'];
let redirecting = false;

function markComplete(uid) {
  try { sessionStorage.setItem(COMPLETE_KEY, uid); } catch {}
}

function alreadyKnownComplete(uid) {
  try { return sessionStorage.getItem(COMPLETE_KEY) === uid; } catch { return false; }
}

export function clearProfileGateCache() {
  try { sessionStorage.removeItem(COMPLETE_KEY); } catch {}
}

function currentPageName() {
  const last = location.pathname.split('/').pop() || 'index';
  return last.replace(/\.html$/, '').toLowerCase();
}

function isGuardedPage() {
  return GUARDED_PAGES.includes(currentPageName());
}

function isExemptPage() {
  const page = currentPageName();
  if (page === 'login' || page.startsWith('admin')) return true;
  return !isGuardedPage();
}

function currentDestination() {
  const page = currentPageName();
  return `${location.pathname || `/${page}`}${location.search || ''}${location.hash || ''}`;
}

function goToLogin() {
  if (redirecting) return;
  redirecting = true;
  if (currentPageName() === 'login') {
    location.replace('/login');
    return;
  }
  location.replace(`/login?from=${encodeURIComponent(currentDestination())}`);
}

async function enforceProfileComplete(user) {
  if (isExemptPage()) return;

  // Una ruta protegida nunca interpreta ausencia de identidad como permiso.
  // El coordinador sólo publica `null` después de resolver Firebase, por lo
  // que este caso ya significa invitado real y no "Auth todavía cargando".
  if (!user || user.isAnonymous) {
    clearProfileGateCache();
    goToLogin();
    return;
  }

  if (alreadyKnownComplete(user.uid)) return;

  if (String(user.email || '').trim().toLowerCase() === SUPER_ADMIN.toLowerCase()) {
    markComplete(user.uid);
    return;
  }

  let data;
  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    data = snapshot.exists() ? snapshot.data() : {};
  } catch (error) {
    // No se inventa un estado de perfil cuando Firestore no pudo responder.
    // El backend conserva la protección de compra; esta capa deja el checkout
    // visible para permitir recuperación/reintento sin forzar un falso logout.
    console.warn('[profile-gate] No se pudo verificar el perfil:', error);
    return;
  }

  const role = data.role || 'client';
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

  goToLogin();
}

export function startProfileGate() {
  if (isExemptPage()) return;
  subscribeAuthState(user => {
    if (!user) clearProfileGateCache();
    enforceProfileComplete(user);
  });
}
