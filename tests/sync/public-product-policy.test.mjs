import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { hasPublicProductFields } from '../../js/core/store/publicacion-producto.mjs';
import { renderProductMetadataHtml } from '../../functions/product.js';
const read = p => fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const strip = s => s.replace(/^import[\s\S]*?;\s*$/gm,'').replace(/\bexport\s+/g,'');
const html = '<html><head></head><body></body></html>';
test('unlimited and finite stock produce the correct structured availability', () => {
 for(const [stock,expected] of [[null,'InStock'],['','InStock'],[5,'InStock'],[0,'OutOfStock'],[-1,'OutOfStock']]) {
  const rendered=renderProductMetadataHtml(html,'p',{name:'Test',category:'aros',price:70000,stock});
  const ld=JSON.parse(rendered.html.match(/id="tt-product-jsonld-server">(.*?)<\/script>/s)[1]);
  assert.equal(ld.offers.availability,'https://schema.org/'+expected);
 }
});
test('GET and HEAD share definitive index policy; transient failures remain retryable', async () => {
 let data={name:'',price:0,category:'',active:true};
 const c={URL,Headers,Response,Request,setTimeout,clearTimeout,console,hasPublicProductFields,firestoreAdminGet:async()=>{if(data instanceof Error)throw data;return data===null?null:{fields:data}},decodeFirestoreFields:x=>x};
 vm.createContext(c);vm.runInContext(strip(read('functions/product.js')),c);
 for(const scenario of [null,{name:'',category:'',price:0},{name:'Valid',category:'aros',price:70000,stock:null},new Error('transient')]) {
  data=scenario;
  const headers=[];
  for(const method of ['GET','HEAD']) {
   c.context={request:new Request('https://tintin.test/product?id=p',{method}),env:{ASSETS:{fetch:async()=>new Response(method==='HEAD'?null:html,{headers:{'content-type':'text/html'}})}}};
   const response=await vm.runInContext('onRequest(context)',c);
   headers.push(response.headers.get('x-robots-tag'));
   assert.equal(response.headers.get('x-robots-tag'),scenario===null || scenario?.price===0?'noindex, nofollow':null);
   if(method==='HEAD')assert.equal(await response.text(),'');
  }
  assert.equal(headers[0],headers[1]);
 }
});
test('legacy fallback aliases refresh after TTL, coalescing concurrent lookups', async () => {
 let now=0,calls=0;
 const c={Date:{now:()=>now},console,firestoreAdminListAll:async()=>{calls++;return[{name:'products/p',fields:{name:calls===1?'Old Product':'New Product'}}]},decodeFirestoreFields:x=>x};
 vm.createContext(c);vm.runInContext(strip(read('functions/products/[handle].js')),c);
 await Promise.all([vm.runInContext('legacyFallbackMap({})',c),vm.runInContext('legacyFallbackMap({})',c)]);assert.equal(calls,1);
 now=300001;
 const next=await vm.runInContext('legacyFallbackMap({})',c);assert.equal(calls,2);assert(next.has('new-product'));assert(!next.has('old-product'));
});

test('publication rejects incomplete/invalid products and retains sold out valid products', () => {
 const product={id:'p',name:'Valid',category:'aros',price:70000,stock:null};
 assert(hasPublicProductFields(product));
 for(const update of [{id:''},{name:' '},{category:''},{price:0},{price:NaN},{price:1_000_000_001},{stock:'invalid'},{active:false}])assert(!hasPublicProductFields({...product,...update}),JSON.stringify(update));
 assert(hasPublicProductFields({...product,stock:0}));
});

test('product sitemap excludes structurally invalid and inactive documents', async () => {
 const rows=[{id:'valid',name:'Valid',category:'aros',price:70000,stock:0},{id:'invalid',name:'',category:'',price:0},{id:'inactive',name:'Hidden',category:'aros',price:70000,active:false}];
 const c={URL,Headers,Response,Request,console,hasPublicProductFields,firestoreAdminListAll:async()=>rows.map(p=>({name:'products/'+p.id,fields:p})),decodeFirestoreFields:x=>x};
 vm.createContext(c);vm.runInContext(strip(read('functions/sitemap-products.xml.js')),c);
 c.context={request:new Request('https://tintin.test/sitemap-products.xml'),env:{}};
 const response=await vm.runInContext('onRequest(context)',c);const body=await response.text();
 assert.match(body,/product\?id=valid/);assert(!body.includes('id=invalid'));assert(!body.includes('id=inactive'));
});

test('el catálogo público conserva asociaciones de fotos por color y excluye datos privados', () => {
  const c=vm.createContext({});vm.runInContext(strip(read('functions/api/public-catalog.js')),c);
  c.product={name:'Aro',variantMedia:[{Color:'Dorado',imageUrls:['https://example.test/a.webp']}],internalNotes:'private',costUnit:12};
  const result=vm.runInContext('pickKnownFields(product,PRODUCT_FIELDS)',c);
  assert.equal(result.variantMedia[0].imageUrls.length,1);assert.equal(result.internalNotes,undefined);assert.equal(result.costUnit,undefined);
});
