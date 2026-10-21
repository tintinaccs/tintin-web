import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { installRuntimeErrorMonitor }=createRequire(import.meta.url)('../runtime/runtime-error-monitor.js');
const batchGet='/127.0.0.1:8080/v1/projects/demo-tintin-interactions/databases/(default)/documents:batchGet due to access control checks.';
const sdk='https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const tokenRefresh='/127.0.0.1:9099/securetoken.googleapis.com/v1/token?key=demo-key due to access control checks.';
const authSdk='https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js:1:34862';
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

test('native demo token refresh during document exit is retained as a diagnostic',async()=>{
  const {page,errors,browserDiagnostics}=await monitor(true);
  page.emit('pageerror',cancellation(tokenRefresh,authSdk,'Fetch API cannot load http'));
  assert.deepEqual(errors,[]);
  assert.equal(browserDiagnostics[0]?.message,tokenRefresh);
});
for(const [label,leaving,error] of [
  ['active token refresh',false,cancellation(tokenRefresh,authSdk)],
  ['production token endpoint',true,cancellation(tokenRefresh.replace('/127.0.0.1:9099/','/securetoken.googleapis.com/'),authSdk)],
  ['non-demo token key',true,cancellation(tokenRefresh.replace('demo-key','other-key'),authSdk)],
  ['unrelated token caller',true,cancellation(tokenRefresh,'https://example.test/app.js')],
  ['real token JavaScript exception',true,cancellation(tokenRefresh,authSdk,'Error')],
])test(`${label} remains a runtime failure`,async()=>{
  const {page,errors,browserDiagnostics}=await monitor(leaving);
  page.emit('pageerror',error);
  assert.deepEqual(errors,[error.message]);
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
