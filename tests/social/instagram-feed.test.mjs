import test from 'node:test';
import assert from 'node:assert/strict';
import {instagramPosts,onRequestGet} from '../../functions/api/instagram-feed.js';
const CDN='https://scontent-gru1-1.cdninstagram.com/v/t51.2885-15/';
test('el feed devuelve fotos, carruseles y videos recientes con enlaces de Instagram y sin contenido ejecutable',()=>{
 const posts=instagramPosts({data:[
  {id:'old-video',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/old/',timestamp:'2026-10-19T10:00:00Z',thumbnail_url:'https://cdninstagram.com/old.jpg',media_url:CDN+'old.mp4'},
  {id:'photo',media_type:'IMAGE',permalink:'https://www.instagram.com/p/photo/',timestamp:'2026-10-22T10:00:00Z',caption:'Nueva colección',media_url:CDN+'photo.jpg',thumbnail_url:CDN+'ignored.jpg'},
  {id:'carousel',media_type:'CAROUSEL_ALBUM',permalink:'https://www.instagram.com/p/carousel/',timestamp:'2026-10-21T10:00:00Z',media_url:CDN+'carousel.jpg'},
  {id:'new-video',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/new/',timestamp:'2026-10-20T10:00:00Z',caption:'<script>alert(1)</script>',thumbnail_url:'https://evil.example/token.jpg'},
  {id:'bad',media_type:'VIDEO',permalink:'https://evil.example/reel/steal/'},
  {id:'unknown',media_type:'STORY',permalink:'https://www.instagram.com/p/unknown/'},
 ]});
 assert.deepEqual(posts.map(post=>post.id),['photo','carousel','new-video','old-video']);
 assert.deepEqual(posts.map(post=>post.type),['image','carousel','video','video']);
 // Photos and carousels use media_url; videos use thumbnail_url and never their video file.
 assert.equal(posts[0].thumbnail,CDN+'photo.jpg');assert.equal(posts[1].thumbnail,CDN+'carousel.jpg');
 assert.equal(posts[2].thumbnail,'');assert.equal(posts[3].thumbnail,'https://cdninstagram.com/old.jpg');
 assert.equal(posts[0].caption,'Nueva colección');assert.equal(posts[2].caption,'<script>alert(1)</script>');
 assert.deepEqual(posts.map(post=>post.url),['https://www.instagram.com/p/photo/','https://www.instagram.com/p/carousel/','https://www.instagram.com/reel/new/','https://www.instagram.com/reel/old/']);
 assert.equal(posts[0].publishedAt,'2026-10-22T10:00:00.000Z');
});
test('las publicaciones sin descripción usan un texto propio de su tipo',()=>{
 const posts=instagramPosts({data:[
  {id:'a',media_type:'IMAGE',permalink:'https://www.instagram.com/p/a/',timestamp:'2026-10-22T10:00:00Z'},
  {id:'b',media_type:'CAROUSEL_ALBUM',permalink:'https://www.instagram.com/p/b/',timestamp:'2026-10-21T10:00:00Z'},
  {id:'c',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/c/',timestamp:'2026-10-20T10:00:00Z'},
 ]});
 assert.deepEqual(posts.map(post=>post.caption),['Foto de @tintinaccs','Carrusel de @tintinaccs','Video de @tintinaccs']);
});
test('las miniaturas sólo aceptan imágenes https del CDN de Instagram',()=>{
 const thumb=(media_url,media_type='IMAGE')=>instagramPosts({data:[{id:'x',media_type,permalink:'https://www.instagram.com/p/x/',media_url}]})[0].thumbnail;
 assert.equal(thumb(CDN+'ok.jpg'),CDN+'ok.jpg');
 assert.equal(thumb('https://scontent.fbcdn.net/ok.jpg'),'https://scontent.fbcdn.net/ok.jpg');
 assert.equal(thumb('http://scontent.cdninstagram.com/insecure.jpg'),'');
 assert.equal(thumb('https://evil.example/cdninstagram.com/x.jpg'),'');
 assert.equal(thumb('https://cdninstagram.com.evil.example/x.jpg'),'');
 assert.equal(thumb('javascript:alert(1)'),'');
 assert.equal(thumb(undefined),'');
 // A carousel whose first piece is a video exposes a video file as media_url: not an image.
 assert.equal(thumb(CDN+'first-piece.mp4','CAROUSEL_ALBUM'),'');
});
test('el feed ordena por fecha, ignora datos inválidos y devuelve como máximo 12 publicaciones',()=>{
 const data={data:[null,{},{id:'no-date',media_type:'IMAGE',permalink:'https://www.instagram.com/p/nodate/'},
  ...Array.from({length:15},(_,index)=>({id:'p'+index,media_type:'IMAGE',permalink:`https://www.instagram.com/p/p${index}/`,timestamp:new Date(Date.UTC(2026,9,1+index)).toISOString()}))]};
 const posts=instagramPosts(data);
 assert.equal(posts.length,12);assert.equal(posts[0].id,'p14');assert.equal(posts[11].id,'p3');
 assert.ok(!posts.some(post=>post.id==='no-date'));
 assert.deepEqual(instagramPosts(undefined),[]);assert.deepEqual(instagramPosts({data:'x'}),[]);
 // Without a valid date a post is kept but sorted last.
 const undated=instagramPosts({data:[data.data[2],data.data[3]]});assert.deepEqual(undated.map(post=>post.id),['p0','no-date']);
});
test('sin conectar cuenta no presenta una copia fija como feed actualizado',async()=>{
 const response=await onRequestGet({env:{}});const data=await response.json();
 assert.equal(data.available,false);assert.deepEqual(data.posts,[]);assert.equal(data.username,'tintinaccs');
});
test('la consulta usa el secreto sólo en servidor, pide fotos, carruseles y videos, y recupera nuevas publicaciones sin cambiar el sitio',async()=>{
 const original=globalThis.fetch,originalWarn=console.warn;let newest='one';let calls=0;const logs=[];
 console.warn=(...args)=>{logs.push(args.map(String).join(' '));};
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url.host,'graph.facebook.com');assert.ok(url.pathname.startsWith('/v27.0/12345678/media'));assert.equal(url.searchParams.has('access_token'),false);assert.equal(options.headers.Authorization,'Bearer fixture-secret');
  assert.deepEqual(url.searchParams.get('fields').split(','),['id','caption','media_type','media_url','thumbnail_url','permalink','timestamp']);assert.equal(url.searchParams.get('limit'),'24');
  return Response.json({data:[{id:newest,media_type:'IMAGE',permalink:`https://www.instagram.com/p/${newest}/`,timestamp:'2026-10-20T10:00:00Z',media_url:CDN+newest+'.jpg'}]});};
 try{
  const env={INSTAGRAM_USER_ID:'12345678',INSTAGRAM_ACCESS_TOKEN:'fixture-secret'};
  const first=await (await onRequestGet({env})).json();assert.equal(first.available,true);assert.equal(first.posts[0].id,'one');assert.equal(first.posts[0].type,'image');assert.equal('videos' in first,false);newest='two';
  const result=await onRequestGet({env});const raw=await result.text();assert.equal(JSON.parse(raw).posts[0].id,'two');assert.ok(!raw.includes('fixture-secret'));assert.equal(calls,2);
  globalThis.fetch=async()=>new Response('private upstream error fixture-secret',{status:401});
  const failed=await onRequestGet({env});assert.equal(failed.status,503);const failedText=await failed.text();assert.ok(!failedText.includes('private upstream error')&&!failedText.includes('fixture-secret'));assert.deepEqual(JSON.parse(failedText).posts,[]);
  // The failure is diagnosable from the logs (status only) and the logs never carry the token or Instagram's body.
  assert.equal(logs.length,1);assert.ok(logs[0].includes('401'));assert.ok(!logs[0].includes('fixture-secret')&&!logs[0].includes('private upstream error'));
  globalThis.fetch=async()=>{throw Object.assign(new Error('boom fixture-secret'),{name:'TimeoutError'});};
  const timedOut=await onRequestGet({env});assert.equal(timedOut.status,503);assert.ok(!(await timedOut.text()).includes('fixture-secret'));
  assert.equal(logs.length,2);assert.ok(logs[1].includes('TimeoutError'));assert.ok(!logs.join(' ').includes('fixture-secret'));
 }finally{globalThis.fetch=original;console.warn=originalWarn;}
});
test('las visitas comparten el feed cacheado sin repetir la consulta externa',async()=>{
 const oldFetch=globalThis.fetch,oldCache=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const entries=new Map();let requests=0;
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{async match(key){return entries.get(key.url)?.clone();},async put(key,response){entries.set(key.url,response);}}}});
 globalThis.fetch=async()=>{requests++;return Response.json({data:[{id:'fixture',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/fixture/',timestamp:'2026-10-20T10:00:00Z'}]});};
 try {
  const context={env:{INSTAGRAM_USER_ID:'12345678',INSTAGRAM_ACCESS_TOKEN:'fixture-secret'},request:new Request('https://tintin.test/api/instagram-feed')};
  await onRequestGet(context);await onRequestGet(context);assert.equal(requests,1);
  // The cache key is versioned so a response saved with the previous shape ("videos") is never served.
  assert.ok([...entries.keys()].every(key=>key.includes('/__instagram-feed-cache/v2/')));
  entries.clear();await onRequestGet(context);assert.equal(requests,2);
 }finally{globalThis.fetch=oldFetch;if(oldCache)Object.defineProperty(globalThis,'caches',oldCache);else delete globalThis.caches;}
});
