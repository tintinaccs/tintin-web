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
