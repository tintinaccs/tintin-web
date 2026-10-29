import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {statusFromError} from '../../cloudflare/seguridad-cloudinary.js';
const backend=fs.readFileSync('cloudflare/firebase-admin-ligero.js','utf8');
const code=backend.slice(backend.indexOf('export async function firestoreAdminCollectionGroupPage'),backend.indexOf('/** Una página del listado canónico')).replace('export ','');
test('consulta privada usa proyección, orden estable y cursor exclusivo; rechaza respuestas inválidas',async()=>{
 let query;
 const c=vm.createContext({parseServiceAccount:()=>({}),getGoogleAccessToken:async()=> 'test',FIRESTORE_SCOPE:'test',firestoreDatabaseUrl:()=> 'https://fixture.test',fetch:async(_,request)=>{query=JSON.parse(request.body).structuredQuery;return Response.json([{document:{name:'full-name',fields:{}}}]);}});
 vm.runInContext(code,c);assert.equal((await c.firestoreAdminCollectionGroupPage({},'items',{after:'previous',fieldPaths:['closed']})).length,1);
 assert.equal(query.from[0].allDescendants,true);assert.equal(query.limit,100);assert.equal(query.startAt.before,false);assert.equal(query.startAt.values[0].referenceValue,'previous');assert.equal(query.orderBy[0].field.fieldPath,'__name__');assert.equal(query.select.fields[0].fieldPath,'closed');
 for(const payload of [{},[{error:{message:'offline'}}],[{document:{fields:{}}}],null]){c.fetch=async()=>Response.json(payload);await assert.rejects(c.firestoreAdminCollectionGroupPage({},'items'),/inválida/);}
 c.fetch=async()=>new Response('',{status:503});await assert.rejects(c.firestoreAdminCollectionGroupPage({},'items'),/503/);
});
const route=fs.readFileSync('functions/api/cloudinary-delete.js','utf8').replace(new RegExp('^im' + "port [\\s\\S]*? fr" + "om '[^']+';\\n",'gm'),'').replaceAll('export ','');
test('endpoint no destruye archivos si existe uso privado o si la inspección falla',async()=>{
 for(const fail of [false,true]){
  let destroyed=0,inspected=0;
  const c=vm.createContext({URLSearchParams,statusFromError,requireSuperAdmin:async()=>{},originIsAllowed:()=>true,cleanPublicId:x=>x,getCloudinaryConfig:()=>({cloudName:'fixture'}),findProductWorkMediaUsage:async()=>{inspected++;if(fail)throw Error('offline');return ['id'];},jsonResponse:(body,status)=>({body,status}),rateLimitErrorResponse:()=>null,fetch:async()=>{destroyed++;throw Error('unexpected destroy');}});
  vm.runInContext(route,c);
  const result=await c.onRequest({request:{headers:new Headers({origin:'https://fixture.test'}),url:'https://fixture.test/api/cloudinary-delete',method:'POST',json:async()=>({publicIds:['id']})},env:{}});
  assert.equal(inspected,1);assert.equal(destroyed,0);assert.equal(result.status,fail?400:409);assert(!JSON.stringify(result).includes('owner'));
 }
});
