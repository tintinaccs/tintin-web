import { normalizeCollectionSlug } from '../../js/core/store/colecciones-publicas.mjs';
import { ordersForView } from '../../js/orders/pedidos-prueba.mjs';
import { wristCategory, unifyWristCollections } from '../../js/core/store/categorias-pulseras.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { hasPublicProductFields } from '../../js/core/store/publicacion-producto.mjs';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = p => fs.readFileSync(repo + p, 'utf8');
const block = (s,a,b) => s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
const strip = s => s.replace(/^import[\s\S]*?;\s*$/gm,'').replace(/\bexport\s+/g,'');
const tick = () => new Promise(r => setImmediate(r));
const deferred = () => { let resolve; const promise = new Promise(r => resolve=r); return {promise,resolve}; };
function productsHarness(){
 const edge=deferred(),related=[],pub=[];let next;
 const win={location:{pathname:'/product',search:'?id=main'},setTimeout,clearTimeout,addEventListener(){},dispatchEvent(e){pub.push({source:e.detail.source,products:e.detail.products})}};
 const c={wristCategory,window:win,location:win.location,document:{getElementById(){return null}},URLSearchParams,AbortController,CustomEvent:class{constructor(type,x){this.type=type;this.detail=x.detail}},console,appCheckReady:Promise.resolve(true),db:{},doc(...x){return x},collection(...x){return x},query(...x){return x},where(...x){return x},limit(x){return x},onSnapshot(d,cb){next=cb;return()=>{}},fetchPublicCatalogResource(){const d=deferred();related.push(d);return d.promise},getDocs(){throw Error('Unexpected full SDK read')},fetch:()=>edge.promise,runSingleFlight:(k,fn)=>fn(),readCached:()=>null,readStaleCached:()=>null,writeCached(){},recordFirestoreRead(){},cleanText:x=>String(x??''),cleanMultilineText:x=>String(x??''),sanitizeImageUrl:x=>x||'',uniqueSafeImageUrls:x=>x,sanitizeVariantData:x=>x,timestampToMillis:x=>Number(x)||0,sortCatalogProducts:x=>x};
 c.catalogVisibilityReady=Promise.resolve();c.getProductPagePrefetch=()=>null;c.loadProductRealtimeDependencies=async()=>({db:c.db,doc:c.doc,getDoc:c.getDoc,onSnapshot:c.onSnapshot,appCheckReady:c.appCheckReady});
 vm.createContext(c);const src=read('js/core/store/estado-productos.js');vm.runInContext(src.slice(src.indexOf('const ALL_CACHE_KEY'),src.indexOf('function attachSearchDemand')).replace(/\bexport\s+/g,''),c);
 return{c,win,edge,related,pub,next:(data)=>next({id:'main',exists:()=>data!==null,data:()=>data}),start:()=>vm.runInContext("startProductRealtime('main')",c),respondEdge:data=>edge.resolve({ok:true,json:async()=>({ok:true,resource:'products',item:{id:'main',data}})})};
}

