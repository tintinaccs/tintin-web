'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('css/pages/home/ajuste-inicio.css');
const cleanup = read('css/core/limpieza-tema-tintin.css');
const heroSurface = home.match(/\.tt-home-premium \.tt-hero-media picture,[^{]*\{([^}]+)\}/)?.[1] || '';

const checks = [
  ['Hero con respaldo blanco sólido de la paleta unificada', /background-color:\s*#FFFFFF\s*!important/i.test(heroSurface)],
  ['Ajuste independiente en desktop', home.includes('object-fit:var(--tt-hero-fit-desktop,cover)!important') && home.includes('--tt-hero-pos-desktop')],
  ['Ajuste independiente en tablet', home.includes('object-fit:var(--tt-hero-fit-tablet,cover)!important') && home.includes('--tt-hero-scale-tablet')],
  ['Ajuste independiente en mobile', home.includes('object-fit:var(--tt-hero-fit-mobile,cover)!important') && home.includes('--tt-hero-scale-mobile')],
  ['Botón secundario del hero siempre legible', home.includes('.tt-hero-actions .tt-btn-outline') && home.includes('background:#FFFFFF!important')],
  ['Consentimiento de privacidad sólido', cleanup.includes('#tt-privacy-consent.tt-privacy-consent') && cleanup.includes('isolation:isolate!important')],
  ['Botón Tienda conserva color de marca', cleanup.includes('#btn-tienda') && cleanup.includes('color:var(--tt-accent,var(--color-brand-primary, #F8AACA))!important')]
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
