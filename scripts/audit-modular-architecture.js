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
  'js/components/navigation/entrada-navegacion-publica.js',
  'js/components/navigation/escritorio/encabezado-escritorio.js',
  'js/components/navigation/escritorio/indicador-navegacion-escritorio.js',
  'js/components/navigation/tableta/encabezado-tableta.js',
  'js/components/navigation/tableta/control-menu-tableta.js',
  'js/components/navigation/movil/encabezado-movil.js',
  'js/components/navigation/movil/indicador-navegacion-movil.js',
  'js/components/navigation/compartido/panel-cuenta.js',
  'js/components/navigation/compartido/recursos-navegacion.js',
  'js/components/navigation/compartido/panel-carrito.js',
  'js/components/navigation/compartido/carga-colecciones.js',
  'js/components/navigation/compartido/panel-colecciones.js',
  'js/components/navigation/compartido/configuracion.js',
  'js/components/navigation/compartido/acordeon-pie-pagina.js',
  'js/components/navigation/compartido/iconos.js',
  'js/components/navigation/compartido/registro-paneles.js',
  'js/components/navigation/compartido/estado-ruta.js',
  'js/components/navigation/compartido/enrutador.js',
  'js/components/navigation/compartido/carga-navegacion.js',
  'js/components/navigation/compartido/control-busqueda.js',
  'js/components/navigation/compartido/panel-busqueda.js',
  'js/components/navigation/compartido/control-paneles.js',
  'js/components/navigation/compartido/capas-paneles.js',
  'css/components/navigation/escritorio/encabezado-escritorio.css',
  'css/components/navigation/tableta/encabezado-tableta.css',
  'css/components/navigation/movil/encabezado-movil.css',
  'css/components/navigation/compartido/transiciones-navegacion.css',
  'css/components/navigation/compartido/paneles.css',
  'docs/ARQUITECTURA.md',
  'docs/MAPA-DE-CODIGO.md',
  'docs/COMO-HACER-CAMBIOS.md',
];

requiredFiles.forEach(file => check(exists(file), `falta ${file}`));

