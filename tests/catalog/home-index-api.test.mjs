import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {homeProductIndex} from '../../cloudflare/indice-inicio.mjs';
import {productIsPublished} from '../../js/core/store/estado-editorial-producto.mjs';
import {wristCategory,unifyWristCollections} from '../../js/core/store/categorias-pulseras.mjs';
const source=fs.readFileSync('functions/api/public-catalog.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
test('índice público omite fichas, conserva más de mil IDs y reutiliza snapshot del catálogo completo',async()=>{
 const cached=new Map();let reads=0;
 const context={URL,Request,Response,Headers,console,homeProductIndex,productIsPublished,wristCategory,unifyWristCollections,rateLimit:()=>({allowed:true}),decodeFirestoreFields:v=>v,
  firestoreAdminListAll:async(_env,resource,max,options)=>{reads++;assert.equal(resource,'products');assert.ok(max>=1501);assert.equal(options.failOnTruncation,true);return Array.from({length:1501},(_,i)=>({name:'products/p'+i,fields:{name:'Anillo '+i,category:'anillos',price:25000,stock:1,active:true,imageUrl:i===0?'/cover.svg':'',description:'X'.repeat(1000),internalNotes:'privado'}}));},
  caches:{default:{match:async key=>cached.get(key.url)?.clone(),put:async(key,value)=>cached.set(key.url,value)}}};
 vm.createContext(context);vm.runInContext(source,context);
 const request=qs=>context.onRequest({request:new Request('https://example.test/api/public-catalog?resource=products'+qs),env:{}});
 const home=await request('&view=home-index');const index=await home.json();assert.equal(index.items.length,1501);assert.equal(index.items.find(row=>row.id==='p0').data.collectionImage,'https://example.test/cover.svg');assert.equal(index.items[0].data.description,undefined);assert.equal(index.items[0].data.internalNotes,undefined);
 const full=await request('');const all=await full.json();assert.equal(all.items.length,1501);assert.equal(reads,1);assert.ok(all.items[0].data.description);assert.equal(all.items[0].data.internalNotes,undefined);
 assert.equal((await request('&view=home-index&id=x')).status,400);
});

test('el recorrido real rechaza truncamientos y permite un catálogo exactamente dentro del presupuesto',async()=>{
 const helper=fs.readFileSync('cloudflare/firebase-admin-ligero.js','utf8');
 const fn=helper.slice(helper.indexOf('export async function firestoreAdminListAll'),helper.indexOf('function encodeFirestoreValue')).replace('export ','');
 let truncated=true;
 const runtime={URLSearchParams,parseServiceAccount:()=>({}),getGoogleAccessToken:async()=> 'fixture',FIRESTORE_SCOPE:'fixture',firestoreDocUrl:()=> 'https://fixture.invalid/products',fetch:async()=>({ok:true,status:200,json:async()=>({documents:[{name:'one'},{name:'two'}],...(truncated?{nextPageToken:'more'}:{})})})};
 vm.createContext(runtime);vm.runInContext(fn,runtime);
 await assert.rejects(()=>runtime.firestoreAdminListAll({},'products',2,{failOnTruncation:true}),/no se publica un catálogo parcial/);
 truncated=false;assert.equal((await runtime.firestoreAdminListAll({},'products',2,{failOnTruncation:true})).length,2);
});
