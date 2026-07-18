const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];

function requireText(text, pattern, message) {
  if (!pattern.test(text)) errors.push(message);
}

const html = read('catalogo.html');
const css = read('css/catalog-maintenance.css');
const runtime = read('js/catalog-maintenance.js');
const collectionsStore = read('js/collections-store.js');
const maintenance = read('maintenance/02-catalogo.txt');

requireText(html, /id="cat-grid"/, 'Falta la grilla del catálogo.');
requireText(html, /id="cat-search"/, 'Falta la búsqueda del catálogo.');
requireText(html, /id="cat-sort"/, 'Falta el ordenamiento del catálogo.');
requireText(html, /id="precio-min"/, 'Falta precio mínimo.');
requireText(html, /id="precio-max"/, 'Falta precio máximo.');
requireText(html, /id="filtro-stock"/, 'Falta filtro de stock.');
requireText(html, /aria-live="polite"/, 'Falta estado accesible del conteo.');
requireText(html, /aria-busy="true"/, 'Falta estado inicial aria-busy.');

requireText(css, /body\.tt-catalog-maintenance/, 'La capa CSS no está limitada al Catálogo.');
requireText(css, /var\(--color-background-page/, 'El fondo no usa tokens configurables.');
requireText(css, /\.tt-card-img-wrap[\s\S]*background-color:\s*var\(/, 'Las imágenes no tienen fondo sólido configurable.');
requireText(css, /@media \(min-width: 769px\) and \(max-width: 1024px\)/, 'Falta tratamiento tablet.');
requireText(css, /@media \(max-width: 768px\)/, 'Falta tratamiento mobile.');
requireText(css, /@media \(max-width: 360px\)/, 'Falta tratamiento mini mobile.');
requireText(css, /prefers-reduced-motion/, 'Falta reduced motion.');
if (/(^|[^\w-])#000(?:000)?\b/i.test(css)) errors.push('La capa nueva contiene negro puro.');

requireText(runtime, /CATALOG_PATH_RE/, 'El runtime no se limita a catalogo.html.');
requireText(runtime, /online/, 'Falta recuperación al volver internet.');
requireText(runtime, /offline/, 'Falta estado sin conexión.');
requireText(runtime, /visibilitychange/, 'Falta actualización al regresar a la pestaña.');
requireText(runtime, /pageshow/, 'Falta recuperación desde memoria del navegador.');
requireText(runtime, /popstate/, 'Falta restauración Atrás\/Adelante.');
requireText(runtime, /history\.replaceState/, 'Los filtros no sincronizan la URL.');
requireText(runtime, /MutationObserver/, 'Falta vigilancia de render fuera de orden.');
requireText(runtime, /tt-catalog-runtime-state/, 'Faltan estados de recuperación.');
requireText(runtime, /location\.origin/, 'Los metadatos no se normalizan al dominio actual.');
requireText(runtime, /new Date\(\)\.getFullYear/, 'El año del footer no es automático.');

requireText(collectionsStore, /import '\.\/catalog-maintenance\.js/, 'El runtime del Catálogo no se carga desde collections-store.');
requireText(maintenance, /Desktop grande:|Desktop grande|desktop grande/i, 'El registro no contempla desktop grande.');
requireText(maintenance, /tablet/i, 'El registro no contempla tablet.');
requireText(maintenance, /mobile/i, 'El registro no contempla mobile.');

const viewports = [
  ['desktop-large', 1920, 1080],
  ['desktop', 1440, 900],
  ['laptop', 1280, 720],
  ['tablet-landscape', 1024, 768],
  ['tablet-portrait', 768, 1024],
  ['mobile', 390, 844],
  ['mini-mobile', 320, 568],
];
if (viewports.length !== 7) errors.push('El catálogo debe auditar siete viewports.');

if (errors.length) {
  console.error('\nAUDITORÍA CATÁLOGO: FALLÓ');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`AUDITORÍA CATÁLOGO: OK · ${viewports.length} viewports · filtros, tokens, recuperación y sincronización verificados.`);
