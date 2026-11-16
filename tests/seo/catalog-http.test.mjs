import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import {onRequest as catalogRequest} from '../../functions/catalogo.js';
import {onRequest as productSitemap} from '../../functions/sitemap-products.xml.js';
import {onRequest as categorySitemap} from '../../functions/sitemap-collections.xml.js';
import {encodeFirestoreFields} from '../../cloudflare/firebase-admin-ligero.js';

test('handlers reales: HTML, HEAD, 404/503, noindex y sitemaps sin URLs privadas ni fechas inventadas',async()=>{
 const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
 globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'seo-http-test',client_email:'test@seo-http-test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})}),ASSETS:{fetch:async()=>new Response(fs.readFileSync('catalogo.html','utf8'),{headers:{'content-type':'text/html; charset=utf-8'}})}};
 const document=(resource,id,data)=>({name:`projects/seo-http-test/databases/(default)/documents/${resource}/${id}`,fields:encodeFirestoreFields(data)});
 const products=Array.from({length:55},(_,i)=>document('products','p'+i,{name:'Reloj '+i,category:'relojes',price:1000,stock:i===0?0:1,...(i===1?{updatedAt:'2026-11-01T12:00:00Z'}:{})}));
 products.push(document('products','secret',{name:'Secreto',category:'oculta',price:1000,stock:1}));
 let failed=false;
 globalThis.fetch=async input=>{
  const url=String(input);
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture',expires_in:3600});
  if(failed)return Response.json({error:'temporary'},{status:503});
  if(url.includes('/documents/products?'))return Response.json({documents:products});
  if(url.includes('/documents/collections?'))return Response.json({documents:[document('collections','relojes',{name:'Relojes',visible:true}),document('collections','oculta',{name:'Oculta',visible:false})]});
  throw new Error('Petición inesperada en fixture: '+url);
 };
 const context=(path,method='GET')=>({request:new Request('https://tintinaccs.com'+path,{method}),env});
 try {
  const response=await catalogRequest(context('/catalogo?cat=relojes'));
  assert.equal(response.status,200);assert.equal(response.headers.get('x-tintin-catalog-html'),'server');
  assert.match(await response.text(),/Relojes para mujer en Paraguay/);
  const head=await catalogRequest(context('/catalogo?cat=relojes','HEAD'));assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await catalogRequest(context('/catalogo?cat=oculta'))).status,404);
  assert.equal((await catalogRequest(context('/catalogo?q=reloj'))).headers.get('x-robots-tag'),'noindex, follow');
  const sitemap=await productSitemap(context('/sitemap-products.xml'));const xml=await sitemap.text();
  assert.equal(sitemap.status,200);assert.equal((xml.match(/<url>/g)||[]).length,55);
  assert.match(xml,/product\?id=p0/);assert.doesNotMatch(xml,/secret|1970/);assert.equal((xml.match(/<lastmod>/g)||[]).length,1);
  const categories=await categorySitemap(context('/sitemap-collections.xml'));const categoryXml=await categories.text();
  assert.match(categoryXml,/cat=relojes&amp;page=2/);assert.doesNotMatch(categoryXml,/oculta/);
  failed=true;
  const unavailable=await catalogRequest(context('/catalogo'));assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('retry-after'),'60');
 } finally {globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
