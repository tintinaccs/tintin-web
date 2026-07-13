/**
 * TINTIN — Gate automático de tienda para páginas públicas.
 *
 * Espera dos datos antes de mostrar el sitio: estado de autenticación y
 * settings/general. Si la configuración no se puede comprobar, bloquea por
 * seguridad en vez de asumir que la tienda está abierta.
 */
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getUserRole } from './roles.js';
import {
  isAccessAllowed,
  renderStoreClosedOverlay,
  renderStoreConfigUnavailableOverlay,
  removeStoreClosedOverlay,
  getStoreAccessConfig,
  normalizeStoreAccessConfig,
} from './store-gate-core.js';

export {
  isAccessAllowed,
  renderStoreClosedOverlay,
  renderStoreConfigUnavailableOverlay,
  removeStoreClosedOverlay,
  getStoreAccessConfig,
};

if (!window.TintinStoreGateRuntimeBooted) {
  window.TintinStoreGateRuntimeBooted = true;
  document.documentElement.classList.add('tt-store-gate-pending');

  let role = null;
  let email = '';
  let cfg = null;

  function publishState(state) {
    window.dispatchEvent(new CustomEvent('tintin:store-gate-state', {
      detail: { state, role, email, config: cfg },
    }));
  }

  function evaluate() {
    if (role === null || cfg === null) return;

    if (String(email || '').toLowerCase() === 'tintinaccs@gmail.com') {
      removeStoreClosedOverlay();
      publishState('allowed');
      return;
    }

    if (cfg.__storeConfigStatus !== 'ok') {
      renderStoreConfigUnavailableOverlay(cfg);
      publishState('unavailable');
      return;
    }

    if (isAccessAllowed(cfg, role, email)) {
      removeStoreClosedOverlay();
      publishState('allowed');
    } else {
      renderStoreClosedOverlay(cfg);
      publishState('closed');
    }
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      role = 'guest';
      email = '';
      evaluate();
      return;
    }

    email = user.email || '';
    try {
      role = await getUserRole(user.uid, user.email);
    } catch (e) {
      console.error('[store-gate] No se pudo resolver el rol:', e);
      role = 'client';
    }
    evaluate();
  });

  onSnapshot(doc(db, 'settings', 'general'), snap => {
    cfg = snap.exists()
      ? normalizeStoreAccessConfig(snap.data(), 'ok')
      : normalizeStoreAccessConfig({}, 'missing');
    evaluate();
  }, error => {
    console.error('[store-gate] No se pudo sincronizar settings/general:', error);
    cfg = normalizeStoreAccessConfig({}, 'error');
    evaluate();
  });

  window.TintinStoreGate = {
    refresh: evaluate,
    getState: () => ({ role, email, config: cfg }),
  };
}
