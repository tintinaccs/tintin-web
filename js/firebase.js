// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

// App Check (reCAPTCHA v3): certifica ante Firebase que las lecturas y
// escrituras vienen de este sitio y no de un script externo repitiendo
// llamadas (el vector de C2 en la auditoría: agotar la cuota diaria de
// Firestore del plan Spark). Este módulo se carga en todas las páginas
// (todo el sitio importa firebase.js), así que alcanza con inicializarlo
// una sola vez acá. try/catch porque initializeAppCheck() revienta si se
// llama dos veces sobre el mismo app — no debería pasar ya que este
// archivo se ejecuta una sola vez por versión de caché, pero sale barato
// no arriesgar una pantalla en blanco por eso.
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdhrGAtAAAAAIPJJ2nTT9300Vor--WIq0PRCP9m'),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  console.warn('[firebase] App Check ya estaba inicializado:', error);
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

const auth = getAuth(app);
// Idioma para cualquier mensaje/UI de Firebase Auth — se fija una sola vez
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { db, auth, provider };
