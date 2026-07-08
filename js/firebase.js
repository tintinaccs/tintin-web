// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0",
  authDomain: "tintin-accesorios.firebaseapp.com",
  projectId: "tintin-accesorios",
  storageBucket: "tintin-accesorios.firebasestorage.app",
  messagingSenderId: "207918562502",
  appId: "1:207918562502:web:c2ebe4f8d96dad3a50abc7",
  measurementId: "G-9RH4FCNCZ9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persistent local cache (IndexedDB): onSnapshot listeners resolve instantly
// from disk on every load after the first — no more staring at "Cargando…"
// while waiting on a network round-trip. Firestore still syncs live in the
// background and reconciles automatically. Falls back to plain in-memory
// Firestore (old behavior) if IndexedDB is unavailable (private browsing, etc).
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn('[firebase] Persistent cache unavailable or already initialized, using existing Firestore:', e);
  db = getFirestore(app);
}

const auth = getAuth(app);
// Idioma para cualquier mensaje/UI de Firebase Auth — se fija una sola vez
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const storage = getStorage(app);

export { db, auth, provider, storage };
