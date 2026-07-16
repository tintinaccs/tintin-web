const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const files = {
  home: read('index.html'),
  homeFit: read('css/home-fit.css'),
  script: read('script.js'),
  productsStore: read('js/products-store.js'),
  imageInit: read('js/load-images-init.js'),
  collectionsPage: read('js/collections-page.js'),
  checkout: read('checkout.html'),
  cart: read('js/cart-sync.js'),
  rules: read('firestore.rules'),
  admin: read('admin.html'),
  adminImages: read('admin-images.html'),
  adminGuard: read('js/admin-unsaved-guard.js'),
  welcome: read('js/admin-welcome-control.js'),
};

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK  ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

check(
  'La portada no abre listeners duplicados de colecciones o imágenes',
  !files.home.includes("import { onCollectionsUpdate } from './js/collections-store.js'") &&
    !files.home.includes("import { onImagesUpdate } from './js/images.js'"),
  'la sincronización global debe ser la única propietaria de esas superficies'
);

check(
  'La portada usa alturas guiadas por contenido',
  files.homeFit.includes('.tt-home-premium .tt-collections-section,') &&
    files.homeFit.includes('.tt-home-premium .tt-footer{min-height:0}') &&
    !files.homeFit.includes('170svh') &&
    !files.homeFit.includes('128svh') &&
    files.homeFit.includes('@media(max-width:380px)') &&
    files.homeFit.includes('(orientation:landscape)'),
  'mobile y pantallas bajas no deben reservar grandes espacios vacíos'
);

check(
  'El carrito serializa cambios y bloquea carreras entre pestañas',
  files.cart.includes('function withCartMutation') &&
    files.cart.includes('navigator.locks?.request') &&
    files.cart.includes('mutationChain'),
  'doble clic y pestañas simultáneas deben pasar por la misma exclusión'
);

check(
  'El carrito distingue producto y variante',
  files.cart.includes('lineIdFor({ id, variant })') &&
    files.cart.includes('entry.lineId === incoming.lineId'),
  'no se debe comparar solamente por nombre'
);

check(
  'El carrito respeta stock compartido y muestra aviso accesible',
  files.cart.includes('function enforceStockLimits') &&
    files.cart.includes("reason = limit <= 1 ? 'already_in_cart' : 'stock_limit'") &&
    files.cart.includes('Este producto ya se encuentra en tu carrito y solo hay una unidad disponible.') &&
    files.cart.includes("node.setAttribute('aria-live', 'polite')"),
  'una línea o suma de variantes no puede superar la disponibilidad real'
);

check(
  'Firestore rechaza líneas del carrito superiores al stock',
  files.rules.includes('function cartItemValid(itemId)') &&
    files.rules.includes('data.qty <= get(productPath).data.stock') &&
    files.rules.includes('allow create, update:') &&
    files.rules.includes('cartItemValid(itemId)'),
  'la protección no puede depender únicamente del navegador'
);

check(
  'La compra final conserva validación transaccional',
  read('js/secure-checkout-order.js').includes('runTransaction') &&
    read('js/secure-checkout-order.js').includes('stock - draft.cartLines[index].qty'),
  'checkout debe volver a validar el total solicitado'
);

check(
  'Product.html mantiene un máximo real de cuatro relacionados',
  files.script.includes("renderProductsGrid('related-grid', related)") &&
    files.script.includes('.slice(0, 4)') &&
    !files.productsStore.includes("['colls-products-grid', 'related-grid']") &&
    !files.imageInit.includes("['colls-products-grid', 'related-grid']"),
  'los cargadores globales no deben reemplazar la selección relevante'
);

check(
  'Los bloques secundarios nunca superan cinco productos',
  files.collectionsPage.includes('const FEATURED_LIMIT = 5') &&
    files.checkout.includes("limit(5)") &&
    files.checkout.includes('.slice(0, 5)') &&
    files.productsStore.includes("featuredProducts.slice(0, 5)") &&
    files.imageInit.includes("featuredProducts.slice(0, 5)"),
  'catálogo y búsquedas quedan excluidos porque son superficies completas'
);

check(
  'Super Admin detecta cambios reales y cierre del navegador',
  files.adminGuard.includes("window.addEventListener('beforeunload'") &&
    files.adminGuard.includes('currentValue(scope) !== scope.baseline') &&
    files.adminGuard.includes('markClean') &&
    files.adminGuard.includes('requestNavigation'),
  'abrir un formulario no debe bastar para marcarlo como modificado'
);

check(
  'El modal permite guardar, descartar o seguir editando',
  files.admin.includes('id="unsaved-modal-save"') &&
    files.admin.includes('id="unsaved-modal-discard"') &&
    files.admin.includes('id="unsaved-modal-stay"') &&
    files.admin.includes('aria-modal="true"'),
  'la navegación interna debe usar una advertencia accesible y coherente'
);

check(
  'Los principales módulos editables están registrados',
  [
    "'general-config'",
    "'email-config'",
    "'permissions'",
    "'order-editor'",
    "'email-template-editor'",
    '`content:${pageId}:${sectionId}`',
    "'primary-editor'",
  ].every(token => files.admin.includes(token)) &&
    files.adminImages.includes('`image:${slotId}`') &&
    files.welcome.includes("'welcome-config'"),
  'productos, colecciones, configuración, permisos, contenido, pedidos, correos, bienvenida e imágenes deben quedar protegidos'
);

if (failures) {
  console.error(`\nAuditoría integral: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría integral: todo correcto.');
