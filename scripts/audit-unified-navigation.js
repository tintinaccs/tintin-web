const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const shell = [
  'js/components/navigation/escritorio/encabezado-escritorio.js',
  'js/components/navigation/tableta/encabezado-tableta.js',
  'js/components/navigation/movil/encabezado-movil.js',
  'js/components/navigation/compartido/panel-busqueda.js',
  'js/components/navigation/compartido/panel-carrito.js',
  'js/components/navigation/compartido/panel-cuenta.js',
  'js/components/navigation/compartido/panel-colecciones.js',
  'js/components/navigation/compartido/capas-paneles.js',
].map(read).join('\n');

const controller = read('js/components/navigation/compartido/control-paneles.js');
const runtime = read('script.js');
const styles = [
  'css/components/navigation/escritorio/encabezado-escritorio.css',
  'css/components/navigation/tableta/encabezado-tableta.css',
  'css/components/navigation/movil/encabezado-movil.css',
  'css/components/navigation/movil/fondos-solidos-movil.css',
  'css/components/navigation/compartido/paneles.css',
  'css/components/navigation/compartido/transiciones-navegacion.css',
  'css/components/navigation/compartido/busqueda.css',
].map(read).join('\n');
const collections = read('js/components/navigation/compartido/carga-colecciones.js');
const navigation = read('js/components/navigation/compartido/enrutador.js');

for (const id of ['tt-shared-backdrop', 'tt-shared-morph', 'account-drawer', 'cart-drawer', 'search-panel', 'collections-sheet', 'tt-tablet-menu', 'tt-tienda-dropdown-panel']) {
  check((shell.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length === 1, `${id}: debe existir exactamente una vez en los componentes del shell`);
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
check(controller.includes('tt-surface-locked'), 'falta bloqueo de scroll central');
check(controller.includes('this.cancelAnimations()'), 'falta cancelación de animaciones ante interacciones rápidas');
check(styles.includes('@media (prefers-reduced-motion: reduce)'), 'falta reduced-motion');
check(styles.includes('@media (max-width: 767px)'), 'falta contrato móvil <= 767px');
check(styles.includes('@media (min-width: 768px) and (max-width: 1024px)'), 'falta contrato tableta 768-1024px');
check(controller.includes('if (innerWidth < 768)') && controller.includes('if (innerWidth <= 1024)'), 'faltan los límites exactos móvil/tableta/escritorio');
check(collections.includes('buildTabletCard') && collections.includes('createCollectionImage(collection)'), 'tableta no consume las imágenes reales compartidas de categorías');
check(
  navigation.includes('document.startViewTransition') &&
    navigation.includes('transition.finished?.catch') &&
    navigation.includes('transition.updateCallbackDone?.catch') &&
    navigation.includes('location.assign'),
  'navegación no tiene View Transition segura con fallback'
);

if (failures.length) {
  failures.forEach(message => console.error(`FALTA - ${message}`));
  process.exit(1);
}
console.log('Navegación unificada: componentes, controlador, breakpoints, accesibilidad y fuentes compartidas correctos.');
