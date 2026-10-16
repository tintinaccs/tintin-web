import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source = fs.readFileSync('js/core/store/estado-productos.js','utf8');
const code = source.slice(0,source.indexOf('window.TintinProductsStore =')).replace(/^import[\s\S]*?;\s*$/gm,'').replace(/\bexport\s+/g,'');
const item = (id,category='aros') => ({id,data:{name:id,category,price:100,stock:1,active:true}});
const tick = () => new Promise(resolve=>setImmediate(resolve));
function harness(prefetch, cached = new Map(), realtime = new Promise(()=>{}), visibility = Promise.resolve()) {
  const window = new EventTarget();
  const renders=[];
  window.setTimeout=()=>1;window.clearTimeout=()=>{};
  window._renderProductDetail=p=>{renders.push(p);window.dispatchEvent(new CustomEvent('tintin:product-rendered',{detail:{product:p}}));};
  window._showProductNotFound=()=>{};
  let reads=0;
  const context=vm.createContext({window,location:{pathname:'/product',search:'?id=main'},document:{getElementById:id=>id==='product-detail'?{}:null},CustomEvent,URLSearchParams,AbortController,Response,Promise,console,
    catalogVisibilityReady:visibility,loadProductRealtimeDependencies:()=>realtime,getProductPagePrefetch:()=>typeof prefetch==='function'?prefetch():prefetch,readCached:key=>cached.get(key),writeCached:(key,value)=>cached.set(key,value),readStaleCached:()=>null,recordFirestoreRead:()=>{},runSingleFlight:(_,fn)=>fn(),
    fetchPublicCatalogResource:async()=>{reads++;return [item('fallback','collares')];},fetch:async()=>{throw Error('petición duplicada');},appCheckReady:new Promise(()=>{}),db:{},
    wristCategory:x=>x,cleanText:x=>String(x??''),cleanMultilineText:x=>String(x??''),sanitizeVariantData:x=>x,sanitizeImageUrl:x=>x,uniqueSafeImageUrls:x=>x,sortCatalogProducts:x=>x,timestampToMillis:()=>0});
  vm.runInContext(code,context);
  return {context,window,renders,reads:()=>reads};
}
test('edge y recomendaciones aparecen sin esperar App Check y sin descargar dos veces',async()=>{
  const h=harness({response:Promise.resolve(Response.json({ok:true,resource:'products',item:item('main')})),catalog:Promise.resolve([item('main'),item('other','collares')])});
  vm.runInContext("startProductRealtime('main')",h.context);
  for(let i=0;i<8;i++)await tick();
  assert.deepEqual(Array.from(h.window.PRODUCTS,p=>p.id),['main','other']);
  assert.equal(h.reads(),0);
});
test('un producto eliminado durante la precarga no reaparece por una recomendación tardía',async()=>{
  let complete;
  const catalog=new Promise(resolve=>complete=resolve);
  const h=harness({response:Promise.resolve(Response.json({ok:true,resource:'products',item:null})),catalog},new Map([['product:main',{id:'main',name:'main',category:'aros',price:100,stock:1}]]));
  vm.runInContext("startProductRealtime('main')",h.context);
  for(let i=0;i<8;i++)await tick();
  complete([item('main'),item('other','collares')]);
  for(let i=0;i<8;i++)await tick();
  assert.equal(h.window.PRODUCTS.length,0);
});
const preloadCode=fs.readFileSync('js/pages/product/precarga-datos-producto.js','utf8').replace(/^import.*$/gm,'').replace(/\bexport\s+/g,'');
function preloadHarness(pathname,search,{preview=false,cached=null}={}) {
  let single=0,catalog=0,clock=1000;
  const window={setTimeout:()=>1,clearTimeout(){}};window.parent=preview?{}:window;
  const c=vm.createContext({window,location:{pathname,search},URLSearchParams,AbortController,Date:{now:()=>clock},fetch:async()=>{single++;return Response.json({});},fetchPublicCatalogResource:async()=>{catalog++;return [];},readCached:()=>cached});
  vm.runInContext(preloadCode,c);
  return {single:()=>single,catalog:()=>catalog,get:id=>vm.runInContext(`getProductPagePrefetch(${JSON.stringify(id)})`,c),expire:()=>clock+=30001};
}
test('precarga respeta la ruta, el id y el aislamiento de la previsualización',()=>{
  for(const [path,search,options] of [['/about','?id=main',{}],['/product','',{}],['/product','?id=a%2Fb',{}],['/product','?id=main&ttVisualPreview=1',{preview:true}]]) {
    const h=preloadHarness(path,search,options);assert.equal(h.single(),0);assert.equal(h.catalog(),0);
  }
});
test('precarga reutilizable vence y no vuelve a descargar un catálogo local fresco',()=>{
  const h=preloadHarness('/product','?id=main',{cached:[{id:'known'}]});
  assert(h.get('main'));assert(h.get('main'));assert.equal(h.single(),1);assert.equal(h.catalog(),0);
  h.expire();assert.equal(h.get('main'),null);assert.equal(h.get('other'),null);
});
test('el grafo estático de datos públicos no descarga ni espera el SDK Firebase',()=>{
  const visited=new Set();
  const root=process.cwd();
  function visit(file){
    const absolute=path.resolve(file);
    if(visited.has(absolute))return;visited.add(absolute);
    const text=fs.readFileSync(absolute,'utf8');
    for(const match of text.matchAll(/^import\s+(?:(?:[^;]+?)\s+from\s+)?['"]([^'"]+)['"]/gm)){
      const spec=match[1].split('?')[0];
      if(spec.startsWith('http')){assert(!/firebase/.test(spec),spec);continue;}
      if(spec.startsWith('.'))visit(path.resolve(path.dirname(absolute),spec));
    }
  }
  visit(path.join(root,'js/core/store/estado-productos.js'));
  assert(!Array.from(visited).some(file=>file.endsWith(`${path.sep}firebase${path.sep}firebase.js`)));
});

