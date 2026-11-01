import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {productIsPublished} from '../../js/core/store/estado-editorial-producto.mjs';
import {wristCategory,unifyWristCollections} from '../../js/core/store/categorias-pulseras.mjs';
const source=fs.readFileSync('functions/api/public-catalog.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replace('export async function onRequest','async function onRequest');
function setup(){const reads=[],cached=new Map();const context={productIsPublished,wristCategory,unifyWristCollections,rateLimit:()=>({allowed:true}),decodeFirestoreFields:v=>v,firestoreAdminGet:async(_env,path)=>{reads.push(path);return {name:path,fields:{name:path,price:30000,active:!path.endsWith('/hidden'),publicationStatus:path.endsWith('/hidden')?'draft':'active',internalNotes:'Privado',stock:0}};},firestoreAdminListAll:()=>{throw Error('No full catalog scan');},Request,Response,URL,Headers,console,caches:{default:{match:async key=>cached.get(key.url)?.clone(),put:async(key,value)=>cached.set(key.url,value)}}};vm.createContext(context);vm.runInContext(source,context);return {request:qs=>context.onRequest({request:new Request('https://tintin.test/api/public-catalog?resource=products&'+qs),env:{}}),reads};}
test('lote lee sólo identidades pedidas, excluye borradores y campos privados y separa caché',async()=>{
 const api=setup();const first=await api.request('ids='+encodeURIComponent(JSON.stringify(['b','a','a','hidden'])));const body=await first.json();assert.equal(first.status,200);assert.deepEqual(body.items.map(i=>i.id),['a','b']);assert.equal(body.items[0].data.internalNotes,undefined);assert.equal(body.items[0].data.stock,0);assert.deepEqual(api.reads,['products/a','products/b','products/hidden']);
 await api.request('ids='+encodeURIComponent(JSON.stringify(['a','b','hidden'])));assert.equal(api.reads.length,3);
 await api.request('ids='+encodeURIComponent(JSON.stringify(['other'])));assert.equal(api.reads.length,4);
});
test('lotes inválidos no consumen lecturas',async()=>{for(const ids of [[],['../secret'],Array.from({length:31},(_,i)=>String(i)),[1],null]){const api=setup();assert.equal((await api.request('ids='+encodeURIComponent(JSON.stringify(ids)))).status,400);assert.equal(api.reads.length,0);}});
test('ids reservados por Firestore responden item null sin consultar Firestore',async()=>{
 for(const id of ['__x__','__name__','.','..']){const api=setup();const res=await api.request('id='+encodeURIComponent(id));assert.equal(res.status,200);assert.equal((await res.json()).item,null);assert.equal(api.reads.length,0);}
});