test('related cards reconcile price stock and name',async()=>{const grid={innerHTML:'',setAttribute(){},closest(){return{hidden:false}},querySelectorAll(){return[]}};const win={location:{href:'https://tintinaccesorios.pages.dev/product?id=main',search:'?id=main'},PRODUCTS:[{id:'main',name:'Main',category:'aros',price:100,stock:5},{id:'r',name:'Before',category:'collares',price:100,stock:5}],matchMedia(){return{matches:true}},addEventListener(){},requestAnimationFrame(fn){fn()},setTimeout,renderProductCardMarkup:p=>`${p.name}|${p.price}|${p.stock}`};const c={window:win,document:{getElementById:id=>id==='related-grid'?grid:null},MutationObserver:class{observe(){}disconnect(){}},URL,URLSearchParams,sessionStorage:{getItem:()=>null,setItem(){}},console};vm.runInNewContext(read('js/pages/product/productos-relacionados.js'),c);const before=grid.innerHTML;win.PRODUCTS=[win.PRODUCTS[0],{id:'r',name:'After',category:'collares',price:200,stock:2}];win.TintinRelatedProducts.sync();assert.notEqual(grid.innerHTML,before);assert.match(grid.innerHTML,/After\|200\|2/);return{display:grid.innerHTML,newData:win.PRODUCTS[1]}});
test('late edge responses cannot overwrite confirmed SDK price and stock',async()=>{const h=productsHarness();h.start();await tick();h.next({name:'Fresh',category:'aros',price:200,stock:0});await tick();h.respondEdge({name:'Old',category:'aros',price:100,stock:5});await tick();assert.equal(h.win.PRODUCTS[0].price,200);return h.pub.map(x=>({source:x.source,price:x.products[0]?.price,stock:x.products[0]?.stock}))});
test('late related requests cannot restore a previous category',async()=>{const h=productsHarness();h.start();await tick();h.respondEdge({name:'Main',category:'aros',price:100,stock:5});await tick();h.next({name:'Main',category:'aros',price:100,stock:5});await tick();h.next({name:'Main',category:'collares',price:100,stock:5});await tick();const snap=(id,cat)=>[{id,data:{name:id,category:cat,price:100,stock:5}}];h.related[1].resolve(snap('new-related','collares'));await tick();h.related[0].resolve(snap('old-related','aros'));await tick();assert.equal(h.win.PRODUCTS[1].id,'new-related');return h.win.PRODUCTS.map(p=>({id:p.id,category:p.category}))});
test('late related requests cannot resurrect a deleted product',async()=>{const h=productsHarness();h.start();await tick();h.respondEdge({name:'Main',category:'aros',price:100,stock:5});await tick();h.next({name:'Main',category:'aros',price:100,stock:5});await tick();h.next(null);await tick();assert.equal(h.win.PRODUCTS.length,0);h.related[0].resolve([]);await tick();assert.equal(h.win.PRODUCTS.length,0);return h.pub.map(x=>({source:x.source,ids:x.products.map(p=>p.id)}))});
test('favorites clear immediately on logout and account transition',async()=>{const root={innerHTML:'',addEventListener(){}};let authCb,snapCb;const c={auth:{},db:{},appCheckReady:Promise.resolve(true),document:{getElementById:()=>root},subscribeAuthState:cb=>authCb=cb,collection:(...x)=>x,onSnapshot:(q,cb)=>{snapCb=cb;return()=>{}},window:{},console,alert(){}};vm.runInNewContext(strip(read('js/pages/profile/favoritos-perfil.js')),c);await authCb({uid:'A'});snapCb({docs:[{data:()=>({name:'Private A',productId:'p',price:100})}]});const first=root.innerHTML;await authCb(null);assert.notEqual(root.innerHTML,first);assert(!root.innerHTML.includes('Private A'));await authCb({uid:'B'});assert.notEqual(root.innerHTML,first);assert(!root.innerHTML.includes('Private A'));return{afterLogoutRetainsPreviousData:false,beforeNewUserSnapshotRetainsPreviousData:false}});
test('partial order history is explicit and recovers on a successful snapshot',async()=>{
 const {profileOrdersFactory}=await import('../helpers/profile-orders-controller.mjs');
 const callbacks=[],states=[];
 const controller=profileOrdersFactory()({readIndexPage:async()=>({items:[{id:'o',total:10}],cursor:'',readTime:'same'}),subscribe:(id,next,fail)=>{callbacks.push({next,fail});return()=>{};},render(){},onStatus:(...args)=>states.push(args),onStats(){}});
 await controller.start({uid:'A',email:'a@example.org'});callbacks[0].next({id:'o',total:10});callbacks[0].fail({code:'permission-denied'});assert.equal(states.at(-1)[0],'partial');callbacks[0].next({id:'o',total:10});assert.equal(states.at(-1)[0],'ready');
});

test('public collections deduplicate canonical URLs while preserving empty published collections', () => {
 const c={console,wristCategory,unifyWristCollections,normalizeCollectionSlug};vm.createContext(c);
 const src=read('js/pages/collections/datos-publicos-colecciones.js');
 vm.runInContext(block(src,'export function canonicalPublicCollections','export async function loadCollections').replace(/\bexport\s+/g,''),c);
 c.rows=[{slug:'bags',name:'Removed',order:2},{slug:'bolsos',name:'Removed too',order:1},{slug:'ear-cuff',name:'Empty',order:3},{slug:'earcuff',name:'Duplicate',order:4},{slug:'hidden',name:'Hidden',order:0,visible:false}];
 const rows=vm.runInContext('canonicalPublicCollections(rows)',c);
 assert.deepEqual(Array.from(rows,x=>x.slug),['bolsos','earcuff']);assert.equal(rows.find(item => item.slug === 'earcuff').name,'Empty');
});

test('catalog load error stays an error through the maintenance guard', () => {
 const node={dataset:{},textContent:''},grid={children:[{}],textContent:'No pudimos actualizar',querySelector:s=>s.includes('data-state=')?{}:null,setAttribute(){}};
 const c={grid,body:{classList:{add(){}}},loadingTimer:0,gridObserver:null,lastGridSignature:'',navigator:{onLine:true},document:{getElementById:()=>node},window:{ttPageReady(){},TintinLoader:{hide(){}}},clearTimeout,requestAnimationFrame:fn=>fn()};
 vm.createContext(c);vm.runInContext(block(read('js/pages/catalog/mantenimiento-catalogo.js'),'  function setReady()','  function normalizeUrlState()'),c);vm.runInContext('guardCatalogSurface()',c);
 assert.equal(node.dataset.state,'error');assert(!node.textContent.includes('Catálogo actualizado'));
});

test('una revisión de datos renueva el catálogo sin TTL y conserva la suscripción de la ficha', async () => {
 const callbacks = {}, calls = [];
 const location = { pathname: '/catalogo' };
 const src = read('js/core/store/estado-productos.js');
 const listener = block(src, "window.addEventListener('tintin:site-content-updated'", 'attachSearchDemand();');
 vm.runInNewContext(listener, { location, window: { addEventListener: (name, fn) => callbacks[name] = fn },
   ensureProductsForCurrentPage: options => { calls.push(options.force); return Promise.resolve([]); } });
 callbacks['tintin:site-content-updated']();
 assert.deepEqual(calls, [true]);
 location.pathname = '/product.html';
 callbacks['tintin:site-content-updated']();
 assert.deepEqual(calls, [true]);
 location.pathname = '/';
 callbacks['tintin:site-content-updated']();
 assert.deepEqual(calls, [true, true]);
});
