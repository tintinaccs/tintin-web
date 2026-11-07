'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('css/pages/home/hero-bienvenida-inicio.css');
const cleanup = read('css/core/limpieza-tema-tintin.css');
const heroSurface = home;

const checks = [
  ['Hero de referencia con fondo separado y marca plana', heroSurface.includes('--tt-flow-light:#FFCEE5') && heroSurface.includes('background:var(--tt-hero-background)!important') && heroSurface.includes('.tt-hero-brand')],
  ['Ajuste independiente en desktop', home.includes('object-fit:var(--tt-hero-fit-desktop,cover)!important') && home.includes('--tt-hero-pos-desktop')],
  ['Ajuste independiente en tablet', home.includes('object-fit:var(--tt-hero-fit-tablet,cover)!important') && home.includes('--tt-hero-scale-tablet')],
  ['Ajuste independiente en mobile', home.includes('object-fit:var(--tt-hero-fit-mobile,cover)!important') && home.includes('--tt-hero-scale-mobile')],
  ['Acciones HTML del hero siempre legibles', home.includes('.tt-hero-cta') && home.includes('background:var(--tt-hero-ink)!important;color:#fff!important') && home.includes('.tt-hero-link')],
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
