// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0",
  authDomain: "tintin-accesorios.firebaseapp.com",
  projectId: "tintin-accesorios",
  messagingSenderId: "207918562502",
  appId: "1:207918562502:web:c2ebe4f8d96dad3a50abc7",
  measurementId: "G-9RH4FCNCZ9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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
