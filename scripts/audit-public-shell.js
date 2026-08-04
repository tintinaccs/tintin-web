#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_PAGES = [
  '404.html', 'about.html', 'cambios-devoluciones.html', 'catalogo.html',
  'checkout.html', 'collections.html', 'contact.html', 'envios.html',
  'index.html', 'login.html', 'perfil.html', 'preguntas-frecuentes.html',
  'privacidad.html', 'product.html', 'terminos.html',
];
const SHELL_IDS = [
  'tt-header-desktop-tablet', 'tt-header-tablet', 'search-panel', 'tt-tablet-menu',
  'tt-tabbar', 'cart-drawer', 'account-drawer', 'collections-sheet',
  'tt-shared-backdrop', 'tt-shared-morph',
];
const COMPONENTS = {
  desktop: 'js/components/navigation/desktop/header-desktop.js',
  tablet: 'js/components/navigation/tablet/header-tablet.js',
  mobile: 'js/components/navigation/mobile/header-mobile.js',
  search: 'js/components/navigation/shared/search-panel.js',
  cart: 'js/components/navigation/shared/cart-drawer.js',
  account: 'js/components/navigation/shared/account-drawer.js',
  collections: 'js/components/navigation/shared/collections-sheet.js',
  layer: 'js/components/navigation/shared/surface-layer.js',
};
const failures = [];
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const page of PUBLIC_PAGES) {
  const html = read(page);
  const shellScripts = html.match(/<script\b[^>]*src=["']js\/public-shell\.js[^"']*["'][^>]*><\/script>/gi) || [];
  const controllerScripts = html.match(/<script\b[^>]*src=["']js\/ui-navigation-controller\.js[^"']*["'][^>]*><\/script>/gi) || [];
  const classicScripts = html.match(/<script\b[^>]*src=["']script\.js[^"']*["'][^>]*><\/script>/gi) || [];
  const loaderScripts = html.match(/<script\b[^>]*src=["']js\/page-loader\.js[^"']*["'][^>]*><\/script>/gi) || [];

  check(shellScripts.length === 1, `${page}: debe cargar public-shell.js exactamente una vez`);
  check(/<script\b[^>]*src=["']js\/public-shell\.js[^>]*\bdefer\b/i.test(html), `${page}: public-shell.js debe ser defer`);
  check(controllerScripts.length === 1, `${page}: debe cargar ui-navigation-controller.js exactamente una vez`);
  check(/<script\b[^>]*src=["']js\/ui-navigation-controller\.js[^>]*\bdefer\b/i.test(html), `${page}: ui-navigation-controller.js debe ser defer`);
  check(classicScripts.length === 1, `${page}: debe cargar script.js exactamente una vez`);
  check(loaderScripts.length === 1, `${page}: debe cargar page-loader.js exactamente una vez`);
  check(/href=["']styles\.css\?v=tintin-[^"']+["']/i.test(html), `${page}: falta styles.css compartido`);
  check(!/src=["']js\/(?:auth-nav|nav-collections|products-store|cart-sync)\.js/i.test(html), `${page}: conserva un runtime de navegación duplicado`);

  for (const id of SHELL_IDS) {
    check(!new RegExp(`<[^>]+id=["']${id}["']`, 'i').test(html), `${page}: conserva HTML local duplicado para #${id}`);
  }
}

Object.entries(COMPONENTS).forEach(([name, file]) => {
  check(exists(file), `falta el componente ${name}: ${file}`);
});

const bootstrap = read('js/public-shell.js');
check(bootstrap.includes('./components/navigation/public-shell-entry.js'), 'public-shell.js no apunta al entry modular');
check(!bootstrap.includes('function topShell()'), 'public-shell.js todavía contiene el HTML monolítico anterior');
check(bootstrap.split('\n').length < 50, 'public-shell.js dejó de ser un bootstrap pequeño');

const entry = read('js/components/navigation/public-shell-entry.js');
Object.values(COMPONENTS).forEach(file => {
  const moduleName = path.basename(file);
  check(entry.includes(moduleName), `public-shell-entry.js no importa ${moduleName}`);
});
check(entry.includes("architecture: 'modular-navigation-v1'"), 'el shell modular no publica su versión de arquitectura');

const componentSources = Object.fromEntries(
  Object.entries(COMPONENTS).map(([name, file]) => [name, read(file)])
);
check(componentSources.desktop.includes('id="tt-header-desktop-tablet"'), 'desktop: falta su header aislado');
check(componentSources.tablet.includes('id="tt-header-tablet"'), 'tablet: falta su header aislado');
check(componentSources.tablet.includes('id="tt-tablet-menu"'), 'tablet: falta su menú aislado');
check(componentSources.mobile.includes('id="tt-tabbar"'), 'mobile: falta su tabbar aislada');
check(componentSources.search.includes('id="search-panel"'), 'shared/search: falta el panel');
check(componentSources.cart.includes('id="cart-drawer"'), 'shared/cart: falta el drawer');
check(componentSources.account.includes('id="account-drawer"'), 'shared/account: falta el drawer');
check(componentSources.collections.includes('id="collections-sheet"'), 'shared/collections: falta la hoja');
check(componentSources.layer.includes('id="tt-shared-backdrop"'), 'shared/surfaces: falta el backdrop único');

const runtime = read('js/components/navigation/shared/runtime.js');
check(runtime.includes("components/navigation/desktop/controller.js"), 'runtime: falta controlador desktop modular');
check(runtime.includes("components/navigation/tablet/controller.js"), 'runtime: falta controlador tablet modular');
check(runtime.includes("components/navigation/mobile/controller.js"), 'runtime: falta controlador mobile modular');
check(runtime.includes("components/navigation/shared/collections-runtime.js"), 'runtime: colecciones todavía dependen del archivo legado');
check(runtime.includes("import(versionedJsModule('auth-nav.js'))"), 'runtime: falta cuenta compartida');
check(runtime.includes("import(versionedJsModule('cart-sync.js'))"), 'runtime: falta sincronización del carrito');

const controllerBootstrap = read('js/ui-navigation-controller.js');
check(controllerBootstrap.includes('./components/navigation/shared/surface-controller.js'), 'ui-navigation-controller.js no apunta al controlador modular');
const surfaceController = read('js/components/navigation/shared/surface-controller.js');
check(surfaceController.includes("this.state = 'idle'"), 'controlador: falta estado idle');
check(surfaceController.includes("this.surface = 'none'"), 'controlador: falta superficie none');
check(surfaceController.includes('preserveEnvironment'), 'controlador: el cambio modal a modal no preserva el entorno');
check(surfaceController.includes('this.lockScroll()'), 'controlador: falta bloqueo de scroll compartido');
check(surfaceController.includes("this.close('outside', { restoreFocus: false })"), 'controlador: el cierre exterior desktop puede devolver foco y reabrir Tienda');

const desktopStyles = read('css/components/navigation/desktop/header-desktop.css');
const tabletStyles = read('css/components/navigation/tablet/header-tablet.css');
const mobileStyles = read('css/components/navigation/mobile/header-mobile.css');
const surfaceStyles = read('css/components/navigation/shared/surfaces.css');
check(/@media \(min-width: 1025px\)/.test(desktopStyles), 'desktop: falta el corte exacto >=1025px');
check(/@media \(min-width: 768px\) and \(max-width: 1024px\)/.test(tabletStyles), 'tablet: falta el rango exacto 768-1024px');
check(/@media \(max-width: 767px\)/.test(mobileStyles), 'mobile: falta el rango exacto <=767px');
check(desktopStyles.includes('.tt-nav-dropdown:not(.open) .tt-dropdown'), 'desktop: falta el cierre visual definitivo de Tienda');
check(desktopStyles.includes('width: 68px !important'), 'desktop: las imágenes de colecciones no fueron ampliadas');
check(surfaceStyles.includes('grid-template-columns: auto minmax(0, 1fr) auto'), 'buscar: falta la estructura grid estable');
check(surfaceStyles.includes('width: min(1120px, calc(100vw - 64px))'), 'buscar desktop: falta el tamaño ampliado');
check(surfaceStyles.includes('linear-gradient(135deg, #8f204b, #c53f75)'), 'cuenta: falta el encabezado sólido de alto contraste');

[
  ['js/navigation-desktop.js', 'components/navigation/desktop/controller.js'],
  ['js/navigation-tablet.js', 'components/navigation/tablet/controller.js'],
  ['js/navigation-mobile.js', 'components/navigation/mobile/controller.js'],
  ['js/navigation-shared.js', 'components/navigation/shared/router.js'],
  ['js/nav-collections.js', 'components/navigation/shared/collections-runtime.js'],
].forEach(([legacy, source]) => {
  check(read(legacy).includes(source), `${legacy}: no actúa como compatibilidad hacia ${source}`);
});

if (failures.length) {
  console.error(`Public shell modular audit failed (${failures.length})`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Public shell modular audit passed: ${PUBLIC_PAGES.length} pantallas usan navegación separada en desktop, tablet, mobile y shared.`);
