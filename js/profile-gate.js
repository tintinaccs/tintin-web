// =============================================================
// TINTIN ACCESORIOS — Perfil incompleto: no se navega hasta completarlo
// =============================================================
// Una cuenta recién creada no sirve para vender: sin nombre, apellido,
// teléfono y ubicación no se puede armar un pedido ni entregarlo. Antes se
// podía cerrar el formulario del alta y seguir navegando logueada con el
// perfil vacío, y el dato recién se pedía al llegar al checkout.
//
// Este guardia corre en todas las páginas públicas (lo dispara
// js/session-guard.js, que ya se cargaba en todas) y manda a completar el
// perfil antes de mostrar nada. Escribir /catalogo.html a mano tampoco
// esquiva el paso.
//
// Alcance: sólo cuentas con rol `client`. El personal (admin, agente,
// viewer) y el Super Admin entran igual — bloquearles el panel por no tener
// una dirección de entrega cargada no tendría sentido y los dejaría afuera
// de su propia herramienta.
//
// Quien no quiera completarlo tiene salida: el botón "Volver a la tienda"
// del alta cierra la sesión, así puede seguir mirando el catálogo como
// visitante. Lo que no existe es navegar logueada a medias.

import { auth, db } from "./firebase.js?v=tintin-20260730-appcheck-stable-4";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getProfileCompletionPlan } from "./profile-onboarding.mjs?v=tintin-20260803-profile-onboarding-2";
import { SUPER_ADMIN } from "./roles.js?v=tintin-20260716-cloudinary-fix-1";

// Evita releer el perfil en cada navegación de la misma sesión. Se guarda el
// uid y no un simple `true`: si se cambia de cuenta en la misma pestaña, el
// valor deja de coincidir y se vuelve a verificar.
const COMPLETE_KEY = 'tt_profile_complete_uid';

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

function isLoginPage() {
  return /(^|\/)login\.html$/.test(location.pathname);
}

/**
 * Páginas donde el guardia no corre.
 *
 * - login.html: es justamente donde se completa el perfil.
 * - admin*.html: son del personal, que queda fuera del alcance igual, pero
 *   se listan para no gastar una lectura de Firestore en cada carga.
 */
function isExemptPage() {
  return isLoginPage() || /(^|\/)admin[a-z-]*\.html$/.test(location.pathname);
}

let redirecting = false;

function goCompleteProfile() {
  if (redirecting) return;
  redirecting = true;
  // `from` conserva a dónde quería ir, para devolverla ahí apenas termine
  // (login.html ya lo respeta al redirigir después del alta).
  const from = location.pathname.split('/').pop() + location.search;
  location.replace(`login.html?from=${encodeURIComponent(from)}`);
}

async function enforceProfileComplete(user) {
  if (!user || user.isAnonymous) return;
  if (isExemptPage()) return;
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
    // Sin poder leer el perfil no se bloquea la navegación: un problema de
    // red no tiene por qué dejar a alguien afuera de la tienda. Se reintenta
    // en la próxima carga, porque no se marca como completo.
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

  goCompleteProfile();
}

export function startProfileGate() {
  if (isExemptPage()) return;
  onAuthStateChanged(auth, user => {
    if (!user) clearProfileGateCache();
    enforceProfileComplete(user);
  });
}
