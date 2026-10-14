import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForGooglePopup } from '../../js/core/auth/espera-popup-google.mjs';

function fixture() {
  const popup={closed:false};
  const callbacks={};
  const host={open:()=>popup,setInterval:fn=>(callbacks.poll=fn,1),setTimeout:fn=>(callbacks.expire=fn,2),clearInterval:()=>callbacks.cleared=true,clearTimeout:()=>callbacks.deadlineCleared=true};
  return {host,popup,callbacks};
}
test('cerrar la ventana libera el intento aunque Firebase no resuelva',async()=>{
  const f=fixture(), original=f.host.open;
  const pending=waitForGooglePopup(()=>{f.host.open('/__/auth/handler');return new Promise(()=>{});},f.host);
  f.popup.closed=true;f.callbacks.poll();
  await assert.rejects(pending,{code:'auth/popup-closed-by-user'});
  assert.equal(f.host.open,original);assert.equal(f.callbacks.cleared,true);assert.equal(f.callbacks.deadlineCleared,true);
});
test('éxito y rechazo del SDK conservan su resultado y limpian la observación',async()=>{
  const f=fixture(),result={user:{uid:'test'}};
  assert.equal(await waitForGooglePopup(()=>Promise.resolve(result),f.host),result);
  await assert.rejects(waitForGooglePopup(()=>Promise.reject({code:'auth/popup-blocked'}),f.host),{code:'auth/popup-blocked'});
});
test('ventana aislada no se confunde con cancelación y vence con error recuperable',async()=>{
  const f=fixture();Object.defineProperty(f.popup,'closed',{get(){throw new Error('isolated');}});
  const pending=waitForGooglePopup(()=>{f.host.open('');return new Promise(()=>{});},f.host);
  assert.doesNotThrow(()=>f.callbacks.poll());f.callbacks.expire();
  await assert.rejects(pending,{code:'auth/popup-timeout'});
});
