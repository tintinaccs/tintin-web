'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('css/theme/fondo-solido-cargador.css');
const login = read('login.html');
const authNav = read('js/core/auth/navegacion-autenticacion.js');
const session = read('js/core/auth/proteccion-sesion.js');
const firebase = read('js/core/firebase/firebase.js');
const profileStore = read('js/core/store/perfil-usuario.js');
const profileGate = read('js/pages/profile/control-acceso-perfil.js');
const contactMaintenance = read('js/pages/institutional/mantenimiento-contacto.js');
const cartSync = read('js/components/cart/sincronizacion-carrito.js');

const loginLoaderVisible =
  css.includes('html:has(.login-page) body #tt-loader-spin-wrap') &&
  css.includes('display: flex !important') &&
  css.includes('visibility: visible !important');

const officialLogoImmediate =
  css.includes('assets-tintin/images/general/logo.png?v=') &&
  css.includes('#tt-loader-spin-wrap::before') &&
  css.includes('animation: none') &&
  css.includes('transform: none');

function productionFiles() {
  const files = [];
  const visit = relative => {
    const absolute = path.join(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (child === path.join('js', 'vendor')) continue;
        visit(child);
      } else if (/\.js$/i.test(entry.name)) {
        files.push(child.replace(/\\/g, '/'));
      }
    }
  };
  visit('js');
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /\.html$/i.test(entry.name)) files.push(entry.name);
  }
  return files.sort();
}

const allowedSignOutFiles = new Set([
  'login.html',
  'perfil.html',
  'js/admin/admin-app.js',
  'js/core/auth/navegacion-autenticacion.js',
]);

const signOutCallers = productionFiles().filter(file => /\bsignOut\s*\(/.test(read(file)));
const unexpectedSignOutCallers = signOutCallers.filter(file => !allowedSignOutFiles.has(file));

const persistenceCallers = productionFiles().filter(file => /\bsetPersistence\s*\(/.test(read(file)));
const unexpectedPersistenceCallers = persistenceCallers.filter(file => file !== 'js/core/firebase/firebase.js');

// Estos contratos se validan por semántica observable, no por una frase o
// una forma sintáctica única. Así el gate sigue protegiendo Auth aunque el
// copy del loader o la forma de encadenar una Promise cambien legítimamente.
const googleHandoffKeepsOverlay =
  login.includes('const cred = await signInWithPopup(auth, provider)') &&
  login.includes('showOverlay()') &&
  /setOverlayText\(['"](?:Entrando…|Redireccionando a tu cuenta…|Completando el inicio de sesión con Google…)['"]\)/.test(login) &&
  login.includes('await finishGoogleLogin(cred.user)');

const cartWaitsForAuthRestore =
  /auth\.authStateReady\s*\(\)/.test(cartSync) &&
  (
    /await\s+auth\.authStateReady(?:\?\.)?\s*\(\)/.test(cartSync) ||
    /authStateReady\.then\s*\(\s*\(\)\s*=>\s*onAuthStateChanged\s*\(/.test(cartSync)
  );

const persistenceScopedToLogin =
  firebase.includes('browserLocalPersistence') &&
  /const\s+IS_LOGIN_PAGE\s*=/.test(firebase) &&
  /IS_LOGIN_PAGE\s*\?\s*setPersistence\s*\(\s*auth\s*,\s*browserLocalPersistence\s*\)/s.test(firebase);

const checks = [
  ['Login mantiene su contenedor propio', login.includes('class="login-page"')],
  ['Header público oculto en Login', css.includes('body:has(.login-page) #tt-header-desktop-tablet')],
  ['Barra mobile oculta en Login', css.includes('body:has(.login-page) #tt-tabbar')],
  ['Carrito y búsqueda ocultos en Login', css.includes('body:has(.login-page) #cart-drawer') && css.includes('body:has(.login-page) #search-panel')],
  ['Login no reserva espacio del shell', css.includes('body:has(.login-page).tt-public-shell-mounted') && css.includes('padding-top: 0 !important')],
  ['Loader de Login muestra la marca oficial completa', loginLoaderVisible && officialLogoImmediate],
  ['Google usa popup como camino principal', login.includes('const cred = await signInWithPopup(auth, provider)')],
  ['Google mantiene loader hasta terminar el handoff', googleHandoffKeepsOverlay],
  ['OTP mantiene loader hasta terminar el handoff', login.includes("setOverlayText('Verificando tu código…')") && login.includes('await finishOtpLogin(user)')],
  ['Popup bloqueado cambia automáticamente de camino', login.includes("if (e.code === 'auth/popup-blocked')") && login.includes('await signInWithRedirect(auth, provider)')],
  ['Retorno de Google se completa una sola vez y sin bucle', login.includes('getRedirectResult(auth)') && login.includes('GOOGLE_REDIRECT_PENDING_KEY') && login.includes('handleGoogleRedirectReturn(user)')],
  ['Solo el correo oficial entra automáticamente al panel', login.includes("normalizedEmail === SUPER_ADMIN.toLowerCase()") && login.includes("window.location.replace('admin.html')")],
  ['Auth compartido no compite con el Login', authNav.includes('if(IS_LOGIN_PAGE)return;') && !authNav.includes('redirectAuthenticatedLogin')],
  ['Ningún rol vence la sesión automáticamente', !session.includes('signOut(') && !/INACTIVITY|inactividad|expired/i.test(session)],
  ['Solo superficies explícitas pueden cerrar Firebase Auth', unexpectedSignOutCallers.length === 0],
  ['La persistencia de Auth tiene una sola autoridad', unexpectedPersistenceCallers.length === 0 && persistenceCallers.length === 1],
  ['Firestore confirma la identidad antes de terminar un login', profileStore.includes('await setDoc(ref, identityPatch, { merge: true })')],
  ['Contacto no contiene lógica de cierre de sesión', !/\bsignOut\s*\(/.test(contactMaintenance)],
  ['El guard de perfil sólo protege checkout', profileGate.includes("const GUARDED_PAGES = ['checkout']")],
  ['El carrito espera restauración Auth antes de observar sesión', cartWaitsForAuthRestore],
  ['Firebase persiste sesión local sólo desde Login', persistenceScopedToLogin],
];

if (unexpectedSignOutCallers.length) {
  console.error('Cierres de sesión inesperados:', unexpectedSignOutCallers.join(', '));
}
if (unexpectedPersistenceCallers.length) {
  console.error('Autoridades de persistencia inesperadas:', unexpectedPersistenceCallers.join(', '));
}

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\nFALLAS: ${failed}`);
  process.exit(1);
}

console.log(`\nResultado: ${checks.length}/${checks.length} comprobaciones correctas.`);
