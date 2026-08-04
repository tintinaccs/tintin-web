#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));
const check = (condition, message) => { if (!condition) failures.push(message); };

const requiredFiles = [
  'js/components/navigation/public-shell-entry.js',
  'js/components/navigation/desktop/header-desktop.js',
  'js/components/navigation/desktop/controller.js',
  'js/components/navigation/tablet/header-tablet.js',
  'js/components/navigation/tablet/controller.js',
  'js/components/navigation/mobile/header-mobile.js',
  'js/components/navigation/mobile/controller.js',
  'js/components/navigation/shared/account-drawer.js',
  'js/components/navigation/shared/assets.js',
  'js/components/navigation/shared/cart-drawer.js',
  'js/components/navigation/shared/collections-runtime.js',
  'js/components/navigation/shared/collections-sheet.js',
  'js/components/navigation/shared/config.js',
  'js/components/navigation/shared/footer-accordion.js',
  'js/components/navigation/shared/icons.js',
  'js/components/navigation/shared/route-state.js',
  'js/components/navigation/shared/router.js',
  'js/components/navigation/shared/runtime.js',
  'js/components/navigation/shared/search-panel.js',
  'js/components/navigation/shared/surface-controller.js',
  'js/components/navigation/shared/surface-layer.js',
  'css/components/navigation/desktop/header-desktop.css',
  'css/components/navigation/tablet/header-tablet.css',
  'css/components/navigation/mobile/header-mobile.css',
  'css/components/navigation/shared/navigation-transitions.css',
  'css/components/navigation/shared/surfaces.css',
  'docs/ARQUITECTURA.md',
  'docs/MAPA-DE-CODIGO.md',
  'docs/COMO-HACER-CAMBIOS.md',
];

requiredFiles.forEach(file => check(exists(file), `falta ${file}`));

if (requiredFiles.every(exists)) {
  const config = read('js/components/navigation/shared/config.js');
  check(config.includes('mobileMax: 767'), 'config: mobileMax debe ser 767');
  check(config.includes('tabletMin: 768'), 'config: tabletMin debe ser 768');
  check(config.includes('tabletMax: 1024'), 'config: tabletMax debe ser 1024');
  check(config.includes('desktopMin: 1025'), 'config: desktopMin debe ser 1025');

  const entry = read('js/components/navigation/public-shell-entry.js');
  check(entry.includes("from './desktop/header-desktop.js'"), 'entry: falta desktop');
  check(entry.includes("from './tablet/header-tablet.js'"), 'entry: falta tablet');
  check(entry.includes("from './mobile/header-mobile.js'"), 'entry: falta mobile');
  check(entry.includes("from './shared/search-panel.js'"), 'entry: falta buscador compartido');
  check(entry.includes("from './shared/account-drawer.js'"), 'entry: falta cuenta compartida');
  check(entry.includes("from './shared/cart-drawer.js'"), 'entry: falta carrito compartido');

  const desktop = read('js/components/navigation/desktop/header-desktop.js');
  const tablet = read('js/components/navigation/tablet/header-tablet.js');
  const mobile = read('js/components/navigation/mobile/header-mobile.js');
  check(!desktop.includes('tt-header-tablet'), 'desktop contiene estructura tablet');
  check(!desktop.includes('tt-tabbar'), 'desktop contiene estructura mobile');
  check(!tablet.includes('tt-header-desktop-tablet'), 'tablet contiene estructura desktop');
  check(!tablet.includes('tt-tabbar'), 'tablet contiene estructura mobile');
  check(!mobile.includes('tt-header-desktop-tablet'), 'mobile contiene estructura desktop');
  check(!mobile.includes('tt-header-tablet'), 'mobile contiene estructura tablet');

  const surfaces = read('js/components/navigation/shared/surface-controller.js');
  check(surfaces.includes("'desktop-shop'"), 'controlador compartido no conoce Tienda desktop');
  check(surfaces.includes("'tablet-menu'"), 'controlador compartido no conoce menú tablet');
  check(surfaces.includes("'mobile-shop'"), 'controlador compartido no conoce Tienda mobile');
  check(surfaces.includes("'search'"), 'controlador compartido no conoce Buscar');
  check(surfaces.includes("'cart'"), 'controlador compartido no conoce Carrito');
  check(surfaces.includes("'account'"), 'controlador compartido no conoce Cuenta');

  const legacyAdapters = [
    ['js/public-shell.js', 'components/navigation/public-shell-entry.js'],
    ['js/ui-navigation-controller.js', 'components/navigation/shared/surface-controller.js'],
    ['js/navigation-desktop.js', 'components/navigation/desktop/controller.js'],
    ['js/navigation-tablet.js', 'components/navigation/tablet/controller.js'],
    ['js/navigation-mobile.js', 'components/navigation/mobile/controller.js'],
    ['js/navigation-shared.js', 'components/navigation/shared/router.js'],
    ['js/nav-collections.js', 'components/navigation/shared/collections-runtime.js'],
  ];

  legacyAdapters.forEach(([file, target]) => {
    const source = read(file);
    check(source.includes(target), `${file}: no apunta a ${target}`);
    check(source.split('\n').length < 50, `${file}: volvió a crecer y dejó de ser un adaptador`);
  });

  const legacyCssAdapters = [
    ['css/navigation-desktop.css', 'components/navigation/desktop/header-desktop.css'],
    ['css/navigation-tablet.css', 'components/navigation/tablet/header-tablet.css'],
    ['css/navigation-mobile.css', 'components/navigation/mobile/header-mobile.css'],
    ['css/navigation-shared.css', 'components/navigation/shared/navigation-transitions.css'],
    ['css/surface-controller.css', 'components/navigation/shared/surfaces.css'],
  ];

  legacyCssAdapters.forEach(([file, target]) => {
    const source = read(file);
    check(source.includes(target), `${file}: no importa ${target}`);
    check(source.split('\n').length < 10, `${file}: volvió a contener estilos propios`);
  });
}

if (failures.length) {
  console.error(`Modular architecture audit failed (${failures.length})`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Modular architecture audit passed: ${requiredFiles.length} archivos obligatorios verificados.`);