if (requiredFiles.every(exists)) {
  const config = read('js/components/navigation/compartido/configuracion.js');
  check(config.includes('mobileMax: 767'), 'config: mobileMax debe ser 767');
  check(config.includes('tabletMin: 768'), 'config: tabletMin debe ser 768');
  check(config.includes('tabletMax: 1024'), 'config: tabletMax debe ser 1024');
  check(config.includes('desktopMin: 1025'), 'config: desktopMin debe ser 1025');

  const entry = read('js/components/navigation/entrada-navegacion-publica.js');
  check(entry.includes("from './escritorio/encabezado-escritorio.js'"), 'entry: falta escritorio');
  check(entry.includes("from './tableta/encabezado-tableta.js'"), 'entry: falta tableta');
  check(entry.includes("from './movil/encabezado-movil.js'"), 'entry: falta móvil');
  check(entry.includes("from './compartido/panel-busqueda.js'"), 'entry: falta buscador compartido');
  check(entry.includes("from './compartido/panel-cuenta.js'"), 'entry: falta cuenta compartida');
  check(entry.includes("from './compartido/panel-carrito.js'"), 'entry: falta carrito compartido');
  check(entry.includes("from './compartido/registro-paneles.js'"), 'entry: falta registro modular de superficies');
  check(entry.includes('await registerNavigationSurfaces()'), 'entry: monta el runtime antes de registrar superficies');

  const desktop = read('js/components/navigation/escritorio/encabezado-escritorio.js');
  const tablet = read('js/components/navigation/tableta/encabezado-tableta.js');
  const mobile = read('js/components/navigation/movil/encabezado-movil.js');
  check(!desktop.includes('tt-header-tablet'), 'escritorio contiene estructura de tableta');
  check(!desktop.includes('tt-tabbar'), 'escritorio contiene estructura móvil');
  check(!tablet.includes('tt-header-desktop-tablet'), 'tableta contiene estructura de escritorio');
  check(!tablet.includes('tt-tabbar'), 'tableta contiene estructura móvil');
  check(!mobile.includes('tt-header-desktop-tablet'), 'móvil contiene estructura de escritorio');
  check(!mobile.includes('tt-header-tablet'), 'móvil contiene estructura de tableta');

  const surfaces = read('js/components/navigation/compartido/control-paneles.js');
  const registrations = read('js/components/navigation/compartido/registro-paneles.js');
  const runtime = read('js/components/navigation/compartido/carga-navegacion.js');
  const search = read('js/components/navigation/compartido/control-busqueda.js');
  check(registrations.includes("['desktop-shop'"), 'registro: falta Tienda escritorio');
  check(registrations.includes("['tablet-menu'"), 'registro: falta menú tableta');
  check(registrations.includes("['mobile-shop'"), 'registro: falta Tienda móvil');
  check(registrations.includes("['search'"), 'registro: falta Buscar');
  check(registrations.includes("['cart'"), 'registro: falta Carrito');
  check(registrations.includes("['account'"), 'registro: falta Cuenta');
  check(registrations.includes('refreshCartBeforeOpen'), 'registro: el carrito no se actualiza al abrir');
  check(registrations.includes("controller.connect({"), 'registro: falta conectar backdrop y morph');
  check(surfaces.includes('preserveEnvironment'), 'controlador: el cambio modal a modal no preserva su entorno');
  check(surfaces.includes("this.close('outside', { restoreFocus: false })"), 'controlador: Tienda escritorio puede reabrirse por foco');
  check(runtime.includes('components/navigation/compartido/control-busqueda.js'), 'runtime: no carga el buscador modular');
  check(search.includes('aria-activedescendant'), 'buscar: falta navegación accesible de resultados');
  check(search.includes('productSearchText'), 'buscar: falta índice normalizado reutilizable');
  check(search.includes('tintin:products-error'), 'buscar: falta estado de error del catálogo');

  const legacyAdapters = [
    ['js/inicio-navegacion-publica.js', 'components/navigation/entrada-navegacion-publica.js'],
    ['js/ui-navigation-controller.js', 'components/navigation/compartido/control-paneles.js'],
    ['js/components/navigation/compatibilidad/navegacion-escritorio.js', 'components/navigation/escritorio/indicador-navegacion-escritorio.js'],
    ['js/components/navigation/compatibilidad/navegacion-tableta.js', 'components/navigation/tableta/control-menu-tableta.js'],
    ['js/components/navigation/compatibilidad/navegacion-movil.js', 'components/navigation/movil/indicador-navegacion-movil.js'],
    ['js/components/navigation/compatibilidad/navegacion-compartida.js', 'components/navigation/compartido/enrutador.js'],
    ['js/components/navigation/compatibilidad/colecciones.js', 'components/navigation/compartido/carga-colecciones.js'],
  ];

  legacyAdapters.forEach(([file, target]) => {
    const source = read(file);
    check(source.includes(target), `${file}: no apunta a ${target}`);
    check(source.split('\n').length < 50, `${file}: volvió a crecer y dejó de ser un adaptador`);
  });

  const legacyCssAdapters = [
    ['css/components/navigation/compatibilidad/navegacion-escritorio.css', 'components/navigation/escritorio/encabezado-escritorio.css'],
    ['css/components/navigation/compatibilidad/navegacion-tableta.css', 'components/navigation/tableta/encabezado-tableta.css'],
    ['css/components/navigation/compatibilidad/navegacion-movil.css', 'components/navigation/movil/encabezado-movil.css'],
    ['css/components/navigation/compatibilidad/navegacion-compartida.css', 'components/navigation/compartido/transiciones-navegacion.css'],
    ['css/components/navigation/compartido/control-paneles.css', 'components/navigation/compartido/paneles.css'],
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
