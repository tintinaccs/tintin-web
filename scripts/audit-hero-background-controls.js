'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('css/home-fit.css');
const cleanup = read('css/tintin-theme-cleanup.css');

const checks = [
  ['Hero con respaldo sólido', home.includes('.tt-home-premium .tt-hero-media picture') && home.includes('background-color:#FFF6FA!important')],
  ['Ajuste independiente en desktop', home.includes('object-fit:var(--tt-hero-fit-desktop,cover)!important') && home.includes('--tt-hero-pos-desktop')],
  ['Ajuste independiente en tablet', home.includes('object-fit:var(--tt-hero-fit-tablet,cover)!important') && home.includes('--tt-hero-scale-tablet')],
  ['Ajuste independiente en mobile', home.includes('object-fit:var(--tt-hero-fit-mobile,cover)!important') && home.includes('--tt-hero-scale-mobile')],
  ['Botón secundario del hero siempre legible', home.includes('.tt-hero-actions .tt-btn-outline') && home.includes('background:#FFFFFF!important')],
  ['Consentimiento de privacidad sólido', cleanup.includes('#tt-privacy-consent.tt-privacy-consent') && cleanup.includes('isolation:isolate!important')],
  ['Botón Tienda conserva color de marca', cleanup.includes('#btn-tienda') && cleanup.includes('color:var(--tt-accent,#AD3F67)!important')]
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
