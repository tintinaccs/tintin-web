'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const commerceJs = fs.readFileSync(path.join(ROOT, 'js/admin/shopify-commerce-admin.js'), 'utf8');
const commerceCss = fs.readFileSync(path.join(ROOT, 'css/admin/shopify-commerce-admin.css'), 'utf8');

const firebaseStub = `export const auth = {currentUser:{uid:'super-1',email:'tintinaccs@gmail.com'}}; export const db = {}; export const appCheckReady = Promise.resolve(true);`;
const authStub = `
export function onAuthStateChanged(_auth, callback) {
  queueMicrotask(() => callback({ uid: 'super-1', email: 'tintinaccs@gmail.com', isAnonymous: false }));
  return () => {};
}`;
const sessionCoordinatorStub = `
export function subscribeAuthState(callback) {
  window.__authCallback=callback;
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
window.__orders=DATA.orders.map(o=>({id:o.id,...structuredClone(o.data),lastChangeId:'fixture_initial',inventoryRevision:1}));
window.__orderConsumers=new Set();window.__publishOrders=(error='')=>{for(const fn of window.__orderConsumers)fn({uid:'super-1',orders:window.__orders,ready:true,error});};
window.TintinAdminOrders={subscribe(fn){window.__orderConsumers.add(fn);queueMicrotask(()=>window.__publishOrders());return()=>window.__orderConsumers.delete(fn);},retry(){window.__publishOrders();}};
window.dispatchEvent(new Event('tintin:admin-orders-source'));
export const where = () => null;
export const collection = (_db, name) => name;
export const doc = (_db, name, id) => name+'/'+id;
export const serverTimestamp = () => new Date();
export const runTransaction = async () => {throw new Error('Escrituras no habilitadas en este fixture');};
export const deleteDoc = async () => {throw new Error('Escrituras no habilitadas en este fixture');};
export async function getDoc(ref) { const id=ref.split('/').at(-1),order=window.__orders.find(o=>o.id===id);return {exists:()=>!!order,data:()=>structuredClone(order)}; }
export const query = (ref) => ref;
export const orderBy = () => null;
export const limit = () => null;
export const startAfter = () => null;
export function onSnapshot(ref, success) {
  queueMicrotask(() => success({ docs: (DATA[ref] || []).map(entry => ({ id: entry.id, data: () => structuredClone(entry.data) })) }));
  return () => {};
}
export async function getDocs(ref) {
  if(ref==='auditLog')return {docs:(window.__auditRows || []).map(entry=>({id:entry.id,data:()=>structuredClone(entry)}))};
  return { docs: (DATA[ref] || []).map(entry => ({ id: entry.id, data: () => structuredClone(entry.data) })) };
}`;
const rolesStub = `
export const SUPER_ADMIN = 'tintinaccs@gmail.com';
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
  <link rel="stylesheet" href="/css/admin/tablero-pedidos.css"><style>
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
    <section class="adm-section active" id="section-pedidos"><div class="adm-card" id="orders-legacy">Listado legacy pedidos<table><tbody id="orders-tbody"><tr><td>Fila anterior de prueba</td></tr></tbody></table></div></section>
    <script>
      window.__calls=[];
      const call=(name,...args)=>window.__calls.push([name,...args]);
      window.prodNuevo=()=>{call('prodNuevo');document.getElementById('prod-form-card').style.display='block'};
      window.prodEditar=id=>call('prodEditar',id); window.prodToggleActive=(id,a)=>call('prodToggleActive',id,a); window.prodEliminar=id=>call('prodEliminar',id);
      window.collNueva=()=>call('collNueva'); window.collEditar=id=>call('collEditar',id); window.collVerProductos=id=>call('collVerProductos',id); window.collEliminar=(id,count)=>call('collEliminar',id,count);
      window.openOrderEdit=id=>call('openOrderEdit',id); window.updateOrderStatus=async(id,s,context={})=>{
        call('updateOrderStatus',id,s,context);
        if(window.__commit)return window.__commit(id,s,context);
        if(window.__changeDelay)await new Promise(resolve=>setTimeout(resolve,window.__changeDelay));
        if(window.__failChange)return false;
        const order=window.__orders.find(o=>o.id===id);
        if(context.baseChangeId != null && context.baseChangeId !== order.lastChangeId)return false;
        order.status=s;if(context.paymentStatus)order.paymentStatus=context.paymentStatus;order.lastChangeId=context.changeId || 'fixture_'+Date.now();order.inventoryRevision++;
        window.__publishOrders();return true;
      }; window.updatePayStatus=(id,s)=>{call('updatePayStatus',id,s);return true};
      window.resendOrderEmail=id=>call('resendOrderEmail',id); window.deleteOrder=id=>call('deleteOrder',id);
    </script>
    <script type="module" src="/js/admin/shopify-commerce-admin.js?v=tintin-20261007-public-consistency-1"></script>
  </body></html>`;
}

async function mockRuntime(page, {orders} = {}) {
  await page.route('**/*', async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='tintin.test')return route.abort();
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
    const local=path.resolve(ROOT,relative);
    if(!local.startsWith(ROOT+path.sep))return route.abort();
    if(/\.(?:mjs|js|css)$/.test(local) && fs.existsSync(local))return route.fulfill({status:200,contentType:local.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(local,'utf8')});
    return route.abort();
  });
  await page.route('https://tintin.test/js/admin/auth/app-check-admin.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export async function waitForAdminAppCheck(){return true;}'}));
  await page.route('https://tintin.test/js/core/auth/diagnostico-sesion.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export function recordAuthDiagnostic(){}'}));
  await page.route('https://tintin.test/js/core/auth/cliente-api-autenticado.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const authenticatedFetch=(...args)=>fetch(...args);'}));
  await page.route('https://tintin.test/api/admin-order-mutation*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,links:{customer:'https://wa.me/595981123456?text=Hola',map:'https://www.google.com/maps?q=-25.3,-57.5',dispatch:'https://wa.me/595982518206?text=Cliente%3A%20QA'}})}));
  await page.route('https://tintin.test/admin-commerce-fixture', route => route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml() }));
  await page.route('https://tintin.test/js/admin/shopify-commerce-admin.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: commerceJs }));
  await page.route('https://tintin.test/css/admin/shopify-commerce-admin.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: commerceCss }));
  await page.route('https://tintin.test/js/core/firebase/firebase.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: firebaseStub }));
  await page.route('https://tintin.test/js/core/auth/coordinador-sesion.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: sessionCoordinatorStub }));
  await page.route('https://tintin.test/js/core/auth/roles.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: rolesStub }));
  await page.route('https://tintin.test/js/core/auth/permisos-roles.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: permsStub }));
  await page.route('https://tintin.test/js/pages/collections/estado-colecciones.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: collectionsStub }));
  await page.route('https://tintin.test/js/components/images/utilidades-imagenes.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: imagesStub }));
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: authStub }));
  const firestoreSource=orders ? firestoreStub.replace("window.__orders=DATA.orders.map(o=>({id:o.id,...structuredClone(o.data),lastChangeId:'fixture_initial',inventoryRevision:1}));",`window.__orders=${JSON.stringify(orders)};`) : firestoreStub;
  await page.route('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: firestoreSource }));
  await page.route('https://img.test/**', route => route.fulfill({ status: 204, body: '' }));
}


module.exports={mockRuntime,fixtureHtml};
