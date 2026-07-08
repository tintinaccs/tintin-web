/**
 * TINTIN — Gate automático de "Tienda abierta/cerrada" para páginas
 * públicas. Importar este script (un solo <script type="module"> más) alcanza
 * para que la página muestre la pantalla de "Tienda temporalmente cerrada"
 * cuando corresponda: escucha en vivo settings/general (storeOpen +
 * maintenanceAccess) y el estado de auth, y decide con la misma lógica pura
 * de js/store-gate-core.js.
 *
 * admin.html NO importa este archivo — tiene su propio auth guard con su
 * propia lógica de redirect/bloqueo, y usa store-gate-core.js directamente
 * para no duplicar el listener automático de acá.
 */
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getUserRole } from './roles.js';
import { isAccessAllowed, renderStoreClosedOverlay, removeStoreClosedOverlay, getStoreAccessConfig, STORE_CLOSED_WA_URL } from './store-gate-core.js';

export { isAccessAllowed, renderStoreClosedOverlay, removeStoreClosedOverlay, getStoreAccessConfig, STORE_CLOSED_WA_URL };

let _role = null;   // null = todavía no se resolvió el estado de auth
let _email = '';
let _cfg = null;    // null = todavía no llegó el primer snapshot de settings/general

function evaluate_() {
  if (_role === null || _cfg === null) return; // esperar a tener los dos datos
  if (isAccessAllowed(_cfg, _role, _email)) removeStoreClosedOverlay();
  else renderStoreClosedOverlay();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { _role = 'guest'; _email = ''; evaluate_(); return; }
  _email = user.email || '';
  try {
    _role = await getUserRole(user.uid, user.email);
  } catch (e) {
    _role = 'client';
  }
  evaluate_();
});

onSnapshot(doc(db, 'settings', 'general'), snap => {
  _cfg = snap.exists() ? snap.data() : { storeOpen: true };
  evaluate_();
}, () => {
  _cfg = { storeOpen: true };
  evaluate_();
});
