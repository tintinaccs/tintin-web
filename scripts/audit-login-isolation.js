'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('css/theme/loader-solid-background.css');
const login = read('login.html');
const authNav = read('js/core/auth/auth-nav.js');

const loginLoaderVisible =
  css.includes('html:has(.login-page) body #tt-loader-spin-wrap') &&
  css.includes('display: flex !important') &&
  css.includes('visibility: visible !important');

const officialLogoImmediate =
  css.includes('assets-tintin/images/general/logo.png?v=') &&
  css.includes('#tt-loader-spin-wrap::before') &&
  css.includes('animation: none') &&
  css.includes('transform: none');

const checks = [
  ['Login mantiene su contenedor propio', login.includes('class="login-page"')],
  ['Header público oculto en Login', css.includes('body:has(.login-page) #tt-header-desktop-tablet')],
  ['Barra mobile oculta en Login', css.includes('body:has(.login-page) #tt-tabbar')],
  ['Carrito y búsqueda ocultos en Login', css.includes('body:has(.login-page) #cart-drawer') && css.includes('body:has(.login-page) #search-panel')],
  ['Login no reserva espacio del shell', css.includes('body:has(.login-page).tt-public-shell-mounted') && css.includes('padding-top: 0 !important')],
  ['Loader de Login muestra la marca oficial completa', loginLoaderVisible && officialLogoImmediate],
  ['Google usa popup como camino principal', login.includes('const cred = await signInWithPopup(auth, provider)')],
  ['Popup bloqueado cambia automáticamente de camino', login.includes("if (e.code === 'auth/popup-blocked')") && login.includes('await signInWithRedirect(auth, provider)')],
  ['Retorno de Google se completa una sola vez y sin bucle', login.includes('getRedirectResult(auth)') && login.includes('GOOGLE_REDIRECT_PENDING_KEY') && login.includes('handleGoogleRedirectReturn(user)')],
  ['Solo el correo oficial entra automáticamente al panel', login.includes("normalizedEmail === SUPER_ADMIN.toLowerCase()") && login.includes("window.location.replace('admin.html')")],
  ['Auth compartido no compite con el Login', authNav.includes('if(IS_LOGIN_PAGE)return;') && !authNav.includes('redirectAuthenticatedLogin')]
];

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
