const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const shell = read('js/public-shell.js');
const controller = read('js/ui-navigation-controller.js');
const runtime = read('script.js');
const styles = read('css/surface-controller.css');
const collections = read('js/nav-collections.js');
const navigation = read('js/navigation-shared.js');

for (const id of ['tt-shared-backdrop', 'tt-shared-morph', 'account-drawer', 'cart-drawer', 'search-panel', 'collections-sheet', 'tt-tablet-menu', 'tt-tienda-dropdown-panel']) {
  check((shell.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length === 1, `${id}: debe existir exactamente una vez en el shell`);
}
for (const legacy of ['cart-overlay', 'collections-sheet-backdrop', 'tt-tablet-user-panel', 'tt-account-dropdown']) {
  check(!new RegExp(`id=["']${legacy}["']`).test(shell), `${legacy}: superficie heredada todavía presente`);
}
for (const state of ['idle', 'opening', 'open', 'closing']) check(controller.includes(`'${state}'`), `estado ${state} ausente`);
for (const surface of ['desktop-shop', 'tablet-menu', 'mobile-shop', 'search', 'cart', 'account']) {
  check(runtime.includes(`register('${surface}'`), `superficie ${surface} no registrada en el controlador`);
}
check(controller.includes("event.key === 'Escape'"), 'falta cierre global con Escape');
check(controller.includes("event.key !== 'Tab'"), 'falta focus trap global');
check(controller.includes('node.inert = true'), 'falta inert para el fondo');
check(controller.includes("tt-surface-locked"), 'falta bloqueo de scroll central');
check(controller.includes('this.cancelAnimations()'), 'falta cancelación de animaciones ante interacciones rápidas');
check(styles.includes('@media (prefers-reduced-motion: reduce)'), 'falta reduced-motion');
check(styles.includes('@media (max-width: 767px)'), 'falta contrato mobile <= 767px');
check(styles.includes('@media (min-width: 768px) and (max-width: 1024px)'), 'falta contrato tablet 768-1024px');
check(controller.includes("if (innerWidth < 768)") && controller.includes("if (innerWidth <= 1024)"), 'faltan los límites exactos mobile/tablet/desktop');
check(collections.includes('buildTabletCard') && collections.includes('createCollectionImage(collection)'), 'tablet no consume las imágenes reales compartidas de categorías');
check(navigation.includes('document.startViewTransition') && navigation.includes('location.assign'), 'navegación no tiene View Transition con fallback');

if (failures.length) {
  failures.forEach(message => console.error(`FALTA - ${message}`));
  process.exit(1);
}
console.log('Navegación unificada: controlador, superficies, breakpoints, accesibilidad y fuentes compartidas correctos.');
