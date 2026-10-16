import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAdminPagedSource } from '../../js/admin/datos/fuente-paginada-admin.mjs';

const source = fs.readFileSync(new URL('../../js/pages/collections/estado-colecciones.js', import.meta.url), 'utf8');
const start = source.indexOf('async function startAdminListener()');
const end = source.indexOf('\nexport function onAllCollectionsUpdate', start);
const listener = source.slice(start, end).replace(/\bimport\(/g, 'loadModule(');
for (const owner of [true, false]) test(`el selector de importación recibe ${owner ? 'todas las 251' : '200'} colecciones según su rol y conserva cambios remotos`, async () => {
  const watches=[], values=[], cached=[];
  let stopped=0;
  const deps={ auth:{currentUser:{uid:'fixture'}}, db:{}, CACHE_KEY:'fixture',
    adminSubscribers:new Set([(rows,error)=>{assert.equal(error,null);values.push(rows)}]),
    loadModule:async path=>path.includes('lecturas-admin')?{subscribeAdminSnapshot:(query,next,fail)=>{watches.push({query,next,fail});return()=>stopped++}}:path.includes('fuente-paginada')?{createAdminPagedSource}:{isSuperAdmin:()=>owner},
    collection:(_db,name)=>name,orderBy:field=>({order:field}),startAfter:cursor=>({cursor}),limit:n=>({limit:n}),query:(...args)=>args,
    normalizeCollectionDoc:(id,data)=>({slug:id,...data}),sortCols:rows=>rows,recordFirestoreRead:()=>{},writeCached:(_key,rows)=>cached.push(rows),
  };
  const open=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;let adminUnsubscribe=null;${listener};return async()=>{await startAdminListener();return adminUnsubscribe}`)(deps);
  const stop=await open();
  const docs=Array.from({length:251},(_,i)=>({id:`col-${i}`,data:()=>({name:`Colección ${i}`})}));
  watches[0].next({docs:docs.slice(0,200),size:200});
  assert.equal(watches[0].query.at(-1).limit,200);
  if(owner){assert.equal(values.length,0,'no se publica una lista intermedia de 200');watches[1].next({docs:docs.slice(200),size:51});}
  assert.equal(values.at(-1).length,owner?251:200);
  assert.equal(cached.at(-1).length,owner?251:200);
  if(owner){const last=docs.slice(200).map(doc=>({...doc,data:()=>({name:'Actualizada'})}));watches[1].next({docs:last,size:51});assert.equal(values.at(-1).at(-1).name,'Actualizada');}
  stop();assert.equal(stopped,owner?2:1);
});
