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
const runtime = read('tienda.js');
const desktopStyles = read('css/components/navigation/escritorio/encabezado-escritorio.css');
const tabletStyles = read('css/components/navigation/tableta/encabezado-tableta.css');
const mobileStyles = read('css/components/navigation/movil/encabezado-movil.css');
const mobileSolidStyles = read('css/components/navigation/movil/fondos-solidos-movil.css');
const notificationStyles = read('css/components/notifications/notificaciones-sociales.css');
const navigationAssets = read('js/components/navigation/compartido/recursos-navegacion.js');
const sharedRuntime = read('js/components/navigation/compartido/carga-navegacion.js');
const mobileCompact = read('js/components/navigation/movil/navegacion-compacta-movil.js');
const mobileIndicator = read('js/components/navigation/movil/indicador-navegacion-movil.js');
const styles = [
  desktopStyles,
  tabletStyles,
  mobileStyles,
  mobileSolidStyles,
  'css/components/navigation/compartido/paneles.css',
  'css/components/navigation/compartido/transiciones-navegacion.css',
  'css/components/navigation/compartido/busqueda.css',
].map(file => file.endsWith?.('.css') ? read(file) : file).join('\n');
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

// Contrato reforzado de headers 2026-08-24: estos checks protegen los fallos
// que antes podían variar por página, sesión, dispositivo o cascada CSS.
check(
  navigationAssets.includes("css/components/navigation/movil/fondos-solidos-movil.css"),
  'el shell global no carga los fondos sólidos móviles'
);
check(
  navigationAssets.includes("css/components/notifications/notificaciones-sociales.css"),
  'el shell global no precarga la geometría/estilos de notificaciones'
);
check(
  navigationAssets.includes('stylesheetForPath(path)') && navigationAssets.includes('dataset.ttSocialNotifications'),
  'el cargador global no reutiliza hojas existentes o no marca el CSS de notificaciones'
);
check(
  mobileSolidStyles.includes('@media (max-width: 767px)') && !mobileSolidStyles.includes('@media (max-width: 768px)'),
  'fondos sólidos móviles no respetan el corte exacto 767/768'
);
check(
  notificationStyles.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'),
  'mobile no reserva seis columnas cuando Alertas está visible'
);
check(
  mobileStyles.includes('data-tt-mobile-home="hidden"') &&
    mobileStyles.includes('grid-template-columns:repeat(5,minmax(0,1fr)) !important'),
  'mobile no recompone cinco columnas cuando Inicio está oculto y Alertas visible'
);
check(
  mobileCompact.includes('.tt-notifications-drawer.open'),
  'la barra compacta mobile no reconoce Notificaciones como superficie abierta'
);
check(
  mobileIndicator.includes("attributeFilter: ['class', 'aria-expanded', 'aria-current', 'hidden']") &&
    mobileIndicator.includes('!item.hidden'),
  'el indicador mobile no se resincroniza cuando Auth muestra u oculta Alertas'
);
check(
  sharedRuntime.includes('void loadAuthRuntime()') && !sharedRuntime.includes('tt_session_started_at'),
  'el header sigue dependiendo de una marca local de sesión en vez de resolver Auth globalmente'
);
check(
  collections.includes('function visibleCollections(collections)') &&
    collections.includes('return collections;') &&
    !collections.includes('collections.filter(item => hasProducts(item.slug))'),
  'las colecciones del header todavía pueden variar según si una página cargó productos'
);
check(
  desktopStyles.includes('#tt-header-desktop-tablet #tt-nav-desktop-tablet #btn-tienda.active') &&
    desktopStyles.includes('border-color: transparent !important;'),
  'desktop no neutraliza el segundo marco heredado de Tienda'
);
check(
  desktopStyles.includes('grid-template-columns: 196px minmax(0, 1fr) 196px !important'),
  'desktop compacto no reserva espacio simétrico para las cuatro acciones autenticadas'
);
check(
  tabletStyles.includes('grid-template-columns: minmax(210px, 1fr) auto minmax(210px, 1fr)') &&
    tabletStyles.includes('max-width: min(240px, 31vw)'),
  'tablet no reserva geometría simétrica para impedir colisiones con el logo'
);

if (failures.length) {
  failures.forEach(message => console.error(`FALTA - ${message}`));
  process.exit(1);
}
console.log('Navegación unificada: componentes, controlador, breakpoints, sesión, colecciones, notificaciones y geometría responsive correctos.');
