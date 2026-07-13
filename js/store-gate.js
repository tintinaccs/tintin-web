/**
 * TINTIN — Control automático para todas las páginas públicas.
 *
 * Antes de habilitar la página espera:
 * 1) la sesión real de Firebase;
 * 2) settings/storeGate, el documento público mínimo.
 *
 * Ante cualquier error queda bloqueada. Nunca supone que la tienda está abierta.
 */
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getUserRole } from './roles.js';
import {
  isAccessAllowed,
  renderStoreClosedOverlay,
  renderStoreConfigUnavailableOverlay,
  removeStoreClosedOverlay,
  getStoreAccessConfig,
  normalizeStoreAccessConfig
} from './store-gate-core.js?v=tintin-20260713-6';

export {
  isAccessAllowed,
  renderStoreClosedOverlay,
  renderStoreConfigUnavailableOverlay,
  removeStoreClosedOverlay,
  getStoreAccessConfig
};

if (!window.TintinStoreGateRuntimeBooted) {
  window.TintinStoreGateRuntimeBooted = true;
  document.documentElement.classList.add('tt-store-gate-pending');

  const storeGateRef = doc(db, 'settings', 'storeGate');
  const legacyGeneralRef = doc(db, 'settings', 'general');
  let role = null;
  let email = '';
  let config = null;
  let lastPublishedState = '';
  let legacyUnsubscribe = null;

  function publishState(state) {
    if (state === lastPublishedState) return;
    lastPublishedState = state;

    window.dispatchEvent(
      new CustomEvent('tintin:store-gate-state', {
        detail: { state, role, email, config }
      })
    );
  }

  function evaluate() {
    if (role === null || config === null) return;

    // isAccessAllowed reconoce primero el correo oficial. Por eso Super Admin
    // sigue entrando incluso si el documento de control falta temporalmente.
    if (isAccessAllowed(config, role, email)) {
      removeStoreClosedOverlay();
      publishState('allowed');
      return;
    }

    if (config.__storeConfigStatus !== 'ok') {
      renderStoreConfigUnavailableOverlay(config);
      publishState('unavailable');
      return;
    }

    renderStoreClosedOverlay(config);
    publishState('closed');
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
    } catch (error) {
      // No se reemplaza por client: con la tienda cerrada eso podría conceder
      // una excepción que no fue comprobada.
      console.error('[store-gate] No se pudo comprobar el rol:', error);
      role = '__unresolved__';
    }
    evaluate();
  });

  function stopLegacyFallback() {
    legacyUnsubscribe?.();
    legacyUnsubscribe = null;
  }

  function startLegacyFallback(reason) {
    if (legacyUnsubscribe) return;

    console.warn(
      `[store-gate] Se usa settings/general temporalmente durante la migración (${reason}).`
    );

    legacyUnsubscribe = onSnapshot(
      legacyGeneralRef,
      snapshot => {
        config = snapshot.exists()
          ? {
              ...normalizeStoreAccessConfig(snapshot.data(), 'ok'),
              __storeConfigSource: 'legacy-general'
            }
          : normalizeStoreAccessConfig({}, 'missing');
        evaluate();
      },
      error => {
        console.error(
          '[store-gate] No se pudo leer ni storeGate ni la configuración anterior:',
          error
        );
        config = normalizeStoreAccessConfig({}, 'error');
        evaluate();
      }
    );
  }

  onSnapshot(
    storeGateRef,
    snapshot => {
      if (!snapshot.exists()) {
        startLegacyFallback('documento todavía no creado');
        return;
      }

      stopLegacyFallback();
      config = normalizeStoreAccessConfig(snapshot.data(), 'ok');
      evaluate();
    },
    error => {
      console.warn(
        '[store-gate] settings/storeGate todavía no se puede leer:',
        error
      );
      startLegacyFallback('reglas anteriores');
    }
  );

  async function refresh() {
    document.documentElement.classList.add('tt-store-gate-pending');
    config = await getStoreAccessConfig();
    lastPublishedState = '';
    evaluate();
    return config;
  }

  // Al volver mediante el botón Atrás, algunos navegadores restauran una copia
  // congelada de la página. Se vuelve a comprobar antes de mostrarla.
  window.addEventListener('pageshow', event => {
    if (event.persisted) refresh();
  });

  window.TintinStoreGate = {
    refresh,
    getState: () => ({ role, email, config })
  };
}
