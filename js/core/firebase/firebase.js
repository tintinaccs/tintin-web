// =============================================
// TINTIN ACCESORIOS — Firebase Config
// =============================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  setTokenAutoRefreshEnabled
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";
import { TINTIN_AUTH_DOMAIN } from '../config/origenes-publicos.js';

// El dominio de autenticación se gestiona desde config/origenes-tintin.json.
// Antes del cutover a tintinaccs.com debe autorizarse el nuevo dominio en
// Firebase Authentication, OAuth y App Check y recién después cambiarse allí.
const firebaseConfig = {
  apiKey: "AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0",
  authDomain: TINTIN_AUTH_DOMAIN,
  projectId: "tintin-accesorios",
  messagingSenderId: "207918562502",
  appId: "1:207918562502:web:c2ebe4f8d96dad3a50abc7",
  measurementId: "G-9RH4FCNCZ9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Clave pública de reCAPTCHA Enterprise registrada en Firebase App Check.
const FIREBASE_APP_CHECK_SITE_KEY = '6LdhrGAtAAAAAIPJJ2nTT9300Vor--Wlq0PRCP9m';
let appCheck = null;
let appCheckReady = Promise.resolve(false);
if (FIREBASE_APP_CHECK_SITE_KEY) {
  window.TintinAppCheckStatus = 'checking';
  const appCheckDomReady = document.body
    ? Promise.resolve()
    : new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  const appCheckTokenSettled = appCheckDomReady
    .then(() => {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: false
      });
      return getAppCheckToken(appCheck, false);
    })
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
  const appCheckTimeout = new Promise(resolve => {
    setTimeout(() => resolve(false), 8000);
  });
  appCheckReady = Promise.race([appCheckTokenSettled, appCheckTimeout]);
} else {
  window.TintinAppCheckStatus = 'configuration-required';
}
window.TintinAppCheckReady = appCheckReady;

// Firestore en memoria evita cuelgues silenciosos de IndexedDB en navegadores
// que restringen almacenamiento persistente.
const db = getFirestore(app);

const auth = getAuth(app);
auth.languageCode = "es";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { db, auth, provider, appCheck, appCheckReady };
