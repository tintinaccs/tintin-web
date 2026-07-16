#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260716-product-page-1';
const PUBLIC_PAGES = [
  '404.html', 'about.html', 'cambios-devoluciones.html', 'catalogo.html',
  'checkout.html', 'collections.html', 'contact.html', 'envios.html',
  'index.html', 'login.html', 'perfil.html', 'preguntas-frecuentes.html',
  'privacidad.html', 'product.html', 'terminos.html',
];
const SHELL_IDS = [
  'tt-header-desktop-tablet', 'search-panel', 'mobile-menu', 'tt-tabbar',
  'cart-overlay', 'cart-drawer', 'collections-sheet', 'sheet-backdrop',
];
const failures = [];
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const page of PUBLIC_PAGES) {
  const html = read(page);
  const shellScripts = html.match(/<script\b[^>]*src=["']js\/public-shell\.js[^"']*["'][^>]*><\/script>/gi) || [];
  const classicScripts = html.match(/<script\b[^>]*src=["']script\.js[^"']*["'][^>]*><\/script>/gi) || [];

  check(shellScripts.length === 1, `${page}: debe cargar public-shell.js exactamente una vez`);
  check(shellScripts[0]?.includes(`?v=${VERSION}`), `${page}: public-shell.js no usa la version actual`);
  check(/<script\b[^>]*src=["']js\/public-shell\.js[^>]*\bdefer\b/i.test(html), `${page}: public-shell.js debe ser defer`);
  check(classicScripts.length === 1, `${page}: debe cargar script.js exactamente una vez`);
  check(/href=["']styles\.css\?v=tintin-[^"']+["']/i.test(html), `${page}: falta styles.css compartido`);
  check(!/src=["']js\/(?:auth-nav|nav-collections|products-store|cart-sync)\.js/i.test(html), `${page}: conserva un runtime de header duplicado`);
  for (const id of SHELL_IDS) {
    check(!new RegExp(`<[^>]+id=["']${id}["']`, 'i').test(html), `${page}: conserva HTML local duplicado para #${id}`);
  }
}

const shell = read('js/public-shell.js');
for (const id of SHELL_IDS) {
  check(shell.includes(`id="${id}"`), `public-shell.js: falta #${id}`);
}
[
  'btn-menu', 'btn-tienda', 'btn-search', 'btn-cuenta', 'btn-cart',
  'tabbar-tienda', 'tabbar-search', 'tabbar-cart', 'tabbar-cuenta',
].forEach(id => check(shell.includes(`id="${id}"`), `public-shell.js: falta el control #${id}`));
check(shell.includes("import(versioned('./auth-nav.js'))"), 'public-shell.js: falta cuenta compartida');
check(shell.includes("import(versioned('./nav-collections.js'))"), 'public-shell.js: faltan colecciones compartidas');
check(shell.includes("import(versioned('./products-store.js'))"), 'public-shell.js: faltan productos en vivo para buscar/carrito');
check(shell.includes("import(versioned('./cart-sync.js'))"), 'public-shell.js: falta sincronizacion del carrito');

const styles = read('styles.css');
check(/@media \(min-width: 769px\)[\s\S]*?\.tt-tabbar\s*\{[\s\S]*?display:\s*none\s*!important/i.test(styles), 'styles.css: la barra mobile no esta aislada de desktop/tablet');
check(/@media \(max-width: 768px\)[\s\S]*?\.tt-header\s*\{[\s\S]*?display:\s*none\s*!important/i.test(styles), 'styles.css: el header desktop/tablet no esta aislado de mobile');
check(/@media \(max-width: 768px\)[\s\S]*?\.tt-tabbar\s*\{\s*display:\s*flex/i.test(styles), 'styles.css: la barra mobile no se habilita en su rango');

const scrollRuntime = read('js/header-scroll-hide.js');
check(scrollRuntime.includes('@media (min-width: 769px)'), 'header-scroll-hide.js: la animacion del header no cubre desktop/tablet');
check(scrollRuntime.includes('requestAnimationFrame(onScroll)'), 'header-scroll-hide.js: el scroll no esta sincronizado con frames');

const pageAudit = read('js/page-audit-fix.js');
check(!pageAudit.includes('tt-checkout-header-excluded'), 'page-audit-fix.js: checkout todavia excluye el header compartido');

if (failures.length) {
  console.error(`Public shell audit failed (${failures.length})`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Public shell audit passed: ${PUBLIC_PAGES.length} public screens share one responsive header.`);
