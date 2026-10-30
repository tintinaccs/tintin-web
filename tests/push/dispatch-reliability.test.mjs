import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sendToDevices, dispatchOrderPushEvent, retryOrderPushEvent, recordPushFailure } from '../../cloudflare/servicio-push.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { TINTIN_PUSH_ENABLED: 'true', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'fixture', client_email: 'fixture@example.test', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };
const eventId = 'order.created:fixture_order';
const content = { title: 'Pedido', body: 'Nuevo pedido', data: {eventId} };
function fixture({ event, failQuery = false, failClose = false, send } = {}) {
  let stored = event;
  let sent = 0;
  let revision = '2026-10-30T10:00:00.000Z';
  const revisions = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'oauth2.googleapis.com') return Response.json({access_token:'fixture-token', expires_in:3600});
    if (u.hostname === 'fcm.googleapis.com') { sent++; return send ? send(JSON.parse(init.body).message.token, init.signal) : Response.json({name:'sent'}); }
    if (u.pathname.endsWith(':runQuery')) {
      if (failQuery) throw new Error('fixture query unavailable');
      return Response.json([{document:{name:'devices/one',fields:encodeFirestoreFields({token:'fixture-device-token-long-enough',enabled:true})}}]);
    }
    if (u.pathname.endsWith(':commit')) {
      if (stored) return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});
      stored = decodeFirestoreFields(JSON.parse(init.body).writes[0].update.fields);
      return Response.json({writeResults:[{}]});
    }
    if (u.pathname.includes('/pushEvents/')) {
      if (init.method === 'PATCH') {
        const condition = u.searchParams.get('currentDocument.updateTime');
        revisions.push(condition);
        if (condition && condition !== revision) return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});
        if (failClose && JSON.parse(init.body).fields.status?.stringValue === 'sent') { failClose=false; return Response.json({error:{}},{status:503}); }
        revision = new Date(Date.parse(revision)+1).toISOString();
        stored = {...stored,...decodeFirestoreFields(JSON.parse(init.body).fields)};
      }
      return stored ? Response.json({fields:encodeFirestoreFields(stored),updateTime:revision}) : new Response('',{status:404});
    }
    if (u.pathname.includes('/orders/')) return Response.json({fields:encodeFirestoreFields({shortId:'TINPED30',total:1000})});
    if (u.pathname.endsWith('/pushSettings/global')) return new Response('',{status:404});
    throw new Error(`Unexpected fixture URL ${u.pathname}`);
  };
  return {fetch, get event(){return stored;},get sent(){return sent;},revisions};
}
async function using(store, fn) { const old = globalThis.fetch; globalThis.fetch = store.fetch; try { await fn(); } finally { globalThis.fetch = old; } }
test('un dispositivo lento no retrasa los demás y la concurrencia permanece acotada', async () => {
  let release; const gate = new Promise(resolve => {release=resolve;}); let active=0,max=0; const received=[];
  const store=fixture({send:async token=>{active++;max=Math.max(max,active);if(token==='slow')await gate;received.push(token);active--;return Response.json({name:'sent'});}});
  await using(store,async()=>{
    const task=sendToDevices(env,Array.from({length:9},(_,i)=>({id:String(i),token:i?String(i):'slow'})),content);
    try { await new Promise(resolve=>setTimeout(resolve,100));assert.equal(received.length,8);assert.ok(max<=6); }
    finally { release(); }
    assert.deepEqual(await task,{attempted:9,successCount:9,failureCount:0,disabledCount:0,lastError:''});
  });
});
test('un transporte colgado se cancela y se cuenta como fallo sin perder los éxitos',{timeout:1500},async()=>{
  const original=AbortSignal.timeout;let timeout;
  // Node22 no mantiene el loop vivo por AbortSignal.timeout. El fetch ficticio
  // tampoco tiene un socket: mantener una referencia sólo durante este caso,
  // para comprobar el aborto nativo en vez de cancelar toda la suite.
  const keepAlive=setTimeout(()=>{},2000);
  AbortSignal.timeout=ms=>{timeout=ms;return original(20);};
  const store=fixture({send:(token,signal)=>token==='slow'?new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}):Response.json({name:'sent'})});
  try { await using(store,async()=>{const result=await sendToDevices(env,[{token:'slow'},{token:'fast'}],content);assert.equal(result.successCount,1);assert.equal(result.failureCount,1);assert.equal(timeout,8000);}); }
  finally {clearTimeout(keepAlive);AbortSignal.timeout=original;}
});
test('un fallo al leer dispositivos cierra el evento en failed, con diagnóstico',async()=>{
 const store=fixture({failQuery:true});await using(store,async()=>{await assert.rejects(dispatchOrderPushEvent(env,'order.created','fixture_order',eventId));assert.equal(store.event.status,'failed');assert.match(store.event.lastError,/fixture query unavailable/);});
});
test('recuperar processing vencido conserva eventId y usa precondición de revisión',async()=>{
 const store=fixture({event:{eventId,type:'order.created',orderId:'fixture_order',status:'processing',attempts:1,updatedAt:'2020-01-01T00:00:00Z',successCount:0}});
 await using(store,async()=>{const result=await retryOrderPushEvent(env,eventId);assert.equal(result.status,'sent');assert.equal(store.sent,1);assert.equal(store.event.eventId,eventId);assert.ok(store.revisions[0]);assert.equal((await retryOrderPushEvent(env,eventId)).duplicate,true);assert.equal(store.sent,1);});
});
test('processing reciente, parcial y agotado no generan envíos duplicados',async()=>{
 for(const [status,successCount,attempts,updatedAt] of [['processing',0,1,new Date().toISOString()],['partial',1,1,'2020-01-01'],['failed',0,5,'2020-01-01']]){
  const store=fixture({event:{eventId,type:'order.created',orderId:'fixture_order',status,successCount,attempts,updatedAt}});
  await using(store,async()=>{await retryOrderPushEvent(env,eventId);assert.equal(store.sent,0);});
 }
});
test('recuperación rechaza eventos ajenos y un registro tardío no pisa sent',async()=>{
 const store=fixture({event:{eventId,type:'session.login',orderId:'fixture_order',status:'sent',successCount:9}});
 await using(store,async()=>{await assert.rejects(retryOrderPushEvent(env,eventId),/inválido/);await recordPushFailure(env,{eventId,type:'order.created',error:new Error('late')});assert.equal(store.event.status,'sent');});
});
test('el checkout inicia push antes de encolar correo y sincronizar Sheets, sin descartar errores',()=>{
 const source=readFileSync('functions/api/apps-script-bridge.js','utf8');const branch=source.slice(source.indexOf('if (!created.duplicate)'));
 assert.ok(branch.indexOf('const push = dispatchOrderPushEvent')<branch.indexOf('await queuePendingOrderEmail'));
 assert.ok(branch.indexOf('const push = dispatchOrderPushEvent')<branch.indexOf('syncOrderToSheetsBestEffort'));
 assert.match(branch,/else await push/);assert.match(branch,/await recordPushFailure/);
});

