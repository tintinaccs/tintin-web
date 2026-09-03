// =============================================
// TINTIN ACCESORIOS — Expiración de sesión
// =============================================
// Firebase Auth mantiene la sesión y renueva su token. El Super Admin conserva
// su sesión hasta cerrar manualmente; el resto de las cuentas debe volver a
// autenticarse después de 30 minutos sin actividad.

import { auth, db } from "../firebase/firebase.js?v=tintin-20260903-auth-persistence-1";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getUserRole } from "./roles.js?v=tintin-20260821-accounts-phase-a-1";
import { startProfileGate } from "../../pages/profile/control-acceso-perfil.js?v=tintin-20260901-username-visible-1";
import { pushUserProfileToMirrorsSoon } from "../sync/sincronizacion-usuario.js?v=tintin-20260903-user-mirror-push-1";

const STAFF_INACTIVITY_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'tt_session_last_activity_at';
const USER_MIRROR_KEY_PREFIX = 'tt_user_mirror_fingerprint_';
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;
let currentRole = '';
let roleUid = '';
let lastActivityWrite = 0;
let unsubscribeUserMirror = null;
let mirrorUid = '';
let adminParityModulePromise = null;
let checkoutInvoiceModulePromise = null;

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

function stableUserValue(value) {
  if (value?.toMillis && typeof value.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(stableUserValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableUserValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function profileFingerprint(data) {
  const serialized = JSON.stringify(stableUserValue(data || {}));
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stopUserMirrorObserver() {
  try { unsubscribeUserMirror?.(); } catch {}
  unsubscribeUserMirror = null;
  mirrorUid = '';
}

function startUserMirrorObserver(user) {
  if (!user || user.isAnonymous) {
    stopUserMirrorObserver();
    return;
  }
  if (mirrorUid === user.uid && unsubscribeUserMirror) return;
  stopUserMirrorObserver();
  mirrorUid = user.uid;
  const storageKey = USER_MIRROR_KEY_PREFIX + user.uid;
  unsubscribeUserMirror = onSnapshot(doc(db, 'users', user.uid), snapshot => {
    if (!snapshot.exists()) return;
    const fingerprint = profileFingerprint(snapshot.data());
    let previous = '';
    try { previous = localStorage.getItem(storageKey) || ''; } catch {}
    if (fingerprint === previous) return;
    try { localStorage.setItem(storageKey, fingerprint); } catch {}
    // El endpoint relee Firestore; este listener únicamente avisa que la
    // versión canónica cambió. El mismo fingerprint compartido en localStorage
    // evita que pestañas duplicadas empujen la misma versión una y otra vez.
    pushUserProfileToMirrorsSoon(user);
  }, error => {
    console.warn('[user-sync] No se pudo observar el perfil para réplica inmediata:', error);
  });
}

function isAdminPage() {
  return /(?:^|\/)admin(?:\.html)?\/?$/i.test(location.pathname || '');
}

function isCheckoutPage() {
  return /(?:^|\/)checkout(?:\.html)?\/?$/i.test(location.pathname || '');
}

function startCheckoutInvoiceStability() {
  if (!isCheckoutPage() || checkoutInvoiceModulePromise) return;
  checkoutInvoiceModulePromise = import('../../pages/checkout/checkout-facturacion-estable.js?v=tintin-20260903-checkout-invoice-stable-1')
    .catch(error => {
      checkoutInvoiceModulePromise = null;
      console.warn('[checkout-invoice] No se pudo iniciar la capa estable de facturación:', error);
      throw error;
    });
}

function stopAdminParityObserver() {
  if (!adminParityModulePromise) return;
  void adminParityModulePromise
    .then(module => module.stopAdminParityObservers?.())
    .catch(() => {});
}

function syncAdminParityObserver(user) {
  if (!user || currentRole !== 'superadmin' || !isAdminPage()) {
    stopAdminParityObserver();
    return;
  }
  if (!adminParityModulePromise) {
    adminParityModulePromise = import('../../admin/sincronizacion-paridad-admin.js?v=tintin-20260903-admin-parity-push-1')
      .catch(error => {
        adminParityModulePromise = null;
        console.warn('[admin-parity] No se pudo iniciar la paridad inmediata:', error);
        throw error;
      });
  }
  void adminParityModulePromise.then(module => module.startAdminParityObservers?.(user));
}

async function enforce(user) {
  if (!user) {
    currentRole = '';
    roleUid = '';
    stopUserMirrorObserver();
    stopAdminParityObserver();
    clearSessionStart();
    return;
  }
  startUserMirrorObserver(user);
  if (roleUid !== user.uid) {
    try {
      currentRole = await getUserRole(user.uid, user.email);
      roleUid = user.uid;
    } catch {
      // Un fallo transitorio leyendo el rol no debe expulsar a una clienta.
      return;
    }
  }
  syncAdminParityObserver(user);
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

// Checkout carga esta hoja directamente en su HTML. La capa de facturación se
// activa desde acá para no acoplarla al shell global ni a un evento posterior.
// Su propio boot es idempotente y sólo toca la ruta /checkout.
startCheckoutInvoiceStability();

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
