#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const loaderRuntime = read('js/page-loader.js');
const colorTokens = read('css/color-tokens.css');
const solidCss = read('css/loader-solid-background.css');

check(
  /#tt-loader\{[^}]*background:#FFF6FA/i.test(loaderRuntime),
  'js/page-loader.js debe conservar un fondo sólido desde la primera pintura.'
);
check(
  /@import\s+url\(["']\.\/loader-solid-background\.css\?v=[^"']+["']\)/i.test(colorTokens),
  'css/color-tokens.css debe cargar la protección universal del loader.'
);
check(
  /html body #tt-loader\s*\{[^}]*background:\s*#FFF6FA\s*!important[^}]*background-color:\s*#FFF6FA\s*!important/is.test(solidCss),
  'El contenedor del loader debe forzar fondo y background-color sólidos.'
);
check(
  /html body #tt-loader::before\s*\{[^}]*background:\s*#FFF6FA\s*!important[^}]*opacity:\s*1\s*!important/is.test(solidCss),
  'El loader debe conservar una capa sólida independiente detrás del logo.'
);
check(
  !/(?:#tt-loader|tt-loader::before)[^{]*\{[^}]*(?:background|background-color)\s*:\s*transparent/i.test(solidCss),
  'La protección del loader no puede declarar fondos transparentes.'
);

if (failures.length) {
  console.error(`Auditoría de fondo del loader fallida: ${failures.length} problema(s).`);
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log('Auditoría de fondo del loader correcta: contenedor y capa de respaldo son sólidos.');
