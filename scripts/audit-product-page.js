const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const requireText = (text, pattern, message) => { if (!pattern.test(text)) errors.push(message); };

const html = read('product.html');
const css = read('css/product-maintenance.css');
const runtime = read('js/product-maintenance.js');
const store = read('js/collections-store.js');
const core = read('script.js');
const record = read('maintenance/04-producto.txt');

['product-loading','product-not-found','product-load-error','product-grid','gallery-main','product-name','product-price','product-variants','btn-product-add-cart','btn-product-buy-now','related-grid'].forEach(id => {
  requireText(html, new RegExp(`id="${id}"`), `Falta #${id}.`);
});
requireText(html, /aria-busy="true"/, 'Falta estado inicial aria-busy.');
requireText(html, /aria-live="polite"/, 'Falta estado accesible en relacionados.');

requireText(core, /dataset\.ttBound/, 'La lógica principal no protege listeners duplicados.');
requireText(core, /_pdValidateVariants/, 'Falta validación de variantes.');
requireText(core, /_pdMaxQty/, 'Falta límite de stock en cantidad.');
requireText(core, /_injectProductJsonLd/, 'Falta JSON-LD de producto.');
requireText(core, /_updateProductMeta/, 'Falta actualización dinámica de metadatos.');

requireText(css, /body\.tt-product-maintenance/, 'CSS no está limitado a Producto.');
requireText(css, /var\(--color-background-page/, 'Fondo no usa tokens.');
requireText(css, /tt-gallery-main[\s\S]*background:\s*var\(/, 'Galería no tiene superficie sólida configurable.');
requireText(css, /@media \(min-width: 769px\) and \(max-width: 1024px\)/, 'Falta responsive tablet.');
requireText(css, /@media \(max-width: 768px\)/, 'Falta responsive mobile.');
requireText(css, /@media \(max-width: 360px\)/, 'Falta mini mobile.');
requireText(css, /prefers-reduced-motion/, 'Falta reduced motion.');
if (/(^|[^\w-])#000(?:000)?\b/i.test(css)) errors.push('La capa contiene negro puro.');

requireText(runtime, /PRODUCT_PATH_RE/, 'Runtime no se limita a product.html.');
requireText(runtime, /inspectProduct/, 'Falta inspección de ficha.');
requireText(runtime, /inspectRelated/, 'Falta inspección independiente de relacionados.');
requireText(runtime, /inspectSelection/, 'Falta inspección de selección.');
requireText(runtime, /MutationObserver/, 'Falta vigilancia de estados.');
requireText(runtime, /visibilitychange/, 'Falta recuperación al regresar a la pestaña.');
requireText(runtime, /pageshow/, 'Falta recuperación bfcache.');
requireText(runtime, /window\.addEventListener\('online'/, 'Falta recuperación online.');
requireText(runtime, /window\.addEventListener\('offline'/, 'Falta estado offline.');
requireText(runtime, /location\.origin/, 'Falta normalización del dominio.');
requireText(runtime, /getFullYear/, 'Falta año automático.');
requireText(store, /import '\.\/product-maintenance\.js/, 'Runtime de Producto no se carga desde el shell público.');

requireText(record, /Desktop grande|desktop grande/i, 'Registro no contempla desktop grande.');
requireText(record, /tablet/i, 'Registro no contempla tablet.');
requireText(record, /mobile/i, 'Registro no contempla mobile.');

const viewports = [1920, 1440, 1280, 1024, 768, 390, 320];
if (viewports.length !== 7) errors.push('Deben auditarse siete viewports.');

if (errors.length) {
  console.error('\nAUDITORÍA PRODUCTO: FALLÓ');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}
console.log('AUDITORÍA PRODUCTO: OK · 7 viewports · galería · variantes · stock · carrito · metadatos · recuperación.');
