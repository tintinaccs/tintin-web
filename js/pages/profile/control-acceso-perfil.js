// =============================================================
// TINTIN ACCESORIOS — Sin perfil completo no se compra
// =============================================================
// Un pedido sin nombre, teléfono y ubicación no se puede entregar. Este
// guardia exige el perfil completo antes de dejar avanzar en el checkout, y
// manda a terminarlo devolviendo después a donde estaba.
//
// Corre SÓLO en el checkout (GUARDED_PAGES), no en todo el sitio. Mirar
// productos no necesita una dirección de entrega, y pedirla en la entrada
// espantaba clientas sin frenar a nadie que quisiera ensuciar la base: quien
// automatiza no navega, llena el formulario con datos inventados y sigue.
// Lo protegido no cambió — sigue sin poder comprar sin cuenta completa, sin
// teléfono único y sin ubicación con coordenadas.
//
// Alcance: sólo cuentas con rol `client`. El personal (admin, agente,
// viewer) y el Super Admin entran igual — bloquearles el panel por no tener
// una dirección de entrega cargada no tendría sentido.
//
// Quien no quiera completarlo tiene salida: el modal del alta cierra la
// sesión y la devuelve a la tienda, donde puede seguir mirando.

import { auth, db } from "../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getProfileCompletionPlan } from "./configuracion-inicial-perfil.mjs?v=tintin-20260901-username-required-1";
import { SUPER_ADMIN } from "../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1";

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
 * Páginas donde SÍ corre el guardia.
 *
 * Es una lista corta a propósito: el perfil completo hace falta para
 * entregar un pedido, no para mirar productos. Pedirlo en la entrada
 * espantaba clientas —una llega desde Instagram a mirar aros y se choca con
 * un formulario que le pide marcar su casa en un mapa— sin frenar a nadie
 * que quisiera ensuciar la base: quien automatiza no navega, llena el
 * formulario con datos inventados y sigue igual.
 *
 * En el checkout la exigencia sí tiene sentido: sin nombre, teléfono y
 * ubicación no hay pedido que se pueda entregar. Y no se pierde nada de lo
 * que protegía antes — sigue sin poder comprar sin cuenta completa, sin
 * teléfono único y sin ubicación con coordenadas.
 */
const GUARDED_PAGES = ['checkout'];

function isGuardedPage() {
  return GUARDED_PAGES.includes(currentPageName());
}

/** El guardia no corre acá: login es donde se completa, admin es del personal. */
function isExemptPage() {
  const page = currentPageName();
  if (page === 'login' || page.startsWith('admin')) return true;
  return !isGuardedPage();
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
  if (page === 'login') { location.replace('/login'); return; }

  const from = `/${page}`;
  location.replace(`/login?from=${encodeURIComponent(from)}`);
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
