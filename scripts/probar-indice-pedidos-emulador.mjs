import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {createMockUserToken} from '@firebase/util';
import {doc,setDoc,writeBatch} from 'firebase/firestore';
const host=process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host||'',/^(127\.0\.0\.1|localhost):\d+$/,'Sólo emulador; nunca producción');
const project='demo-tintin-critical';
const [address,port]=host.split(':');
const env=await initializeTestEnvironment({projectId:project,firestore:{host:address,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
const prefix=`projects/${project}/databases/(default)/documents/`;
const root=`http://${host}/v1/${prefix.slice(0,-1)}`;
const moduleSource=fs.readFileSync('js/pages/profile/indice-pedidos-perfil.js','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
const transportSource=fs.readFileSync('js/core/firebase/respaldo-rest-firestore.js','utf8').replaceAll('export ','');
function runtime(actor) {
 const idToken=createMockUserToken({sub:actor.uid,email:actor.email,email_verified:actor.emailVerified,iat:Math.floor(Date.now()/1000)},project);
 const context={console,AbortController,URLSearchParams,window:{setTimeout,clearTimeout},appCheck:{},getToken:async()=>({token:'emulator-only-app-check'}),fetch:(url,options)=>fetch(root+':runQuery',options)};
 vm.createContext(context);vm.runInContext(transportSource+'\n'+moduleSource,context);
 return {page:args=>context.readAccountOrdersIndexPage({user:{...actor,getIdToken:async()=>idToken},...args}),query:()=>context.accountOrdersIndexQuery(actor),token:idToken};
}
test('REST oficial: Rules, proyección, UID/correos, fechas legacy, cursor y snapshot consistente',async()=>{
 try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore(),batch=writeBatch(db);
   batch.set(doc(db,'settings','storeGate'),{storeOpen:true});
   batch.set(doc(db,'users','index-owner'),{email:'Owner@example.test',role:'client',blocked:false});
   batch.set(doc(db,'users','index-other'),{email:'other@example.test',role:'client',blocked:false});
   batch.set(doc(db,'users','index-unverified'),{email:'owner@example.test',role:'client',blocked:false});
   for(let i=0;i<105;i++)batch.set(doc(db,'orders','index-'+String(i).padStart(3,'0')),{
    ...(i%3===0?{userEmail:'Owner@example.test'}:i%3===1?{userEmail:'owner@example.test'}:{userId:'index-owner',userEmail:'owner@example.test'}),
    ...(i===104?{updatedAt:new Date('2026-10-29T00:00:00Z')}:{createdAt:new Date('2026-10-01T00:00:00Z')}),
    total:100,status:'pendiente',items:[{name:'Detalle privado que no debe estar en el índice'}],invoice:{ruc:'privado'},shipping:{address:'Privada'},payment:{status:'pagado',reference:'privado'},
   });
   batch.set(doc(db,'orders','index-secret'),{userId:'index-other',userEmail:'other@example.test',total:999999,createdAt:new Date()});
   await batch.commit();
  });
  const actor={uid:'index-owner',email:'Owner@example.test',emailVerified:true};const client=runtime(actor);
  const first=await client.page({});assert.equal(first.items.length,100);assert.ok(first.cursor);assert.ok(first.readTime);
  assert.ok(first.items.every(row=>!('items' in row)&&!('shipping' in row)&&!('invoice' in row)&&!('userEmail' in row)&&!row.payment?.reference));
  await env.withSecurityRulesDisabled(async c=>{
    await setDoc(doc(c.firestore(),'orders','index-104'),{total:7000},{merge:true});
    await setDoc(doc(c.firestore(),'orders','index-106'),{userId:'index-owner',total:8000,createdAt:new Date()});
  });
  const second=await client.page({cursor:first.cursor,readTime:first.readTime});
  assert.equal(second.items.length,5);assert.equal(second.cursor,'');assert.equal(second.readTime,first.readTime);assert.equal(second.items.find(row=>row.id==='index-104').total,100);
  const ids=[...first.items,...second.items].map(row=>row.id);assert.equal(new Set(ids).size,105);assert.ok(!ids.includes('index-secret'));assert.ok(second.items.some(row=>row.id==='index-104'&&row.updatedAt&&!row.createdAt));
  // Sin correo verificado no se heredan registros por email.
  const unverified=runtime({uid:'index-unverified',email:'owner@example.test',emailVerified:false});
  assert.equal((await unverified.page({})).items.length,0);
  // Forzar el mismo OR por correo con un JWT no verificado sigue denegado.
  const forbidden=await fetch(root+':runQuery',{method:'POST',headers:{authorization:'Bearer '+unverified.token,'content-type':'application/json'},body:JSON.stringify({structuredQuery:client.query()})});
  assert.equal(forbidden.status,403);
  // El cierre y bloqueo siguen siendo autoridad de Rules.
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','index-owner'),{blocked:true},{merge:true}));
  await assert.rejects(()=>client.page({}),error=>error.code==='permission-denied');
 } finally {await env.cleanup();}
});
