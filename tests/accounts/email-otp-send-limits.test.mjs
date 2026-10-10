import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceIpRateLimit, reserveOtpSendLimit, handleEmailOtpSend } from '../../functions/api/email-otp-send.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 1));
function rateStore() {
  const docs = new Map();
  let version = 0;
  const deps = {
    get: async (_env, path) => { await pause(); const doc=docs.get(path); return doc ? structuredClone(doc) : null; },
    replace: async (_env, path, fields) => { await pause(); docs.set(path,{fields,updateTime:String(++version)}); },
    commit: async (_env, writes) => {
      await pause();
      for (const write of writes) {
        const current=docs.get(write.path),precondition=write.currentDocument;
        if (precondition?.exists===false && current || precondition?.updateTime && current?.updateTime!==precondition.updateTime)
          throw Object.assign(new Error('conflict'),{status:409,code:'version_conflict'});
      }
      for (const write of writes) docs.set(write.path,{fields:write.fields,updateTime:String(++version)});
    },
  };
  return {docs,deps,put:(path,data)=>docs.set(path,{fields:encodeFirestoreFields(data),updateTime:String(++version)}),read:path=>decodeFirestoreFields(docs.get(path)?.fields||{})};
}

test('200 envíos concurrentes desde la misma IP no saltan el cooldown ni pierden el contador',async()=>{
  const store=rateStore(),now=Date.now();
  const request=new Request('https://tintin.test/api/email-otp-send',{headers:{'CF-Connecting-IP':'203.0.113.8'}});
  const results=await Promise.allSettled(Array.from({length:200},()=>enforceIpRateLimit(request,{},now,store.deps)));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.ok(results.filter(result=>result.status==='rejected').every(result=>result.reason.message==='ip_rate_limit'));
  assert.equal(store.docs.size,1);
  assert.equal(store.read([...store.docs.keys()][0]).sendCountToday,1);
});

async function sendCode(store, email='client@example.com', ip='203.0.113.8', changes={}) {
  const request=new Request('https://tintin.test/api/email-otp-send',{
    method:'POST',headers:{origin:'https://tintin.test','CF-Connecting-IP':ip,'content-type':'application/json'},body:JSON.stringify({email}),
  });
  const response=await handleEmailOtpSend({request,env:{RESEND_API_KEY:'isolated-test-provider'}},{
    ...store.deps,send:async()=>{store.sent=(store.sent||0)+1;return 'isolated-email';},status:async()=> 'delivered',pause:async()=>{},...changes,
  });
  return {status:response.status,...await response.json()};
}

test('200 solicitudes del mismo correo desde diferentes IPs sólo envían un OTP',async()=>{
  const store=rateStore();
  const results=await Promise.all(Array.from({length:200},(_,i)=>sendCode(store,'client@example.com',`198.51.100.${i+1}`)));
  assert.equal(results.filter(result=>result.status===200).length,1);
  assert.equal(store.sent,1);
  assert.ok(results.every(result=>result.status===200 || result.status===429));
});

test('consumir el código no reinicia el límite persistente de ocho envíos diarios',async t=>{
  const store=rateStore();let now=Date.now();t.mock.method(Date,'now',()=>now);
  for(let i=0;i<8;i++) {
    const result=await sendCode(store,'client@example.com',`203.0.113.${i+1}`);
    assert.equal(result.status,200);
    store.docs.delete('emailOtpCodes/client%40example.com');now+=46_000;
  }
  const denied=await sendCode(store,'client@example.com','203.0.113.100');
  assert.equal(denied.status,429);assert.equal(denied.error,'daily_limit_exceeded');assert.equal(store.sent,8);
});

test('la primera reserva conserva el cooldown y contador del código anterior',async()=>{
  const store=rateStore(),now=Date.now();
  const legacy={fields:encodeFirestoreFields({dateKey:new Date(now).toISOString().slice(0,10),lastSentAt:new Date(now-1000),sendCountToday:7})};
  await assert.rejects(reserveOtpSendLimit({}, {path:'emailOtpRateLimits/email_legacy',now,cooldownMs:45_000,dailyMaximum:8,legacyDocument:legacy},store.deps),error=>error.code==='cooldown_active');
  const reserved=await reserveOtpSendLimit({}, {path:'emailOtpRateLimits/email_legacy',now:now+46_000,cooldownMs:45_000,dailyMaximum:8,legacyDocument:legacy},store.deps);
  assert.equal(reserved.sendCountToday,8);
});

test('un día nuevo renueva la cuota conservando el cooldown vigente',async()=>{
  const store=rateStore(),now=Date.UTC(2026,9,10,12);
  store.put('emailOtpRateLimits/email_next_day',{dateKey:'2026-10-09',lastSentAt:new Date(now-86_400_000),sendCountToday:8});
  const result=await reserveOtpSendLimit({}, {path:'emailOtpRateLimits/email_next_day',now,cooldownMs:45_000,dailyMaximum:8},store.deps);
  assert.equal(result.sendCountToday,1);assert.equal(result.dateKey,'2026-10-10');
});

test('un documento sin versión o una caída de Firestore no habilitan el envío',async()=>{
  const options={path:'emailOtpRateLimits/email_failure',now:Date.now(),cooldownMs:45_000,dailyMaximum:8};
  await assert.rejects(reserveOtpSendLimit({},options,{get:async()=>({fields:{}}),commit:async()=>assert.fail('sin versión no se debe escribir')}),/rate_version_missing/);
  await assert.rejects(reserveOtpSendLimit({},options,{get:async()=>null,commit:async()=>{throw new Error('firestore-unavailable');}}),/firestore-unavailable/);
});

test('un fallo del proveedor conserva el OTP previo y retiene la reserva contra abuso',async t=>{
  t.mock.method(console,'error',()=>{});
  const store=rateStore(),path='emailOtpCodes/client%40example.com';
  store.put(path,{codeHash:'previous-valid-verifier',expiresAt:new Date(Date.now()+60_000)});
  const failed=await sendCode(store,'client@example.com','203.0.113.1',{send:async()=>{throw new Error('isolated-provider-failure');}});
  assert.equal(failed.status,502);assert.equal(store.read(path).codeHash,'previous-valid-verifier');
  const retry=await sendCode(store,'client@example.com','203.0.113.2');
  assert.equal(retry.status,429);assert.equal(retry.error,'cooldown_active');assert.equal(store.sent||0,0);
});
