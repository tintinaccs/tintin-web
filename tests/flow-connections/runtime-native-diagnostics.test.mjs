import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { installRuntimeErrorMonitor }=createRequire(import.meta.url)('../runtime/runtime-error-monitor.js');
const batchGet='/127.0.0.1:8080/v1/projects/demo-tintin-interactions/databases/(default)/documents:batchGet due to access control checks.';
const sdk='https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
function cancellation(message=batchGet,stack=sdk,name='XMLHttpRequest cannot load http'){
  return {message,stack,name};
}
async function monitor(leaving=false){
  const page=new EventEmitter();
  const state=await installRuntimeErrorMonitor(page,{async addInitScript(){}});
  if(leaving)page.emit('console',{text:()=> '[runtime-document-leaving]'});
  return {page,...state};
}
test('native demo batchGet cancellation during navigation remains visible as a diagnostic',async()=>{
  const {page,errors,browserDiagnostics}=await monitor(true);
  page.emit('pageerror',cancellation());
  assert.deepEqual(errors,[]);
  assert.deepEqual(browserDiagnostics,[{kind:'native-emulator-channel-cancelled-on-navigation',message:batchGet}]);
});
test('the same batchGet outside navigation fails runtime validation',async()=>{
  const {page,errors,browserDiagnostics}=await monitor();
  page.emit('pageerror',cancellation());
  assert.deepEqual(errors,[batchGet]);
  assert.deepEqual(browserDiagnostics,[]);
});
for(const [label,error] of [
  ['another project',cancellation(batchGet.replace('demo-tintin-interactions','production'))],
  ['another host',cancellation(batchGet.replace('127.0.0.1','example.com'))],
  ['a different SDK',cancellation(batchGet,'https://example.com/app.js')],
  ['a JavaScript exception',cancellation(batchGet,sdk,'Error')],
])test(`${label} remains a failure even during navigation`,async()=>{
  const {page,errors,browserDiagnostics}=await monitor(true);
  page.emit('pageerror',error);
  assert.deepEqual(errors,[error.message]);
  assert.deepEqual(browserDiagnostics,[]);
});
test('JavaScript rejection and error signals remain failures during navigation',async()=>{
  const {page,errors}=await monitor(true);
  const signals=['[runtime-js-rejection] TypeError: fetch failed','[runtime-js-error] application failed'];
  for(const text of signals)page.emit('console',{text:()=>text});
  assert.deepEqual(errors,signals);
});
