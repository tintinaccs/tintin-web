/**
 * TINTIN — Control automático para todas las páginas públicas.
 *
 * Antes de habilitar la página espera:
 * 1) la sesión real de Firebase;
 * 2) settings/storeGate, el documento público mínimo.
 *
 * Ante cualquier error queda bloqueada. Nunca supone que la tienda está abierta.
 */
import { auth, db, appCheckReady } from './firebase.js?v=tintin-20260730-appcheck-stable-4';
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getUserRole } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  isAccessAllowed,
  renderStoreClosedOverlay,
  renderStoreConfigUnavailableOverlay,
  removeStoreClosedOverlay,
  getStoreAccessConfig,
  getStoreAccessConfigFromRest,
  normalizeStoreAccessConfig
} from './store-gate-core.js?v=tintin-20260730-appcheck-stable-4';

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
  const appCheckAvailable = await appCheckReady;

  const storeGateRef = doc(db, 'settings', 'storeGate');
  const legacyGeneralRef = doc(db, 'settings', 'general');
  let role = null;
  let email = '';
  let config = null;
  let lastPublishedState = '';
  let legacyUnsubscribe = null;
  let restConfigResolved = false;

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
      publishState('degraded');
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
    if (!appCheckAvailable) {
      role = '__unresolved__';
      evaluate();
      return;
    }
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
    if (restConfigResolved) return;
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

  if (appCheckAvailable) {
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
        console.warn('[store-gate] settings/storeGate todavía no se puede leer:', error);
        startLegacyFallback('reglas anteriores');
      }
    );

    // Respaldo en paralelo: evita el falso bloqueo cuando la tienda está
    // abierta pero el navegador no puede mantener el canal normal de Firebase.
    window.setTimeout(() => {
      if (config?.__storeConfigStatus === 'ok') return;
      getStoreAccessConfigFromRest()
        .then(restConfig => {
          if (!restConfig) return;
          restConfigResolved = true;
          stopLegacyFallback();
          config = restConfig;
          evaluate();
        })
        .catch(() => {});
    }, 900);
  } else {
    // Sin certificación válida no se inicia ninguna lectura de Firestore.
    // Se emite un único estado estable y la página queda en modo consulta.
    config = normalizeStoreAccessConfig({}, 'app-check-error');
    evaluate();
  }

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
