'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fail = message => { console.error(`ERROR: ${message}`); process.exitCode = 1; };
const ok = message => console.log(`OK: ${message}`);
const expect = (condition, message) => condition ? ok(message) : fail(message);

const html = read('admin.html');
const js = read('js/admin/shopify-commerce-admin.js');
const css = read('css/admin/shopify-commerce-admin.css');

expect(/js\/admin\/shopify-commerce-admin\.js\?v=[A-Za-z0-9._-]+/.test(html), 'admin.html carga la nueva experiencia de comercio versionada.');

for (const section of ['productos', 'colecciones', 'pedidos']) {
  expect(html.includes(`id="section-${section}"`), `sigue existiendo el módulo ${section} original.`);
  expect(js.includes(`tt-commerce-${section === 'productos' ? 'products' : section === 'colecciones' ? 'collections' : 'orders'}`), `la capa nueva monta ${section}.`);
  expect(css.includes(`#section-${section}.tt-commerce-mounted`), `los estilos de ${section} quedan acotados al módulo.`);
}

for (const collectionName of ['products', 'collections', 'orders']) {
  const liveSync = collectionName === 'orders'
    ? /TintinAdminOrders[\s\S]*?subscribe\(/.test(js) && /onSnapshot\(ordersQuery/.test(read('js/admin/admin-app.js'))
    : collectionName === 'products' ? /createAdminPagedSource\(/.test(js) && /subscribeProductCatalog\(records/.test(js) && /subscribePage/.test(js) && /onSnapshot\(source,\s*\{\s*includeMetadataChanges:\s*true/.test(js)
    : new RegExp(`onSnapshot\\((?:query\\()?collection\\(db, ['\"]${collectionName}['\"]\\)`).test(js);
  expect(liveSync, `${collectionName} se sincroniza en tiempo real.`);
}

expect(read('js/admin/orders/tablero-pedidos-vista.mjs').includes('orders.slice(0,model.visible[key] || 30)'), 'pedidos limita las tarjetas por etapa sin perder contadores ni snapshots.');
expect(!/onSnapshot\(ordersPage/.test(js), 'el tablero reutiliza la única fuente administrativa de pedidos.');

for (const action of [
  'window.prodNuevo', 'window.prodEditar', 'window.prodToggleActive', 'window.prodEliminar',
  'window.collNueva', 'window.collEditar', 'window.collEliminar',
  'window.openOrderEdit', 'window.updateOrderStatus', 'window.updatePayStatus',
  'window.resendOrderEmail', 'window.deleteOrder'
]) {
  const legacyName = action.replace('window.', '');
  const delegated = new RegExp(`callLegacyAction\\(['\"]${legacyName}['\"]`).test(js);
  expect(js.includes(action) || delegated, `reutiliza el contrato existente ${action}.`);
}

// Navegar a productos pertenece al controlador visible; el puente anterior
// sólo filtraba la tabla heredada que esta vista mantiene oculta.
const collectionProducts = js.slice(js.indexOf("  if (action === 'collection-products'"), js.indexOf("  if (action === 'collection-delete'"));
expect(collectionProducts.includes('state.productCategory = wristCategory(id)') &&
  collectionProducts.includes("state.productSearch = ''") && collectionProducts.includes("state.productTab = 'all'") &&
  collectionProducts.includes('state.productPage = 0') && collectionProducts.includes('[data-section="productos"]') &&
  collectionProducts.includes('?.click()') && collectionProducts.includes('return renderProducts()') &&
  !/collVerProductos|callLegacyAction/.test(collectionProducts),
  'Ver productos usa la colección canónica y el único controlador visible, sin filtrar una tabla oculta.');

for (const forbiddenWrite of ['updateDoc', 'setDoc', 'addDoc', 'deleteDoc', 'writeBatch', 'runTransaction']) {
  expect(!new RegExp(`\\b${forbiddenWrite}\\b`).test(js), `la capa visual no escribe Firestore directamente con ${forbiddenWrite}.`);
}

expect(/product-duplicate/.test(js) && /callLegacyAction\('prodDuplicar',\s*id\)/.test(js) && /window\.prodDuplicar/.test(read('js/admin/admin-app.js')), 'Duplicar abre el formulario canónico sin crear documentos antes de guardar.');
expect(!/crear pedido manual/i.test(js), 'no inventa creación manual de pedidos.');
expect(!/colecci[oó]n automatizada|smart collection/i.test(js), 'no simula colecciones inteligentes sin modelo de datos compatible.');

for (const token of ['--admin-color-brand', '--admin-color-background-page', '--admin-color-background-surface', '--admin-color-border']) {
  expect(css.includes(token), `el diseño hereda ${token} de Tintin.`);
}

expect(js.includes("canDo(state.role, moduleKey, actionKey)"), 'respeta permisos dinámicos por rol.');
expect(js.includes("state.role === 'superadmin'"), 'mantiene el bypass legítimo de Super Admin.');
expect(js.includes('prefers-reduced-motion') || css.includes('prefers-reduced-motion'), 'respeta reducción de movimiento.');
expect(css.includes('@media (max-width: 720px)'), 'incluye adaptación móvil/tablet.');

if (!process.exitCode) console.log('Auditoría de Productos/Colecciones/Pedidos estilo Shopify: correcta.');