test('dos recuperaciones concurrentes sólo pueden reclamar un envío',async()=>{
 const store=fixture({event:{eventId,type:'order.created',orderId:'fixture_order',status:'failed',attempts:1,updatedAt:'2020-01-01',successCount:0}});
 await using(store,async()=>{
  const results=await Promise.allSettled([retryOrderPushEvent(env,eventId),retryOrderPushEvent(env,eventId)]);
  assert.ok(results.some(result=>result.status==='fulfilled'));
  assert.equal(store.sent,1);
 });
});
test('un fallo de cierre no convierte entregas aceptadas en cero al registrar el error',async()=>{
 const store=fixture({failClose:true});
 await using(store,async()=>{
  await assert.rejects(dispatchOrderPushEvent(env,'order.created','fixture_order',eventId));
  assert.equal(store.sent,1);assert.equal(store.event.status,'sent');assert.equal(store.event.successCount,1);
  assert.equal((await retryOrderPushEvent(env,eventId)).duplicate,true);assert.equal(store.sent,1);
 });
});
test('libera las respuestas de reserva y FCM para no agotar conexiones del worker',async()=>{
 const store=fixture();const fetch=store.fetch;let released=0;
 store.fetch=async(url,init)=>{
  const response=await fetch(url,init);
  if(response.ok&&(String(url).endsWith(':commit')||new URL(url).hostname==='fcm.googleapis.com')){
   return new Response(new ReadableStream({cancel(){released++;}}));
  }
  return response;
 };
 await using(store,async()=>{assert.equal((await dispatchOrderPushEvent(env,'order.created','fixture_order',eventId)).status,'sent');assert.equal(released,2);});
});
