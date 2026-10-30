import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/core/store/estado-productos.js', import.meta.url), 'utf8');
const loads = source.slice(source.indexOf('export async function loadHomeProducts'), source.indexOf('async function fetchSingleProduct(')).replaceAll('export ', '');

function loadContext(overrides={}) {
  const context=vm.createContext({catalogRevision:0,homeIndexRevision:0,completeCatalogRevision:0,HOME_CACHE_KEY:'home-v2',ALL_CACHE_KEY:'products:cards',HOME_CACHE_TTL:60000,ALL_CACHE_TTL:60000,homeSelection:null,homeIndex:[],homeIndexSavedAt:0,completeCatalog:null,window:{TintinCatalogPolicy:{isPurchasable:()=>true}},readCached:()=>null,readStaleCached:()=>null,...overrides});
  vm.runInContext(loads,context);return context;
}
for (const target of ['loadHomeProducts','loadAllProducts']) {
 test(`${target}: caché de su autoridad aparece sin esperar la red`,async()=>{
  const products=[{id:'p1',name:'Reloj',price:120000}];let published;
  const context=loadContext({readCached:key=>key===(target==='loadHomeProducts'?'home-v2':'products:cards')?(target==='loadHomeProducts'?{products,selection:{discovery:['p1']},index:[]}:products):null,publish:list=>(published=list),publishHome:list=>(published=list),runSingleFlight(){throw Error('No debe consultar red');}});
  assert.equal(await context[target](),products);assert.equal(published,products);
 });
 test(`${target}: caché vencida se muestra mientras una actualización sigue pendiente`,()=>{
  const products=[{id:'p1',name:'Reloj'}];let published;
  const context=loadContext({readStaleCached:key=>key===(target==='loadHomeProducts'?'home-v2':'products:cards')?(target==='loadHomeProducts'?{products,selection:{discovery:['p1']},index:[]}:products):null,publish:list=>(published=list),publishHome:list=>(published=list),runSingleFlight:()=>new Promise(()=>{}),fetchHomeProducts(){},fetchAllProducts(){}});
  void context[target]();assert.equal(published,products);
 });
}
test('buscar nunca adopta un subconjunto de Inicio como catálogo completo',async()=>{
 const home=[{id:'partial'}],full=[{id:'partial'},{id:'other'}];let calls=0,published;
 const context=loadContext({readCached:key=>key==='home-v2'?{products:home,selection:{},index:[]}:null,runSingleFlight:async(_key,load)=>{calls++;return load();},fetchAllProducts:async()=>full,publish:list=>(published=list)});
 assert.equal(await context.loadAllProducts(),full);assert.equal(calls,1);assert.notEqual(published,home);
});
test('Inicio puede reutilizar un catálogo completo fresco sin volver a solicitarlo',async()=>{
 const full=[{id:'p1',category:'anillos',destacado:true}];let calls=0;
 const context=loadContext({readCached:key=>key==='products:cards'?full:null,fetchHomeProducts:async()=>{calls++;return full;},runSingleFlight(){throw Error('Red innecesaria');}});
 assert.equal(await context.loadHomeProducts(),full);assert.equal(calls,1);assert.equal(context.completeCatalog,full);assert.equal(context.homeIndex[0].id,'p1');
});

test('consumidores simultáneos comparten request y una falla permite volver a solicitar', async () => {
  const cache = fs.readFileSync(new URL('../../js/core/firebase/cache-lecturas-firestore.js', import.meta.url), 'utf8').replace(/^export /gm, '');
  const api = fs.readFileSync(new URL('../../js/core/firebase/catalogo-publico-api.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  let calls = 0, respond;
  const context = vm.createContext({ AbortController, URLSearchParams, window: { setTimeout, clearTimeout },
    fetch: () => { calls++; return new Promise(resolve => { respond = resolve; }); },
  });
  vm.runInContext(cache + '\n' + api, context);
  const first = context.fetchPublicCatalogResource('products');
  const second = context.fetchPublicCatalogResource('products');
  await Promise.resolve();
  assert.equal(calls, 1);
  respond({ ok: false, status: 503 });
  const failure = await Promise.allSettled([first, second]);
  assert.ok(failure.every(result => result.status === 'rejected'));
  const retry = context.fetchPublicCatalogResource('products');
  await Promise.resolve();
  assert.equal(calls, 2);
  respond({ ok: true, json: async () => ({ ok: true, resource: 'products', items: [] }) });
  assert.deepEqual(Array.from(await retry), []);
});