test('el SDK diferido toma el relevo con stock vivo después de pintar datos públicos',async()=>{
  let enable, snapshot;
  const realtime=new Promise(resolve=>enable=resolve);
  const h=harness({response:Promise.resolve(Response.json({ok:true,resource:'products',item:item('main')})),catalog:Promise.resolve([item('main'),item('other','collares')])},new Map(),realtime);
  vm.runInContext("startProductRealtime('main')",h.context);
  for(let i=0;i<8;i++)await tick();
  assert.equal(h.window.PRODUCTS[0].stock,1);
  enable({db:{},doc:()=>({}),getDoc:()=>{},appCheckReady:Promise.resolve(true),onSnapshot:(_,cb)=>{snapshot=cb;return()=>{};}});
  for(let i=0;i<8;i++)await tick();
  snapshot({id:'main',exists:()=>true,data:()=>({...item('main').data,stock:0,price:200})});
  for(let i=0;i<8;i++)await tick();
  assert.equal(h.window.PRODUCTS.find(p=>p.id==='main').stock,0);
  assert.equal(h.window.PRODUCTS.find(p=>p.id==='main').price,200);
});

test('la caché pendiente de visibilidad no sobrescribe stock confirmado en vivo',async()=>{
  let release, snapshot;
  const visibility=new Promise(resolve=>release=resolve);
  const realtime=Promise.resolve({db:{},doc:()=>({}),appCheckReady:Promise.resolve(true),onSnapshot:(_,cb)=>{snapshot=cb;return()=>{};}});
  const h=harness({response:new Promise(()=>{}),catalog:Promise.resolve([])},new Map([['product:main',{id:'main',name:'main',category:'aros',stock:9}]]),realtime,visibility);
  vm.runInContext("startProductRealtime('main')",h.context);
  for(let i=0;i<8;i++)await tick();
  snapshot({id:'main',exists:()=>true,data:()=>({...item('main').data,stock:0})});
  release();
  for(let i=0;i<8;i++)await tick();
  assert.equal(h.window.PRODUCTS.find(p=>p.id==='main').stock,0);
});

test('una ficha iniciada a tiempo conserva la precarga aunque venza antes de pintar relacionados',async()=>{
  let expired=false, takes=0, release;
  const transport={response:new Promise(resolve=>release=resolve),catalog:Promise.resolve([item('main'),item('other','collares')])};
  const h=harness(()=>{takes++;return expired?null:transport;});
  vm.runInContext("startProductRealtime('main')",h.context);
  expired=true;
  release(Response.json({ok:true,resource:'products',item:item('main')}));
  for(let i=0;i<8;i++)await tick();
  assert.deepEqual(Array.from(h.window.PRODUCTS,p=>p.id),['main','other']);
  assert.equal(takes,1);
  assert.equal(h.reads(),0);
});
