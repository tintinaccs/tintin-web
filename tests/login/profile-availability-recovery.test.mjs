import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';
const html=fs.readFileSync(new URL('../../login.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('  const phoneAvailability ='),html.indexOf('  const showDuplicatePhone ='));
function fixture({token=async()=> 'isolated',fetch=async()=>({ok:true,json:async()=>({available:true,valid:true})})}={}) {
  const timers=[];
  const context=vm.createContext({AbortController,user:{getIdToken:token},countrySelect:{value:'PY'},fetch,AUTH_NETWORK_DEADLINE_MS:15000,
    withDeadline:(promise,ms)=>withDeadline(promise,ms,{set(fn){const t={fn};timers.push(t);return t;},clear(t){t.cleared=true;}})});
  vm.runInContext(source+'\nglobalThis.check=phoneAvailability;',context);
  return {check:context.check,timers};
}
for(const body of [{},null,{available:'false'},{available:false,valid:false}]) test(`respuesta no válida ${JSON.stringify(body)} no anuncia teléfono ocupado`,async()=>{
  const f=fixture({fetch:async()=>({ok:true,json:async()=>body})});assert.equal(await f.check('0912345678'),false);
});
test('un duplicado confirmado usa el teléfono y país correctos',async()=>{
  let payload,endpoint;const f=fixture({fetch:async(url,options)=>{endpoint=url;payload=JSON.parse(options.body);return {ok:true,json:async()=>({available:false,valid:true})};}});
  assert.equal(await f.check('0912345678'),true);assert.equal(endpoint,'/api/phone-availability');assert.deepEqual(payload,{phone:'0912345678',country:'PY'});
});
for(const stage of ['token','request','body']) test(`consulta colgada en ${stage} no bloquea el guardado protegido por reglas`,async()=>{
  let signal;const never=()=>new Promise(()=>{});
  const f=fixture({token:stage==='token'?never:undefined,fetch:async(_url,options)=>{signal=options.signal;return stage==='request'?never():{ok:true,json:never};}});
  const pending=f.check('0912345678');await new Promise(resolve=>setImmediate(resolve));f.timers[0].fn();
  assert.equal(await pending,false);if(signal)assert.equal(signal.aborted,true);
});
