/**
 * TINTIN — Núcleo puro de "Tienda abierta/cerrada" (sin efectos secundarios
 * al importar). js/store-gate.js lo re-exporta y le agrega el gate
 * automático para páginas públicas; admin.html y login.html importan este
 * archivo directamente cuando necesitan solo las funciones (chequeo puntual
 * después de un login, o dentro del propio auth guard del panel) sin
 * disparar el listener automático de store-gate.js.
 */
import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { SUPER_ADMIN } from './roles.js';
import { waitForLoaderHidden } from './loader-wait.js';

const OVERLAY_ID = 'tt-store-closed-overlay';
// Refleja el último estado deseado mientras se espera a que el loader se
// oculte — si la tienda se reabre (removeStoreClosedOverlay) antes de que
// la inserción diferida corra, esta bandera evita insertar un overlay
// "cerrado" ya obsoleto.
let wantOverlay = false;

// Texto y link exactos pedidos: WhatsApp con el mensaje precargado.
const WA_TEXT = 'Hola Tintin, quiero consultar sobre la tienda.';
export const STORE_CLOSED_WA_URL = 'https://wa.me/595981299331?text=' + encodeURIComponent(WA_TEXT);

/**
 * Pantalla "Tienda temporalmente cerrada" — mismo patrón visual que
 * js/blocked-modal.js (overlay opaco, z-index alto, sin botón de cerrar más
 * que las acciones ofrecidas) para que toda la web sea consistente.
 */
function insertStoreClosedOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(30,10,18,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:36px 28px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.25);box-sizing:border-box">
      <div style="font-size:40px;margin-bottom:14px">🌙</div>
      <div style="font-weight:800;font-size:19px;color:#8b2642;margin-bottom:12px">Tienda temporalmente cerrada</div>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 26px">Estamos realizando ajustes para mejorar tu experiencia. Volvé a intentarlo más tarde.</p>
      <a href="${STORE_CLOSED_WA_URL}" target="_blank" rel="noopener" style="display:inline-block;background:#25D366;color:#fff!important;padding:12px 30px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none">Contactar soporte</a>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}

export function renderStoreClosedOverlay() {
  wantOverlay = true;
  if (document.getElementById(OVERLAY_ID)) return;
  waitForLoaderHidden().then(() => {
    if (wantOverlay) insertStoreClosedOverlay();
  });
}

export function removeStoreClosedOverlay() {
  wantOverlay = false;
  const el = document.getElementById(OVERLAY_ID);
  if (el) { el.remove(); document.body.style.overflow = ''; }
}

/**
 * Lectura puntual (no en vivo) de settings/general — para chequeos de una
 * sola vez, como el de login.html justo después de autenticar. Falla
 * "abierto" (tienda abierta) si no existe el doc o falla la lectura, mismo
 * criterio que el resto de la config de la tienda en este sitio.
 */
export async function getStoreAccessConfig() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    return snap.exists() ? snap.data() : { storeOpen: true };
  } catch (e) {
    return { storeOpen: true };
  }
}

/**
 * Pura, sin I/O — reutilizable en cualquier página.
 * @param {object} cfg - settings/general (o lo que devuelva getStoreAccessConfig)
 * @param {string} role - 'guest' | 'client' | 'admin' | 'agent' | 'viewer' | 'support' | 'superadmin'
 * @param {string} email - email de la cuenta (para el atajo de Super Admin real)
 */
export function isAccessAllowed(cfg, role, email) {
  if (email && email === SUPER_ADMIN) return true;
  if (role === 'superadmin') return true;
  if (!cfg || cfg.storeOpen !== false) return true;
  const access = cfg.maintenanceAccess || {};
  return access[role || 'guest'] === true;
}
