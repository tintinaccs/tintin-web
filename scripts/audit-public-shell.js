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
  desktop: 'js/components/navigation/escritorio/encabezado-escritorio.js',
  tablet: 'js/components/navigation/tableta/encabezado-tableta.js',
  mobile: 'js/components/navigation/movil/encabezado-movil.js',
  search: 'js/components/navigation/compartido/panel-busqueda.js',
  cart: 'js/components/navigation/compartido/panel-carrito.js',
  account: 'js/components/navigation/compartido/panel-cuenta.js',
  collections: 'js/components/navigation/compartido/panel-colecciones.js',
  layer: 'js/components/navigation/compartido/capas-paneles.js',
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
check(componentSources.desktop.includes('id="tt-header-desktop-tablet"'), 'escritorio: falta su encabezado aislado');
check(componentSources.tablet.includes('id="tt-header-tablet"'), 'tableta: falta su encabezado aislado');
check(componentSources.tablet.includes('id="tt-tablet-menu"'), 'tableta: falta su menú aislado');
check(componentSources.mobile.includes('id="tt-tabbar"'), 'móvil: falta su barra aislada');
check(componentSources.search.includes('id="search-panel"'), 'shared/search: falta el panel');
check(componentSources.cart.includes('id="cart-drawer"'), 'shared/cart: falta el drawer');
check(componentSources.account.includes('id="account-drawer"'), 'shared/account: falta el drawer');
check(componentSources.collections.includes('id="collections-sheet"'), 'shared/collections: falta la hoja');
check(componentSources.layer.includes('id="tt-shared-backdrop"'), 'shared/surfaces: falta el backdrop único');

const runtime = read('js/components/navigation/compartido/carga-navegacion.js');
check(runtime.includes("components/navigation/escritorio/indicador-navegacion-escritorio.js"), 'runtime: falta indicador de navegación de escritorio');
check(runtime.includes("components/navigation/tableta/control-menu-tableta.js"), 'runtime: falta control del menú de tableta');
check(runtime.includes("components/navigation/movil/indicador-navegacion-movil.js"), 'runtime: falta indicador de navegación móvil');
check(runtime.includes("components/navigation/compartido/carga-colecciones.js"), 'runtime: colecciones todavía dependen del archivo legado');
check(runtime.includes("components/navigation/compartido/control-busqueda.js"), 'runtime: falta el control modular de búsqueda');
check(runtime.includes("import(versionedJsModule('core/auth/auth-nav.js'))"), 'runtime: falta cuenta compartida');
check(runtime.includes("import(versionedJsModule('components/cart/cart-sync.js'))"), 'runtime: falta sincronización del carrito');

const controllerBootstrap = read('js/ui-navigation-controller.js');
check(controllerBootstrap.includes('./components/navigation/compartido/control-paneles.js'), 'ui-navigation-controller.js no apunta al controlador modular');
const surfaceController = read('js/components/navigation/compartido/control-paneles.js');
check(surfaceController.includes("this.state = 'idle'"), 'controlador: falta estado idle');
check(surfaceController.includes("this.surface = 'none'"), 'controlador: falta superficie none');
check(surfaceController.includes('preserveEnvironment'), 'controlador: el cambio modal a modal no preserva el entorno');
check(surfaceController.includes('this.lockScroll()'), 'controlador: falta bloqueo de scroll compartido');
check(surfaceController.includes("this.close('outside', { restoreFocus: false })"), 'controlador: el cierre exterior de escritorio puede devolver foco y reabrir Tienda');

const desktopStyles = read('css/components/navigation/escritorio/encabezado-escritorio.css');
const tabletStyles = read('css/components/navigation/tableta/encabezado-tableta.css');
const mobileStyles = read('css/components/navigation/movil/encabezado-movil.css');
const surfaceStyles = read('css/components/navigation/compartido/paneles.css');
check(/@media \(min-width: 1025px\)/.test(desktopStyles), 'escritorio: falta el corte exacto >=1025px');
check(/@media \(min-width: 768px\) and \(max-width: 1024px\)/.test(tabletStyles), 'tableta: falta el rango exacto 768-1024px');
check(/@media \(max-width: 767px\)/.test(mobileStyles), 'móvil: falta el rango exacto <=767px');
check(desktopStyles.includes('.tt-nav-dropdown:not(.open) .tt-dropdown'), 'escritorio: falta el cierre visual definitivo de Tienda');
check(desktopStyles.includes('width: 68px !important'), 'escritorio: las imágenes de colecciones no fueron ampliadas');
check(surfaceStyles.includes('grid-template-columns: auto minmax(0, 1fr) auto'), 'buscar: falta la estructura grid estable');
check(surfaceStyles.includes('width: min(1120px, calc(100vw - 64px))'), 'buscar escritorio: falta el tamaño ampliado');
check(surfaceStyles.includes('linear-gradient(135deg, #8f204b, #c53f75)'), 'cuenta: falta el encabezado sólido de alto contraste');

[
  ['js/components/navigation/legacy/navigation-desktop.js', 'components/navigation/escritorio/indicador-navegacion-escritorio.js'],
  ['js/components/navigation/legacy/navigation-tablet.js', 'components/navigation/tableta/control-menu-tableta.js'],
  ['js/components/navigation/legacy/navigation-mobile.js', 'components/navigation/movil/indicador-navegacion-movil.js'],
  ['js/components/navigation/legacy/navigation-shared.js', 'components/navigation/compartido/enrutador.js'],
  ['js/components/navigation/legacy/nav-collections.js', 'components/navigation/compartido/carga-colecciones.js'],
].forEach(([legacy, source]) => {
  check(read(legacy).includes(source), `${legacy}: no actúa como compatibilidad hacia ${source}`);
});

if (failures.length) {
  console.error(`Public shell modular audit failed (${failures.length})`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Public shell modular audit passed: ${PUBLIC_PAGES.length} pantallas usan navegación separada en escritorio, tableta, móvil y shared.`);
