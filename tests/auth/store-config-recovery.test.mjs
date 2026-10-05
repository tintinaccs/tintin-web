import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../js/core/store-gate/nucleo-control-tienda.js',import.meta.url),'utf8');
const reads=source.slice(source.indexOf('export async function getStoreAccessConfigFromRest()'),source.indexOf('export function isAccessAllowed')).replace(/^export /gm,'');
function fixture({sdk=()=>new Promise(()=>{}),api=()=>new Promise(()=>{}),rest=async()=>null}={}) {
  const timers=new Map();let id=0;
  const window={setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(key){timers.delete(key);}};
  const context=vm.createContext({window,fetch:api,getDoc:sdk,STORE_GATE_REF:'current',LEGACY_GENERAL_REF:'legacy',getPublicDocumentRest:rest,rememberConfig:cfg=>cfg,normalizeStoreAccessConfig:(data,status)=>({...data,__storeConfigStatus:status}),console});
  vm.runInContext(reads+';globalThis.read=getStoreAccessConfig;globalThis.rest=getStoreAccessConfigFromRest;',context);
  return {context,window,timers,expire(ms){for(const [key,timer] of [...timers])if(timer.ms===ms){timers.delete(key);timer.fn();}}};
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('SDK y API sin respuesta terminan en configuración no confirmada, sin abrir la tienda',async()=>{
  const f=fixture();const pending=f.context.read();await flush();f.expire(3000);await flush();f.expire(10000);await flush();f.expire(2000);await flush();
  const result=await pending;assert.notEqual(result.__storeConfigStatus,'ok');assert.equal(f.timers.size,0);
});
test('una petición compartida fallida se elimina y el reintento usa una petición nueva',async()=>{
  let calls=0;const f=fixture({api:async()=>{calls++;return {ok:true,json:async()=>({ok:true,resource:'storeGate',data:{storeOpen:true}})};}});
  f.window.__TINTIN_STORE_GATE_REST_PROMISE__=Promise.reject(new Error('offline'));
  assert.equal(await f.context.rest(),null);assert.equal(f.window.__TINTIN_STORE_GATE_REST_PROMISE__,undefined);
  const cfg=await f.context.rest();assert.equal(cfg.storeOpen,true);assert.equal(calls,1);assert.equal(f.timers.size,0);
});
test('REST confirmado resuelve sin esperar un SDK detenido',async()=>{
  const f=fixture({api:async()=>({ok:true,json:async()=>({ok:true,resource:'storeGate',data:{storeOpen:false}})})});
  const cfg=await f.context.read();assert.equal(cfg.storeOpen,false);assert.equal(cfg.__storeConfigStatus,'ok');
});
