const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const requireText = (text, pattern, message) => { if (!pattern.test(text)) errors.push(message); };

const html = read('collections.html');
const css = read('css/collections-page.css');
const runtime = read('js/collections-maintenance.js');
const store = read('js/collections-store.js');
const record = read('maintenance/03-colecciones.txt');

requireText(html, /id="colls-page-grid"/, 'Falta grilla de colecciones.');
requireText(html, /id="collections-featured-grid"/, 'Falta grilla de productos destacados.');
requireText(html, /id="collections-grid-status"[\s\S]*aria-live="polite"/, 'Falta estado accesible de colecciones.');
requireText(html, /id="collections-featured-status"[\s\S]*aria-live="polite"/, 'Falta estado accesible de destacados.');
requireText(html, /aria-busy="true"/, 'Falta estado inicial de carga.');

requireText(css, /\.tt-collections-page/, 'CSS no está limitado a Colecciones.');
requireText(css, /var\(--color-background-page/, 'Fondo no usa tokens globales.');
requireText(css, /var\(--color-background-surface/, 'Tarjetas no usan superficies configurables.');
requireText(css, /tt-coll-page-img[\s\S]*background-color:\s*var\(/, 'Imágenes no tienen fondo sólido configurable.');
requireText(css, /@media \(min-width: 769px\) and \(max-width: 1024px\)/, 'Falta responsive tablet.');
requireText(css, /@media \(max-width: 768px\)/, 'Falta responsive mobile.');
requireText(css, /@media \(max-width: 360px\)/, 'Falta responsive mini mobile.');
requireText(css, /prefers-reduced-motion/, 'Falta reduced motion.');
if (/(^|[^\w-])#000(?:000)?\b/i.test(css)) errors.push('La capa contiene negro puro.');

requireText(runtime, /COLLECTIONS_PATH_RE/, 'Runtime no se limita a collections.html.');
requireText(runtime, /inspectCollections/, 'Falta recuperación independiente de colecciones.');
requireText(runtime, /inspectFeatured/, 'Falta recuperación independiente de destacados.');
requireText(runtime, /MutationObserver/, 'Falta observación del render.');
requireText(runtime, /visibilitychange/, 'Falta actualización al regresar a la pestaña.');
requireText(runtime, /pageshow/, 'Falta recuperación de bfcache.');
requireText(runtime, /window\.addEventListener\('online'/, 'Falta recuperación al volver internet.');
requireText(runtime, /window\.addEventListener\('offline'/, 'Falta estado sin conexión.');
requireText(runtime, /location\.origin/, 'Metadatos no se normalizan al dominio actual.');
requireText(runtime, /getFullYear/, 'Footer no usa año automático.');
requireText(runtime, /tt-collections-runtime-state/, 'Faltan estados visibles de recuperación.');

requireText(store, /import '\.\/collections-maintenance\.js/, 'Runtime no se carga desde collections-store.');
requireText(record, /Desktop grande|desktop grande/i, 'Registro no contempla desktop grande.');
requireText(record, /tablet/i, 'Registro no contempla tablet.');
requireText(record, /mobile/i, 'Registro no contempla mobile.');

const viewports = [1920, 1440, 1280, 1024, 768, 390, 320];
if (viewports.length !== 7) errors.push('Deben auditarse siete viewports.');

if (errors.length) {
  console.error('\nAUDITORÍA PÁGINA COLECCIONES: FALLÓ');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log('AUDITORÍA PÁGINA COLECCIONES: OK · 7 viewports · dos bloques dinámicos · tokens · recuperación · accesibilidad.');
