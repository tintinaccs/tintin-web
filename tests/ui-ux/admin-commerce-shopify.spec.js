'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const commerceJs = fs.readFileSync(path.join(ROOT, 'js/admin/shopify-commerce-admin.js'), 'utf8');
const commerceCss = fs.readFileSync(path.join(ROOT, 'css/admin/shopify-commerce-admin.css'), 'utf8');

const firebaseStub = `export const auth = {}; export const db = {};`;
const authStub = `
export function onAuthStateChanged(_auth, callback) {
  queueMicrotask(() => callback({ uid: 'super-1', email: 'tintinaccs@gmail.com', isAnonymous: false }));
  return () => {};
}`;
const firestoreStub = `
const DATA = {
  products: [
    { id: 'p-reloj', data: { name: 'Reloj Clásico Negro', category: 'relojes', price: 85000, priceBefore: 100000, stock: 7, active: true, oferta: true, destacado: true, image: 'https://img.test/reloj.webp', variants: [{ name: 'Negro' }] } },
    { id: 'p-pulsera', data: { name: 'Pulsera Cuero Café', category: 'pulseras', price: 50000, stock: 0, active: true, image: 'https://img.test/pulsera.webp' } },
    { id: 'p-aro', data: { name: 'Aro Argolla Dorado', category: 'aros', price: 35000, stock: null, active: false } }
  ],
  collections: [
    { id: 'relojes', data: { name: 'Relojes', description: 'Relojes de Tintin', visible: true, order: 1, image: 'https://img.test/relojes.webp' } },
    { id: 'pulseras', data: { name: 'Pulseras', visible: true, order: 2 } },
    { id: 'aros', data: { name: 'Aros', visible: false, order: 3 } }
  ],
  orders: [
    { id: '1024', data: { createdAt: { seconds: 1786400000 }, userName: 'María González', userEmail: 'maria@example.com', userPhone: '0981123456', status: 'pendiente', paymentStatus: 'pagado', total: 135000, subtotal: 135000, shipping: { method: 'delivery', city: 'San Lorenzo', address: 'Centro', reference: 'Portón blanco', cost: 0 }, items: [{ productId: 'p-reloj', name: 'Reloj Clásico Negro', qty: 1, price: 85000, image: 'https://img.test/reloj.webp' }, { productId: 'p-pulsera', name: 'Pulsera Cuero Café', qty: 1, price: 50000 }] } },
    { id: '1023', data: { createdAt: { seconds: 1786300000 }, userName: 'Lucía Fernández', userEmail: 'lucia@example.com', userPhone: '0981765432', status: 'entregado', paymentStatus: 'pagado', total: 35000, shipping: { method: 'encomienda', city: 'Caacupé' }, items: [{ productId: 'p-aro', name: 'Aro Argolla Dorado', qty: 1, price: 35000 }] } }
  ]
};
export const collection = (_db, name) => name;
export function onSnapshot(ref, success) {
  queueMicrotask(() => success({ docs: (DATA[ref] || []).map(entry => ({ id: entry.id, data: () => structuredClone(entry.data) })) }));
  return () => {};
}`;
const rolesStub = `
export function can() { return true; }
export async function getUserRole() { return 'superadmin'; }
`;
const permsStub = `
export function canDo() { return true; }
export async function loadRolePermissions() { return {}; }
`;
const collectionsStub = `export function normalizeCollectionDoc(id, data) { return { slug: id, ...data }; }`;
const imagesStub = `export function sanitizeImageUrl(value) { return /^https?:\\/\\//.test(String(value || '')) ? String(value) : ''; }`;

