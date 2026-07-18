const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const warnings = [];

function requireText(text, pattern, message) {
  if (!pattern.test(text)) errors.push(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) errors.push(message);
}

const html = read('index.html');
const css = read('css/home-maintenance.css');
const runtime = read('js/home-maintenance.js');
const shell = read('js/public-shell.js');
const manifest = JSON.parse(read('diagnostic-manifest.json'));

[
  ['hero', /id=["']hero["']/],
  ['trust bar', /class=["'][^"']*tt-trust-bar/],
  ['collections', /class=["'][^"']*tt-collections-section/],
  ['look', /id=["']look-grid["']/],
  ['products', /id=["']products-grid["']/],
  ['reviews', /class=["'][^"']*tt-reviews-section/],
  ['footer', /class=["'][^"']*tt-footer/],
].forEach(([label, pattern]) => requireText(html, pattern, `Inicio no contiene ${label}.`));

requireText(html, /<meta\s+name=["']viewport["']/i, 'Inicio no declara viewport.');
requireText(html, /<meta\s+name=["']description["']/i, 'Inicio no declara description.');
requireText(html, /<link\s+rel=["']canonical["']/i, 'Inicio no declara canonical.');
requireText(html, /application\/ld\+json/i, 'Inicio no contiene JSON-LD.');
requireText(html, /window\.TT_PAGE_LOADER_WAIT\s*=\s*true/, 'Inicio no espera la señal explícita del loader.');
requireText(html, /js\/public-shell\.js/, 'Inicio no carga el shell público compartido.');
requireText(html, /css\/home-fit\.css/, 'Inicio no carga el CSS estructural temprano.');

requireText(shell, /home-maintenance\.js/, 'El shell público no carga home-maintenance.js.');
requireText(shell, /home-maintenance\.css/, 'El shell público no carga home-maintenance.css.');
requireText(shell, /currentPage\(\)\s*!==\s*['"]home['"]/, 'La capa de Inicio no está limitada únicamente a Inicio.');

requireText(runtime, /DOMContentLoaded/, 'El runtime de Inicio no contempla carga temprana.');
requireText(runtime, /MutationObserver/, 'El runtime de Inicio no vigila contenido dinámico.');
requireText(runtime, /tintin:products-loaded/, 'El runtime de Inicio no escucha productos en vivo.');
requireText(runtime, /online/, 'El runtime de Inicio no contempla reconexión.');
requireText(runtime, /offline/, 'El runtime de Inicio no contempla modo sin conexión.');
requireText(runtime, /pageshow/, 'El runtime de Inicio no contempla restauración del navegador.');
requireText(runtime, /aria-busy/, 'El runtime de Inicio no comunica estados de carga.');
requireText(runtime, /ttPageReady/, 'El runtime de Inicio no libera explícitamente el loader.');
requireText(runtime, /normalizePublicMetadata/, 'El runtime de Inicio no normaliza metadatos públicos.');
requireText(runtime, /updateFooterYear/, 'El runtime de Inicio no actualiza el año del footer.');

requireText(css, /@media\s*\(min-width:\s*769px\)\s*and\s*\(max-width:\s*1120px\)/, 'No hay tratamiento específico de tablet.');
requireText(css, /@media\s*\(max-width:\s*768px\)/, 'No hay tratamiento específico de mobile.');
requireText(css, /@media\s*\(max-width:\s*360px\)/, 'No hay tratamiento de mini mobile.');
requireText(css, /prefers-reduced-motion/, 'No se respeta reduced motion.');
requireText(css, /var\(--color-background-page/, 'Inicio no utiliza el token de fondo global.');
requireText(css, /var\(--color-text-primary/, 'Inicio no utiliza el token de texto global.');
requireText(css, /focus-visible/, 'Inicio no define foco visible.');
requireText(css, /min-height:\s*44px/, 'Los controles nuevos no garantizan tamaño táctil mínimo.');

forbid(css, /(?:^|[^A-Fa-f0-9])#000(?:000)?(?:[^A-Fa-f0-9]|$)/, 'La capa de Inicio contiene negro puro.');
forbid(css, /\bblack\b/i, 'La capa de Inicio usa la palabra black.');

const requiredViewports = [1920, 1440, 1280, 1024, 768, 390, 320];
const widths = new Set((manifest.viewports || []).map(viewport => Number(viewport.width)));
requiredViewports.forEach(width => {
  if (!widths.has(width)) errors.push(`El manifiesto no incluye el viewport obligatorio de ${width}px.`);
});

const homePage = (manifest.pages || []).find(page => page.path === 'index.html');
if (!homePage) errors.push('El manifiesto de diagnóstico no inventaría index.html.');
else {
  if (homePage.metadata?.h1Count !== 1) errors.push('Inicio debe contener exactamente un H1.');
  if (!homePage.metadata?.hasViewport) errors.push('El manifiesto indica que Inicio no tiene viewport.');
  if (!homePage.metadata?.hasDescription) errors.push('El manifiesto indica que Inicio no tiene description.');
  if (Array.isArray(homePage.duplicateIds) && homePage.duplicateIds.length) {
    errors.push(`Inicio contiene IDs duplicados: ${homePage.duplicateIds.join(', ')}.`);
  }
}

if (/tintinaccs\.github\.io\/tintin-web/i.test(html)) {
  warnings.push('index.html todavía conserva URLs históricas; home-maintenance.js las normaliza en ejecución. Conviene migrarlas estáticamente cuando se edite el HTML completo.');
}

if (errors.length) {
  console.error('\nAUDITORÍA DE INICIO: FALLÓ\n');
  errors.forEach(error => console.error(`- ${error}`));
  warnings.forEach(warning => console.warn(`- AVISO: ${warning}`));
  process.exit(1);
}

console.log('AUDITORÍA DE INICIO: CORRECTA');
console.log(`Viewports comprobados: ${requiredViewports.join(', ')} px`);
console.log('Estructura, runtime, responsive, accesibilidad, estados y tokens verificados.');
warnings.forEach(warning => console.warn(`AVISO: ${warning}`));
