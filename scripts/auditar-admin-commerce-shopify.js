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

expect(html.includes('js/admin/shopify-commerce-admin.js?v=tintin-20260821-accounts-phase-a-1'), 'admin.html carga la nueva experiencia de comercio versionada.');

for (const section of ['productos', 'colecciones', 'pedidos']) {
  expect(html.includes(`id="section-${section}"`), `sigue existiendo el módulo ${section} original.`);
  expect(js.includes(`tt-commerce-${section === 'productos' ? 'products' : section === 'colecciones' ? 'collections' : 'orders'}`), `la capa nueva monta ${section}.`);
  expect(css.includes(`#section-${section}.tt-commerce-mounted`), `los estilos de ${section} quedan acotados al módulo.`);
}

for (const collectionName of ['products', 'collections', 'orders']) {
  expect(new RegExp(`onSnapshot\\(collection\\(db, ['\"]${collectionName}['\"]\\)`).test(js), `${collectionName} se sincroniza en tiempo real.`);
}

for (const action of [
  'window.prodNuevo', 'window.prodEditar', 'window.prodToggleActive', 'window.prodEliminar',
  'window.collNueva', 'window.collEditar', 'window.collVerProductos', 'window.collEliminar',
  'window.openOrderEdit', 'window.updateOrderStatus', 'window.updatePayStatus',
  'window.resendOrderEmail', 'window.deleteOrder'
]) {
  expect(js.includes(action), `reutiliza el contrato existente ${action}.`);
}

for (const forbiddenWrite of ['updateDoc', 'setDoc', 'addDoc', 'deleteDoc', 'writeBatch', 'runTransaction']) {
  expect(!new RegExp(`\\b${forbiddenWrite}\\b`).test(js), `la capa visual no escribe Firestore directamente con ${forbiddenWrite}.`);
}

expect(!/duplicar producto/i.test(js), 'no inventa Duplicar producto, que Tintin todavía no implementa.');
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