function fixtureHtml() {
  return `<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root {
      --admin-color-brand:#AD3F67; --admin-color-brand-hover:#8B2642; --admin-color-background-page:#FFF6FA;
      --admin-color-background-surface:#fff; --admin-color-background-sidebar-active:#FDECF2; --admin-color-border:#F1E4E7;
      --admin-color-text-primary:#2B2B2B; --admin-color-text-secondary:#7B6F72; --admin-color-text-title:#2B2B2B;
      --admin-color-button-primary-background:#AD3F67; --admin-color-button-primary-text:#fff; --admin-color-button-primary-hover:#8B2642;
      --admin-color-field-background:#fff; --admin-color-field-border:#F1E4E7; --admin-color-table-header-background:#FDECF2;
      --admin-color-table-row-hover:#FFF9FC; --admin-color-badge-background:#FDECF2; --admin-color-badge-text:#AD3F67;
      --admin-color-success-background:#e0f5e6; --admin-color-success-text:#166534; --admin-color-warning-background:#fff3e0;
      --admin-color-warning-text:#bf360c; --admin-color-error-background:#fde3e1; --admin-color-error-text:#b8341f;
    }
    *{box-sizing:border-box} body{margin:0;padding:24px;background:var(--admin-color-background-page);font-family:Montserrat}
    .adm-section{display:block}.adm-card{background:#fff}.adm-card-body{padding:12px}
  </style></head><body>
    <div id="adm-toast"></div>
    <button data-section="importar" id="nav-importar">Importar</button>
    <section class="adm-section" id="section-productos">
      <div class="adm-card" id="prod-list-card">Listado legacy productos</div>
      <div class="adm-card" id="prod-form-card" style="display:none"><div class="adm-card-head"><div class="adm-card-title">Editar producto</div></div><div class="adm-card-body"><input class="adm-input"><button>Guardar</button></div></div>
    </section>
    <section class="adm-section" id="section-colecciones">
      <div class="adm-card" id="coll-list-card">Listado legacy colecciones</div>
      <div class="adm-card" id="coll-form-card" style="display:none"><div class="adm-card-head"><div class="adm-card-title">Editar colección</div></div><div class="adm-card-body"><input class="adm-input"></div></div>
      <div class="adm-card" id="coll-products-card" style="display:none"></div>
      <div class="adm-card" id="coll-picker-card" style="display:none"></div>
    </section>
    <section class="adm-section" id="section-pedidos"><div class="adm-card" id="orders-legacy">Listado legacy pedidos</div></section>
    <script>
      window.__calls=[];
      const call=(name,...args)=>window.__calls.push([name,...args]);
      window.prodNuevo=()=>{call('prodNuevo');document.getElementById('prod-form-card').style.display='block'};
      window.prodEditar=id=>call('prodEditar',id); window.prodToggleActive=(id,a)=>call('prodToggleActive',id,a); window.prodEliminar=id=>call('prodEliminar',id);
      window.collNueva=()=>call('collNueva'); window.collEditar=id=>call('collEditar',id); window.collVerProductos=id=>call('collVerProductos',id); window.collEliminar=(id,count)=>call('collEliminar',id,count);
      window.openOrderEdit=id=>call('openOrderEdit',id); window.updateOrderStatus=(id,s)=>call('updateOrderStatus',id,s); window.updatePayStatus=(id,s)=>call('updatePayStatus',id,s);
      window.resendOrderEmail=id=>call('resendOrderEmail',id); window.deleteOrder=id=>call('deleteOrder',id);
    </script>
    <script type="module" src="/js/admin/shopify-commerce-admin.js?v=tintin-20260820-microcopy-ios-1"></script>
  </body></html>`;
}

async function mockRuntime(page) {
  await page.route('http://tintin.test/admin-commerce-fixture', route => route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml() }));
  await page.route('http://tintin.test/js/admin/shopify-commerce-admin.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: commerceJs }));
  await page.route('http://tintin.test/css/admin/shopify-commerce-admin.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: commerceCss }));
  await page.route('http://tintin.test/js/core/firebase/firebase.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: firebaseStub }));
  await page.route('http://tintin.test/js/core/auth/roles.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: rolesStub }));
  await page.route('http://tintin.test/js/core/auth/permisos-roles.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: permsStub }));
  await page.route('http://tintin.test/js/pages/collections/estado-colecciones.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: collectionsStub }));
  await page.route('http://tintin.test/js/components/images/utilidades-imagenes.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: imagesStub }));
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: authStub }));
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: firestoreStub }));
  await page.route('https://img.test/**', route => route.fulfill({ status: 204, body: '' }));
}

