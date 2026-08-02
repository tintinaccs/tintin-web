#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const failures = [];
const OFFICIAL_LOADER_BACKGROUND = '#FFADD1';

function check(condition, message) {
  if (!condition) failures.push(message);
}

const loaderRuntime = read('js/page-loader.js');
const solidCss = read('css/loader-solid-background.css');
const loaderBrand = read('assets-tintin/images/general/tintin-loader-brand.svg');

check(
  /#tt-loader\{[^}]*background:#FFADD1/i.test(loaderRuntime),
  `js/page-loader.js debe conservar el fondo sólido oficial ${OFFICIAL_LOADER_BACKGROUND} desde la primera pintura.`
);
// Antes esto se cargaba con un @import dentro de color-tokens.css y la
// comprobación miraba esa única línea. Ahora va como <link> en cada página
// (los @import encadenados bloqueaban el render en serie), así que se verifica
// lo que de verdad importa: que TODA página que usa los tokens cargue también
// la protección del loader, y antes de ellos para conservar la cascada.
const pagesWithTokens = fs.readdirSync(ROOT)
  .filter(name => name.endsWith('.html'))
  .map(name => ({ name, source: read(name) }))
  .filter(page => page.source.includes('css/color-tokens.css'));

check(pagesWithTokens.length > 0, 'No se encontró ninguna página que cargue css/color-tokens.css.');

pagesWithTokens.forEach(({ name, source }) => {
  const loaderAt = source.indexOf('css/loader-solid-background.css');
  const tokensAt = source.indexOf('css/color-tokens.css');
  check(
    loaderAt !== -1,
    `${name} debe cargar css/loader-solid-background.css (protección universal del loader).`
  );
  check(
    loaderAt !== -1 && loaderAt < tokensAt,
    `${name} debe cargar css/loader-solid-background.css antes de css/color-tokens.css.`
  );
});
check(
  /html body #tt-loader\s*\{[^}]*background:\s*#FFADD1\s*!important[^}]*background-color:\s*#FFADD1\s*!important/is.test(solidCss),
  `El contenedor del loader debe forzar fondo y background-color sólidos en ${OFFICIAL_LOADER_BACKGROUND}.`
);
check(
  /html body #tt-loader::before\s*\{[^}]*background:\s*#FFADD1\s*!important[^}]*opacity:\s*1\s*!important/is.test(solidCss),
  `El loader debe conservar una capa sólida ${OFFICIAL_LOADER_BACKGROUND} independiente detrás del logo.`
);
check(
  !/(?:#tt-loader|tt-loader::before)[^{]*\{[^}]*(?:background|background-color)\s*:\s*transparent/i.test(solidCss),
  'La protección del loader no puede declarar fondos transparentes.'
);
check(
  !/#FFF6FA/i.test(solidCss),
  'La protección universal del loader no puede volver a usar el fondo anterior #FFF6FA.'
);
check(
  /<image\b[^>]*(?:href|xlink:href)=["']logo\.png["']/i.test(loaderBrand),
  'El recurso del loader debe reutilizar directamente assets-tintin/images/general/logo.png.'
);
check(
  !/<path\b/i.test(loaderBrand),
  'El recurso del loader no puede volver a contener un dibujo vectorial reinterpretado.'
);
check(
  /#tt-loader-logo[\s\S]*clip-path:\s*none\s*!important/i.test(solidCss),
  'El logo oficial debe mostrarse completo; falta anular clip-path.'
);
check(
  /#tt-loader-logo[\s\S]*animation:\s*none\s*!important/i.test(solidCss),
  'El logo oficial no puede volver a cargarse de arriba hacia abajo.'
);
check(
  !/body:has\(\.login-page\)\s+#tt-loader-spin-wrap\s*\{[\s\S]*display:\s*none/i.test(solidCss),
  'Login no puede ocultar la identidad oficial del loader global.'
);

if (failures.length) {
  console.error(`Auditoría del loader fallida: ${failures.length} problema(s).`);
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`Auditoría del loader correcta: fondo ${OFFICIAL_LOADER_BACKGROUND}, logo oficial completo y sin revelado vertical.`);
