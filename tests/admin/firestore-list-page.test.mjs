import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('cloudflare/firebase-admin-ligero.js','utf8');
const code=source.slice(source.indexOf('export async function firestoreAdminListPage'),source.indexOf('/** Lista una colección completa')).replaceAll('export ','');
test('paginador REST codifica cursor opaco, limita página y conserva el contrato anterior',async()=>{
 let request;
 const c=vm.createContext({URLSearchParams,parseServiceAccount:()=>({}),FIRESTORE_SCOPE:'test',getGoogleAccessToken:async()=> 'test',firestoreDocUrl:(_,path)=>'https://test.invalid/'+path,fetch:async url=>{request=new URL(url);return Response.json({documents:[{name:'private/work'}],nextPageToken:'next'});}});
 vm.runInContext(code,c);
 const result=await c.firestoreAdminListPage({},'private/items',{pageToken:'a/+= &b',pageSize:999});
 assert(!request.search.includes('+'));assert.equal(request.searchParams.get('pageToken'),'a/+= &b');assert.equal(request.searchParams.get('pageSize'),'300');assert.equal(request.searchParams.get('orderBy'),null);assert.equal(result.nextPageToken,'next');
 assert.equal((await c.firestoreAdminList({},'private/items')).length,1);
 c.fetch=async()=>new Response('',{status:404});assert.equal((await c.firestoreAdminListPage({},'private/items')).documents.length,0);
 c.fetch=async()=>new Response('offline',{status:503});await assert.rejects(c.firestoreAdminListPage({},'private/items'),/503/);
 c.fetch=async()=>Response.json({documents:{}});await assert.rejects(c.firestoreAdminListPage({},'private/items'),/inválida/);
});

test('query de identidad pagina con snapshot, cursor exclusivo y detección de página siguiente',async()=>{
 const start=source.indexOf('export async function firestoreAdminQueryByFieldPage');
 const end=source.indexOf('/**',start);
 const queryCode=source.slice(start,end).replaceAll('export ','');
 let request,reply;
 const prefix='projects/demo/databases/(default)/documents/orders/';
 const time='2026-11-02T12:00:00.123456Z';
 const c=vm.createContext({parseServiceAccount:()=>({project_id:'demo'}),FIRESTORE_SCOPE:'test',getGoogleAccessToken:async()=> 'test',firestoreDatabaseUrl:()=> 'https://test.invalid',fetch:async(_,options)=>{request=JSON.parse(options.body);return reply;}});
 vm.runInContext(queryCode,c);
 reply=Response.json([1,2,3].map(i=>({document:{name:prefix+i,fields:{}},readTime:time})));
 const first=await c.firestoreAdminQueryByFieldPage({},'orders','userId','customer',{pageSize:2});
 assert.equal(first.documents.length,2);assert.equal(first.after,prefix+'2');assert.equal(first.readTime,time);assert.equal(request.structuredQuery.limit,3);
 reply=Response.json([{document:{name:prefix+'3',fields:{}},readTime:time}]);
 const second=await c.firestoreAdminQueryByFieldPage({},'orders','userId','customer',{pageSize:2,after:first.after,readTime:first.readTime});
 assert.equal(second.after,'');assert.equal(request.readTime,time);assert.equal(request.structuredQuery.startAt.before,false);assert.equal(request.structuredQuery.startAt.values[0].referenceValue,prefix+'2');
 reply=Response.json([{readTime:time}]);assert.equal((await c.firestoreAdminQueryByFieldPage({},'orders','userId','none')).documents.length,0);
 reply=Response.json({});await assert.rejects(c.firestoreAdminQueryByFieldPage({},'orders','userId','customer'),/inválida/);
 reply=Response.json([{document:{name:prefix+'1',fields:{}}}]);await assert.rejects(c.firestoreAdminQueryByFieldPage({},'orders','userId','customer'),/snapshot/);
 reply=new Response('',{status:503});await assert.rejects(c.firestoreAdminQueryByFieldPage({},'orders','userId','customer'),/503/);
 await assert.rejects(c.firestoreAdminQueryByFieldPage({},'orders','userId','customer',{after:'projects/other/documents/orders/x'}),/Cursor/);
});
