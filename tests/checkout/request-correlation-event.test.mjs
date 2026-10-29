import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('requestId avisa al puente antes de borrar storage, incluso si storage falla',()=>{
 const source=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8');const bridge=fs.readFileSync('js/pages/checkout/checkout-puente-correo.js','utf8');
 for(const blocked of [false,true]){
  const listeners={};let value=null;
  const context={window:{crypto:{randomUUID:()=> '01234567-89ab-cdef-0123-456789abcdef'},addEventListener:(name,cb)=>listeners[name]=cb,dispatchEvent:event=>listeners[event.type]?.(event)},sessionStorage:{getItem:()=>{if(blocked)throw Error('blocked');return value;},setItem:(_,v)=>value=v},CustomEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Date,Math};
  vm.createContext(context);
  vm.runInContext("const REQUEST_KEY='tt_spark_checkout_request_id';let capturedRequestId='';const clean=value=>String(value||'').trim();"+bridge.slice(bridge.indexOf('  function captureRequestId()'),bridge.indexOf('  function successVisible()'))+source.slice(source.indexOf('  let inMemoryRequestId'),source.indexOf('\n  }',source.indexOf('  function requestId()'))+4)+'\nconst requested=requestId();globalThis.result={requested,captured:capturedRequestId};',context);
  assert.equal(context.result.captured,context.result.requested);assert.ok(context.result.captured.length>=12);
 }
 assert.doesNotMatch(bridge,/setInterval\(captureRequestId/);
});
