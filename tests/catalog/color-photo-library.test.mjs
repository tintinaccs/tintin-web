import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const library=fs.readFileSync(new URL('../../js/components/images/biblioteca-multimedia.js',import.meta.url),'utf8');
const helper=fs.readFileSync(new URL('../../js/components/images/galeria-producto.js',import.meta.url),'utf8');
const usage=library.slice(library.indexOf('export async function findImageUsage'),library.indexOf('/** Registra el borrado'));
const orphan=library.slice(library.indexOf('export async function findOrphanedMedia'),library.indexOf('/** Suscripción en vivo'));
test('una foto usada sólo por un color no es huérfana; la revisión masiva lee el catálogo una vez',async()=>{
  const photo='https://res.cloudinary.com/shop/image/upload/v1/gold.webp';let catalogReads=0;
  const products={truncated:false,docs:[{id:'p',data:()=>({name:'Aro',variantMedia:[{Color:'Dorado',imageUrls:[photo]}]})}]};
  const c=vm.createContext({URL,window:{location:{href:'https://example.test/admin'}},db:{},MEDIA_COLLECTION:'media',console,collection:(_,name)=>name,query:(name)=>name,limit:()=>{},where:()=>{},orderBy:()=>{},doc:()=>{},getDoc:async()=>({exists:()=>false}),getDocs:async name=>name==='media'?{docs:[{id:'used',data:()=>({url:photo})},{id:'free',data:()=>({url:'https://example.test/free.webp'})}]}:{empty:true,forEach(){}},getDocsPaginated:async()=>{catalogReads++;return products;}});
  vm.runInContext(helper+'\n'+(usage+orphan).replace(/export /g,''),c);
  const result=await vm.runInContext('findOrphanedMedia()',c);assert.deepEqual(Array.from(result,x=>x.id),['free']);assert.equal(catalogReads,1);
  products.truncated=true;await assert.rejects(vm.runInContext('findImageUsage("https://example.test/anything.webp")',c),/No se pudo verificar/);
});