test.beforeEach(async ({ page }) => {
  await mockRuntime(page);
  await page.goto('http://tintin.test/admin-commerce-fixture');
  await expect(page.locator('#tt-commerce-products .tt-commerce-title')).toContainText('Productos');
  await expect(page.locator('#tt-commerce-collections .tt-commerce-title')).toContainText('Colecciones');
  await expect(page.locator('#tt-commerce-orders .tt-commerce-title')).toContainText('Pedidos');
});

test('renderiza los tres módulos con datos, filtros y colores Tintin', async ({ page }) => {
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(3);
  await expect(page.locator('#tt-commerce-collections tbody tr')).toHaveCount(3);
  await expect(page.locator('#tt-commerce-orders tbody tr')).toHaveCount(2);

  await page.locator('[data-filter="product-search"]').fill('pulsera');
  await expect(page.locator('#tt-commerce-products tbody tr')).toHaveCount(1);
  await expect(page.locator('#tt-commerce-products tbody')).toContainText('Pulsera Cuero Café');

  const primary = page.locator('#tt-commerce-products .tt-commerce-btn.primary').first();
  await expect(primary).toHaveCSS('background-color', 'rgb(173, 63, 103)');
  await expect(page.locator('#prod-list-card')).toBeHidden();
  await expect(page.locator('#coll-list-card')).toBeHidden();
  await expect(page.locator('#orders-legacy')).toBeHidden();
});

test('abre ficha rápida y reutiliza la edición real de producto', async ({ page }) => {
  await page.locator('tr[data-open="product"][data-id="p-reloj"]').click();
  await expect(page.locator('#tt-commerce-drawer')).toHaveClass(/open/);
  await expect(page.locator('#tt-commerce-drawer')).toContainText('Reloj Clásico Negro');
  await page.locator('[data-action="drawer-product-edit"]').click();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['prodEditar', 'p-reloj']);
});

test('oculta el listado avanzado mientras se abre el formulario existente', async ({ page }) => {
  await page.locator('[data-action="product-new"]').click();
  await expect(page.locator('#prod-form-card')).toBeVisible();
  await expect(page.locator('#tt-commerce-products')).toBeHidden();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['prodNuevo']);
});

test('colecciones navegan a sus productos sin inventar colecciones inteligentes', async ({ page }) => {
  await page.locator('tr[data-open="collection"][data-id="relojes"]').click();
  await expect(page.locator('#tt-commerce-drawer')).toContainText('Relojes');
  await page.locator('[data-action="drawer-collection-products"]').click();
  expect(await page.evaluate(() => window.__calls)).toContainEqual(['collVerProductos', 'relojes']);
  await expect(page.locator('#tt-commerce-collections')).not.toContainText('Automatizada');
});

test('pedido separa entrega/pago y ejecuta los contratos existentes', async ({ page }) => {
  await page.locator('tr[data-open="order"][data-id="1024"]').click();
  const drawer = page.locator('#tt-commerce-drawer');
  await expect(drawer).toContainText('María González');
  await expect(drawer).toContainText('135.000 Gs');

  await drawer.locator('[data-drawer-order-status="1024"]').selectOption('en_camino');
  await drawer.locator('[data-drawer-order-pay="1024"]').selectOption('reembolsado');
  const calls = await page.evaluate(() => window.__calls);
  expect(calls).toContainEqual(['updateOrderStatus', '1024', 'en_camino']);
  expect(calls).toContainEqual(['updatePayStatus', '1024', 'reembolsado']);
});

test('la interfaz sigue utilizable en móvil sin desbordar el documento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#tt-commerce-products')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 2);
  await page.locator('tr[data-open="product"][data-id="p-reloj"]').click();
  const box = await page.locator('#tt-commerce-drawer').boundingBox();
  expect(box?.width || 9999).toBeLessThanOrEqual(390);
});
