import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForGooglePopup } from '../../js/core/auth/espera-popup-google.mjs';

function fixture() {
  const popup={closed:false};
  const callbacks={};
  const host={open:()=>popup,setInterval:fn=>(callbacks.poll=fn,1),setTimeout:fn=>(callbacks.expire=fn,2),clearInterval:()=>callbacks.cleared=true,clearTimeout:()=>callbacks.deadlineCleared=true};
  return {host,popup,callbacks};
}
test('una referencia cerrada no cancela una credencial que Firebase aún está confirmando',async()=>{
  const f=fixture(), original=f.host.open;
  let finish;
  const pending=waitForGooglePopup(()=>{f.host.open('/__/auth/handler');return new Promise(resolve=>{finish=resolve;});},f.host);
  f.popup.closed=true;
  assert.equal(f.callbacks.poll,undefined);
  finish({user:{uid:'confirmed'}});
  assert.equal((await pending).user.uid,'confirmed');
  assert.equal(f.host.open,original);assert.equal(f.callbacks.deadlineCleared,true);
});
test('éxito y rechazo del SDK conservan su resultado y limpian la observación',async()=>{
  const f=fixture(),result={user:{uid:'test'}};
  assert.equal(await waitForGooglePopup(()=>Promise.resolve(result),f.host),result);
  await assert.rejects(waitForGooglePopup(()=>Promise.reject({code:'auth/popup-blocked'}),f.host),{code:'auth/popup-blocked'});
});
test('ventana aislada no se confunde con cancelación y vence con error recuperable',async()=>{
  const f=fixture();Object.defineProperty(f.popup,'closed',{get(){throw new Error('isolated');}});
  const pending=waitForGooglePopup(()=>{f.host.open('');return new Promise(()=>{});},f.host);
  assert.equal(f.callbacks.poll,undefined);f.callbacks.expire();
  await assert.rejects(pending,{code:'auth/popup-timeout'});
});

test('el cierre que confirma Firebase conserva su código y limpia el límite',async()=>{
  const f=fixture();
  await assert.rejects(waitForGooglePopup(()=>Promise.reject({code:'auth/popup-closed-by-user'}),f.host),{code:'auth/popup-closed-by-user'});
  assert.equal(f.callbacks.deadlineCleared,true);
});

test('Google pide una ventana emergente explícita y conserva opciones del SDK',async()=>{
  const f=fixture(), calls=[];
  f.host.open=(...args)=>{calls.push(args);return f.popup;};
  const original=f.host.open;
  await waitForGooglePopup(()=>{
    f.host.open('/ayuda','help','noopener');
    f.host.open('https://auth.example/__/auth/handler?providerId=google.com','firebase','width=500,height=600,popup=no');
    return Promise.resolve('ok');
  },f.host);
  assert.deepEqual(calls[0],['/ayuda','help','noopener']);
  assert.match(calls[1][2],/(?:^|,)popup=yes(?:,|$)/);
  assert.doesNotMatch(calls[1][2],/popup=no/);
  assert.match(calls[1][2],/width=500,height=600/);
  assert.equal(f.host.open,original);
});
