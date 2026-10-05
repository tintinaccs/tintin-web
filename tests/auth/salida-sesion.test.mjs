import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withDeadline } from '../../js/core/auth/estado-perfil-sesion.mjs';

function fixture() {
  const calls={out:0,mark:0,clear:0,timers:[]};
  let resolve,reject;const operation=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
  const context=vm.createContext({auth:{currentUser:{uid:'fixture'}},signOut:()=>{calls.out++;return operation;},
    markExplicitLogout:()=>calls.mark++,clearAuthHandoff:()=>calls.clear++,
    withDeadline:(promise,ms)=>withDeadline(promise,ms,{set(fn){calls.timers.push(fn);return fn;},clear(){}})});
  const code=fs.readFileSync(new URL('../../js/core/auth/salida-sesion.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export function','function');
  vm.runInContext(code+';this.exit=logoutSession;',context);
  return {calls,context,resolve,reject};
}
test('cierre compartido: varios botones ejecutan un signOut y limpian handoff sólo al confirmar',async()=>{
  const f=fixture();const a=f.context.exit(),b=f.context.exit();assert.equal(a,b);
  await Promise.resolve();assert.equal(f.calls.out,1);assert.equal(f.calls.mark,1);assert.equal(f.calls.clear,0);
  f.resolve();await a;assert.equal(f.calls.clear,1);
});
test('fallo real se propaga y permite reintentar sin fingir una salida',async()=>{
  const f=fixture();const a=f.context.exit();f.reject({code:'auth/network-request-failed'});
  await assert.rejects(a,e=>e.code==='auth/network-request-failed');assert.equal(f.calls.clear,0);
  await assert.rejects(f.context.exit());assert.equal(f.calls.out,2);
});
test('signOut pendiente devuelve control por timeout y conserva la identidad',async()=>{
  const f=fixture();const a=f.context.exit();f.calls.timers[0]();
  await assert.rejects(a,e=>e.code==='auth/logout-timeout');
  assert.equal(f.context.auth.currentUser.uid,'fixture');assert.equal(f.calls.clear,0);
});
