import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAdminPagedSource} from '../../js/admin/datos/fuente-paginada-admin.mjs';
const source=fs.readFileSync('js/admin/shopify-commerce-admin.js','utf8');
const fn=source.slice(source.indexOf('function subscribeProductCatalog('),source.indexOf('\nfunction subscribeData()'));
for(const role of ['superadmin','admin'])test(`catálogo operativo ${role}: páginas completas y límite por consulta`,()=>{
 const watches=[],values=[];let loading=0;
 const deps={createAdminPagedSource,state:{role},db:{},collection:(_db,name)=>name,orderBy:field=>({order:field}),startAfter:cursor=>({cursor}),limit:n=>({limit:n}),query:(...parts)=>parts,onSnapshot:(query,options,next,fail)=>{const watch={query,options,next,fail,stopped:false};watches.push(watch);return()=>{watch.stopped=true;};}};
 const subscribe=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${fn};return subscribeProductCatalog;`)(deps);
 const stop=subscribe(rows=>values.push(rows),error=>{throw error;},()=>loading++);
 const docs=Array.from({length:1201},(_,i)=>({id:`product-${String(i).padStart(4,'0')}`,data:()=>({name:'Producto '+i})}));
 watches[0].next({docs:docs.slice(0,1000),metadata:{fromCache:true}});
 assert.equal(values.length,0,'el caché no se presenta como catálogo confirmado');
 for(let page=0;page<watches.length;page++){
  const watch=watches[page];assert.equal(watch.query.at(-1).limit,1000);assert.equal(watch.options.includeMetadataChanges,true);
  if(page)assert.ok(watch.query.some(part=>part?.cursor===docs[999]));
  watch.next({docs:docs.slice(page*1000,(page+1)*1000),metadata:{fromCache:false}});
 }
 assert.equal(values.at(-1).length,role==='superadmin'?1201:1000);assert.ok(loading>0);
 stop();const count=values.length;watches[0].next({docs:[],metadata:{fromCache:false}});assert.equal(values.length,count);assert.ok(watches.every(w=>w.stopped));
});
