import test from 'node:test';
import assert from 'node:assert/strict';
import {instagramVideos,onRequestGet} from '../../functions/api/instagram-feed.js';
test('el feed sólo devuelve videos recientes con enlaces de Instagram y sin contenido ejecutable',()=>{
 const videos=instagramVideos({data:[
  {id:'old',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/old/',timestamp:'2026-10-19T10:00:00Z',thumbnail_url:'https://cdninstagram.com/old.jpg'},
  {id:'new',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/new/',timestamp:'2026-10-20T10:00:00Z',caption:'<script>alert(1)</script>',thumbnail_url:'https://evil.example/token.jpg'},
  {id:'image',media_type:'IMAGE',permalink:'https://www.instagram.com/p/image/'},
  {id:'bad',media_type:'VIDEO',permalink:'https://evil.example/reel/steal/'},
 ]});
 assert.deepEqual(videos.map(v=>v.id),['new','old']);assert.equal(videos[0].thumbnail,'');
 assert.equal(videos[0].caption,'<script>alert(1)</script>');
});
test('sin conectar cuenta no presenta una copia fija como feed actualizado',async()=>{
 const response=await onRequestGet({env:{}});const data=await response.json();
 assert.equal(data.available,false);assert.deepEqual(data.videos,[]);assert.equal(data.username,'tintinaccs');
});
test('la consulta usa el secreto sólo en servidor y recupera nuevos videos sin cambiar el sitio',async()=>{
 const original=globalThis.fetch;let newest='one';let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url.host,'graph.instagram.com');assert.equal(url.searchParams.has('access_token'),false);assert.equal(options.headers.Authorization,'Bearer fixture-secret');return Response.json({data:[{id:newest,media_type:'VIDEO',permalink:`https://www.instagram.com/reel/${newest}/`,timestamp:'2026-10-20T10:00:00Z'}]});};
 try{
  const env={INSTAGRAM_USER_ID:'12345678',INSTAGRAM_ACCESS_TOKEN:'fixture-secret'};
  assert.equal((await (await onRequestGet({env})).json()).videos[0].id,'one');newest='two';
  const result=await onRequestGet({env});const raw=await result.text();assert.equal(JSON.parse(raw).videos[0].id,'two');assert.ok(!raw.includes('fixture-secret'));assert.equal(calls,2);
  globalThis.fetch=async()=>new Response('private upstream error',{status:401});
  const failed=await onRequestGet({env});assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('private upstream error'));
 }finally{globalThis.fetch=original;}
});
test('las visitas comparten el feed cacheado sin repetir la consulta externa',async()=>{
 const oldFetch=globalThis.fetch,oldCache=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const entries=new Map();let requests=0;
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{async match(key){return entries.get(key.url)?.clone();},async put(key,response){entries.set(key.url,response);}}}});
 globalThis.fetch=async()=>{requests++;return Response.json({data:[{id:'fixture',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/fixture/',timestamp:'2026-10-20T10:00:00Z'}]});};
 try {
  const context={env:{INSTAGRAM_USER_ID:'12345678',INSTAGRAM_ACCESS_TOKEN:'fixture-secret'},request:new Request('https://tintin.test/api/instagram-feed')};
  await onRequestGet(context);await onRequestGet(context);assert.equal(requests,1);
  entries.clear();await onRequestGet(context);assert.equal(requests,2);
 }finally{globalThis.fetch=oldFetch;if(oldCache)Object.defineProperty(globalThis,'caches',oldCache);else delete globalThis.caches;}
});
