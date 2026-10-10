import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceIpRateLimit, reserveOtpSendLimit } from '../functions/api/email-otp-send.js';
const host=process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host||'',/^(127\.0\.0\.1|localhost):\d+$/);
const project='demo-tintin-otp-limits';
const root=`http://${host}/v1/projects/${project}/databases/(default)/documents`;
const headers={authorization:'Bearer owner','content-type':'application/json'};
const deps={
 get:async(_env,path)=>{
  const response=await fetch(root+'/'+path,{headers});if(response.status===404)return null;
  assert.equal(response.status,200);return response.json();
 },
 commit:async(_env,writes)=>{
  const response=await fetch(root+':commit',{method:'POST',headers,body:JSON.stringify({writes:writes.map(write=>({update:{name:`projects/${project}/databases/(default)/documents/${write.path}`,fields:write.fields},currentDocument:write.currentDocument}))})});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error?.message||'commit failed'),{status:response.status,code:body.error?.status==='FAILED_PRECONDITION'?'version_conflict':'emulator_failure'});
  return body;
 }
};
test('Firestore real del emulador permite una sola reserva entre 100 solicitudes concurrentes',async()=>{
 const now=Date.now();
 const request=new Request('https://tintin.test/api/email-otp-send',{headers:{'CF-Connecting-IP':'203.0.113.8'}});
 const results=await Promise.allSettled(Array.from({length:100},()=>enforceIpRateLimit(request,{OTP_RATE_SALT:'isolated-emulator'},now,deps)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.ok(results.filter(result=>result.status==='rejected').every(result=>result.reason.message==='ip_rate_limit'));
});
test('Firestore conserva la cuota diaria después de consumir el código y rechaza el noveno envío',async()=>{
 const now=Date.now();const path='emailOtpRateLimits/email_isolated';
 for(let index=0;index<8;index++){
  const result=await reserveOtpSendLimit({}, {path,now:now+index*46000,cooldownMs:45000,dailyMaximum:8},deps);
  assert.equal(result.sendCountToday,index+1);
 }
 await assert.rejects(reserveOtpSendLimit({}, {path,now:now+8*46000,cooldownMs:45000,dailyMaximum:8},deps),error=>error.code==='daily_limit_exceeded');
});
