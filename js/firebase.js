// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  setTokenAutoRefreshEnabled
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";

// El dominio de autenticación es el mismo dominio público de la tienda.
// functions/__/auth/[[path]].js reexpone ahí los helpers oficiales de
// Firebase Auth. Esto permite que signInWithRedirect vuelva por la misma
// pestaña y el mismo origen, sin depender de ventanas emergentes ni del
// almacenamiento entre tintinaccesorios.pages.dev y firebaseapp.com.
// La URI https://tintinaccesorios.pages.dev/__/auth/handler debe permanecer
// autorizada en el cliente OAuth web del proyecto tintin-accesorios.
const firebaseConfig = {
  apiKey: "AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0",
  authDomain: "tintinaccesorios.pages.dev",
  projectId: "tintin-accesorios",
  messagingSenderId: "207918562502",
  appId: "1:207918562502:web:c2ebe4f8d96dad3a50abc7",
  measurementId: "G-9RH4FCNCZ9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Clave pública de reCAPTCHA Enterprise registrada en Firebase App Check.
// Al cargarla y activar Enforcement en Firestore, las llamadas que no provengan
// de la web legítima quedan rechazadas antes de consumir la API normalmente.
// Certifica ante Firebase que las lecturas y escrituras vienen de este sitio
// y no de un script externo repitiendo llamadas (el vector que agotó la
// cuota diaria de Firestore del plan Spark).
const FIREBASE_APP_CHECK_SITE_KEY = '6LdhrGAtAAAAAIPJJ2nTT9300Vor--Wlq0PRCP9m';
let appCheck = null;
let appCheckReady = Promise.resolve(false);
if (FIREBASE_APP_CHECK_SITE_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY),
    // Se activa después de obtener el primer token. Si la configuración del
    // dominio falla, evita un refresco proactivo que repita errores cada pocos
    // segundos sin posibilidad de recuperarse.
    isTokenAutoRefreshEnabled: false
  });
  window.TintinAppCheckStatus = 'checking';
  const appCheckTokenSettled = getAppCheckToken(appCheck, false)
    .then(() => {
      setTokenAutoRefreshEnabled(appCheck, true);
      window.TintinAppCheckStatus = 'enabled';
      window.dispatchEvent(new CustomEvent('tintin:app-check-ready', {
        detail: { ready: true }
      }));
      return true;
    })
    .catch(error => {
      window.TintinAppCheckStatus = 'error';
      window.dispatchEvent(new CustomEvent('tintin:app-check-ready', {
        detail: { ready: false, code: error?.code || 'appCheck/unknown' }
      }));
      return false;
    });
  // Si reCAPTCHA/App Check nunca resuelve (script bloqueado, red lenta o
  // caída justo en el momento de la verificación — más común en wifi de
  // tablet/mobile que en una conexión de escritorio estable), la promesa de
  // arriba se queda colgada para siempre, y con ella CADA función del sitio
  // que hace `await appCheckReady` antes de leer Firestore (carrito,
  // productos, colecciones, imágenes, analytics, admin...), sin ningún
  // error visible — la pantalla queda girando indefinidamente. Después de
  // 8s se sigue como si App Check no estuviera disponible (el mismo camino
  // que ya existe para cuando falla de verdad), para que cada módulo use su
  // fallback normal en vez de trabarse. Si el token real llega más tarde
  // igual dispara sus efectos (estado, evento) normalmente.
  const appCheckTimeout = new Promise(resolve => {
    setTimeout(() => resolve(false), 8000);
  });
  appCheckReady = Promise.race([appCheckTokenSettled, appCheckTimeout]);
} else {
  window.TintinAppCheckStatus = 'configuration-required';
}
window.TintinAppCheckReady = appCheckReady;

// Firestore en memoria (sin caché persistente en IndexedDB). Se probó con
// persistentLocalCache + persistentMultipleTabManager para que los listeners
// resuelvan al instante desde disco, pero esa coordinación entre pestañas
// puede quedarse esperando para siempre en navegadores que restringen
// IndexedDB (navegación privada, Brave con Shields, etc.) sin tirar ningún
// error — el try/catch alrededor de initializeFirestore solo protege contra
// un fallo síncrono inmediato, no contra ese cuelgue silencioso posterior.
// Resultado real: el sitio se quedaba en el logo para siempre. getFirestore()
// no depende de IndexedDB para nada, así que no tiene ese riesgo.
const db = getFirestore(app);

const auth = getAuth(app);
// Idioma para cualquier mensaje/UI de Firebase Auth — se fija una sola vez
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { db, auth, provider, appCheck, appCheckReady };
