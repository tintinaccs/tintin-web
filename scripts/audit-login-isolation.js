'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('css/loader-solid-background.css');
const login = read('login.html');

const checks = [
  ['Login mantiene su contenedor propio', login.includes('class="login-page"')],
  ['Header público oculto en Login', css.includes('body:has(.login-page) #tt-header-desktop-tablet')],
  ['Barra mobile oculta en Login', css.includes('body:has(.login-page) #tt-tabbar')],
  ['Carrito y búsqueda ocultos en Login', css.includes('body:has(.login-page) #cart-drawer') && css.includes('body:has(.login-page) #search-panel')],
  ['Login no reserva espacio del shell', css.includes('body:has(.login-page).tt-public-shell-mounted') && css.includes('padding-top: 0 !important')],
  ['Loader de Login sin animación de marca', css.includes('body:has(.login-page) #tt-loader-spin-wrap') && css.includes('animation: none !important')]
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
