// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  initializeAuth, getAuth, GoogleAuthProvider,
  browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0",
  authDomain: "tintin-accesorios.firebaseapp.com",
  projectId: "tintin-accesorios",
  messagingSenderId: "207918562502",
  appId: "1:207918562502:web:c2ebe4f8d96dad3a50abc7",
  measurementId: "G-9RH4FCNCZ9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Clave pública de reCAPTCHA v3 creada desde Firebase Console → App Check.
// Al cargarla y activar Enforcement en Firestore, las llamadas que no provengan
// de la web legítima quedan rechazadas antes de consumir la API normalmente.
// Certifica ante Firebase que las lecturas y escrituras vienen de este sitio
// y no de un script externo repitiendo llamadas (el vector que agotó la
// cuota diaria de Firestore del plan Spark).
const FIREBASE_APP_CHECK_SITE_KEY = '6LdhrGAtAAAAAIPJJ2nTT9300Vor--WIq0PRCP9m';
if (FIREBASE_APP_CHECK_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
  window.TintinAppCheckStatus = 'enabled';
} else {
  window.TintinAppCheckStatus = 'configuration-required';
}

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

// Mismo problema que el de Firestore de arriba, pero del lado de Auth: por
// default Firebase intenta primero indexedDBLocalPersistence, y en
// navegación privada (Safari/iOS en particular) IndexedDB puede quedar
// medio abierta — no tira error, pero las escrituras que necesita el login
// (la operación pendiente de signInWithRedirect, la sesión ya iniciada)
// se pierden en silencio. Eso es lo que hace que, tras volver de elegir la
// cuenta de Google (o de abrir el enlace de acceso por correo) en
// navegación privada, la página vuelva a mostrar el formulario de login
// como si nada hubiera pasado, sin ningún error visible. Se salta
// indexedDBLocalPersistence del todo y se cae a localStorage o
// sessionStorage (mismo origen, no depende de IndexedDB) — o memoria si
// ninguno de los dos está disponible.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  // Ya se había inicializado (ej. otro script cargó este mismo módulo antes)
  auth = getAuth(app);
}
// Idioma para cualquier mensaje/UI de Firebase Auth — se fija una sola vez
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { db, auth, provider };
