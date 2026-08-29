const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const files = {
  home: read('index.html'),
  homeFit: read('css/pages/home/ajuste-inicio.css'),
  script: read('tienda.js'),
  productRelated: read('js/pages/product/productos-relacionados.js'),
  productsStore: read('js/core/store/estado-productos.js'),
  imageInit: read('js/components/images/inicio-carga-imagenes.js'),
  collectionsPage: read('js/pages/collections/pagina-colecciones.js'),
  checkout: read('checkout.html'),
  cart: read('js/components/cart/sincronizacion-carrito.js'),
  rules: read('firestore.rules'),
  admin: `${read('admin.html')}\n${read('js/admin/admin-app.js')}`,
  adminImages: read('admin-images.html'),
  adminGuard: read('js/admin/proteccion-cambios-pendientes-admin.js'),
  contentAdmin: read('js/admin/content/gestion-contenido-admin.js'),
  welcome: read('js/admin/content/control-bienvenida-admin.js'),
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
  !files.home.includes("import { onCollectionsUpdate } from './js/pages/collections/estado-colecciones.js?v=tintin-20260821-accounts-phase-a-1'") &&
    !files.home.includes("import { onImagesUpdate } from './js/components/images/imagenes.js?v=tintin-20260716-cloudinary-fix-1'"),
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
  // La validación final de stock/precio corre server-side (Apps Script) en
  // una sola transacción de Firestore. Las variantes del mismo producto se
  // agregan antes de validar/descontar stock y el servidor recalcula la
  // cotización completa antes del commit; runTransaction() en el navegador
  // queda únicamente para el guard anti-repetición (checkoutGuards).
  'La compra final conserva validación transaccional',
  read('js/orders/pedido-checkout-seguro.js').includes('runTransaction') &&
    read('apps-script/CrearPedido.gs').includes('requestedQtyByProduct[line.id] = (requestedQtyByProduct[line.id] || 0) + Number(line.qty || 0)') &&
    read('apps-script/CrearPedido.gs').includes('requestedQtyByProduct[productId] > stock') &&
    read('apps-script/CrearPedido.gs').includes('var total = subtotal - discount + shippingCost') &&
    read('apps-script/CrearPedido.gs').includes('Number(payload.expectedTotal) !== total') &&
    read('apps-script/CrearPedido.gs').includes("error: 'quote_changed'") &&
    read('apps-script/CrearPedido.gs').includes('stock: stock - requestedQtyByProduct[productId]') &&
    read('apps-script/CrearPedido.gs').includes("phase4UpdateWrite_('products/' + productId") &&
    read('apps-script/CrearPedido.gs').includes('phase4Commit_(writes, transactionId)'),
  'el servidor debe agregar variantes, recalcular la cotización y validar stock antes del commit'
);

check(
  'Product.html mantiene tres relacionados de colecciones únicas',
  files.productRelated.includes('const LIMIT = 3') &&
    files.productRelated.includes('new Set(state.visible.map(categoryKey))') &&
    files.productRelated.includes('String(product.id) === currentId') &&
    files.productRelated.includes("if (grid && !window.TintinRelatedProducts)") &&
    files.productRelated.includes("refreshButton?.addEventListener('click', refreshAll)") &&
    files.productRelated.includes('historyFor(category)') &&
    !files.productsStore.includes("['colls-products-grid', 'related-grid']") &&
    !files.imageInit.includes("['colls-products-grid', 'related-grid']"),
  'la rotación debe excluir el producto actual, evitar repeticiones y tener un solo propietario'
);

const featuredLimitMatch = files.collectionsPage.match(/const\s+FEATURED_LIMIT\s*=\s*(\d+)\s*;/);
const featuredLimit = Number(featuredLimitMatch?.[1]);

check(
  'Los bloques secundarios nunca superan cinco productos',
  Number.isInteger(featuredLimit) &&
    featuredLimit >= 1 &&
    featuredLimit <= 5 &&
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
    "'primary-editor'",
  ].every(token => files.admin.includes(token)) &&
    files.contentAdmin.includes('`content:${currentPageId}:${currentSectionId}`') &&
    files.contentAdmin.includes('window.AdminUnsaved.register(nextId') &&
    files.contentAdmin.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)') &&
    files.welcome.includes("'welcome-config'"),
  'productos, colecciones, configuración, permisos, contenido, pedidos, correos y bienvenida deben quedar protegidos'
);

check(
  'Las imágenes se guardan al instante, sin dejar un borrador sin confirmar que proteger',
  files.adminImages.includes('attachImageUploadWidget') &&
    files.adminImages.includes('saveImages(') &&
    !files.adminImages.includes('AdminUnsaved'),
  'cada carga confirma y sube antes de aplicarse — no hay un estado "sin guardar" que pueda perderse al navegar'
);

if (failures) {
  console.error(`\nAuditoría integral: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría integral: todo correcto.');
