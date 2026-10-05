#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const failures = [];
// Rosa uniforme solicitado para loader y superficies de marca.
const OFFICIAL_LOADER_BACKGROUND = '#F8AACA';

function check(condition, message) {
  if (!condition) failures.push(message);
}

const loaderRuntime = read('js/cargador-pagina.js');
const solidCss = read('css/theme/fondo-solido-cargador.css');
const loaderBrand = read('assets-tintin/images/general/tintin-loader-brand.svg');

check(
  /#tt-loader\{[^}]*background:#F8AACA/i.test(loaderRuntime),
  `js/cargador-pagina.js debe conservar el fondo sólido oficial ${OFFICIAL_LOADER_BACKGROUND} desde la primera pintura.`
);
// Antes esto se cargaba con un @import dentro de tokens-color.css y la
// comprobación miraba esa única línea. Ahora va como <link> en cada página
// (los @import encadenados bloqueaban el render en serie), así que se verifica
// lo que de verdad importa: que TODA página que usa los tokens cargue también
// la protección del loader, y antes de ellos para conservar la cascada.
const pagesWithTokens = fs.readdirSync(ROOT)
  .filter(name => name.endsWith('.html'))
  .map(name => ({ name, source: read(name) }))
  .filter(page => page.source.includes('css/core/tokens-color.css'));

check(pagesWithTokens.length > 0, 'No se encontró ninguna página que cargue css/core/tokens-color.css.');

pagesWithTokens.forEach(({ name, source }) => {
  const loaderAt = source.indexOf('css/theme/fondo-solido-cargador.css');
  const tokensAt = source.indexOf('css/core/tokens-color.css');
  check(
    loaderAt !== -1,
    `${name} debe cargar css/theme/fondo-solido-cargador.css (protección universal del loader).`
  );
  check(
    loaderAt !== -1 && loaderAt < tokensAt,
    `${name} debe cargar css/theme/fondo-solido-cargador.css antes de css/core/tokens-color.css.`
  );
});
check(
  /html body #tt-loader\s*\{[^}]*background:\s*#F8AACA\s*!important[^}]*background-color:\s*#F8AACA\s*!important/is.test(solidCss),
  `El contenedor del loader debe forzar fondo y background-color sólidos en ${OFFICIAL_LOADER_BACKGROUND}.`
);
const wordmarkRule = solidCss.match(/html body #tt-loader-wordmark,\s*html body #tt-loader-wordmark \.tt-loader-wordmark-i\s*\{([^}]*)\}/i)?.[1] || '';
const wordmarkColor = wordmarkRule.match(/color:\s*(#[0-9a-f]{6})\s*!important/i)?.[1] || '';
function relativeLuminance(hex) {
  const rgb = hex.slice(1).match(/../g)?.map(channel => parseInt(channel, 16) / 255) || [];
  if (rgb.length !== 3) return NaN;
  const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
const bgLum = relativeLuminance(OFFICIAL_LOADER_BACKGROUND);
const textLum = relativeLuminance(wordmarkColor);
const wordmarkContrast = wordmarkColor
  ? (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05)
  : 0;
check(
  wordmarkColor.toUpperCase() === '#FFFFFF' && /color:#FFFFFF!important/i.test(loaderRuntime),
  'El loader debe usar blanco puro en CSS y runtime según la identidad solicitada. El blanco sobre rosa claro no alcanza AA para texto normal; no se declara conformidad AA.'
);
check(
  /html body #tt-loader::before\s*\{[^}]*background:\s*#F8AACA\s*!important[^}]*opacity:\s*1\s*!important/is.test(solidCss),
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
