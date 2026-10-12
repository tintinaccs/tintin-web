import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../js/components/color/esquema-color.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(ready){
  const listeners=[],warnings=[],released=[],applied=new Map();
  const context=vm.createContext({db:{},appCheckReady:Promise.resolve(ready),
    doc:(_db,col,id)=>col+'/'+id,
    onSnapshot:(reference,next,fail)=>{listeners.push({reference,next,fail});return ()=>{};},
    GLOBAL_TOKENS:[{key:'primary',cssVar:'--color-primary'}],DEVICE_BREAKPOINTS:[{key:'desktop',min:0}],
    buildDefaultTokenMap:()=>({primary:'#713c53'}),normalizeLegacyBrandColor:(_token,value)=>value,
    console:{warn:(...args)=>warnings.push(args)},localStorage:{setItem:()=>{}},
    document:{documentElement:{style:{setProperty:(key,value)=>applied.set(key,value)},classList:{remove:()=>{},add:()=>{}}}},
    window:{innerWidth:1280,addEventListener:()=>{},TintinColorSchemeFirstPaint:{release:value=>released.push(value)}},
    clearTimeout,setTimeout});
  vm.runInContext(source,context);await tick();
  return {listeners,warnings,released,applied};
}
test('soft App Check timeout preserves cached first paint and waits for the active scheme',async()=>{
  const state=await setup(false);
  state.listeners[0].fail({code:'app-check-unavailable'});
  assert.deepEqual(state.released,['offline-safe']);
  assert.equal(state.warnings.length,0);
  assert.equal(state.listeners.length,1,'no premature default-scheme subscription');
  state.listeners[0].next({exists:()=>true,data:()=>({activeGlobalSchemeId:'active-qa'})});
  assert.equal(state.listeners[1].reference,'colorSchemes/active-qa');
  state.listeners[1].next({exists:()=>true,data:()=>({tokens:{primary:'#123456'}})});
  assert.equal(state.applied.get('--color-primary'),'#123456');
});
test('soft scheme readiness remains recoverable without replacing the last palette',async()=>{
  const state=await setup(true);
  state.listeners[0].next({exists:()=>true,data:()=>({activeGlobalSchemeId:'active-qa'})});
  state.listeners[1].fail({code:'app-check-unavailable'});
  assert.equal(state.warnings.length,0);
  assert.deepEqual(state.released,['offline-safe']);
  state.listeners[1].next({exists:()=>true,data:()=>({tokens:{primary:'#123456'}})});
  assert.equal(state.applied.get('--color-primary'),'#123456');
});
test('actual Rules rejection remains observable and uses the existing default fallback',async()=>{
  const state=await setup(true);
  state.listeners[0].fail({code:'permission-denied'});
  assert.equal(state.warnings.length,1);
  assert.equal(state.listeners[1].reference,'colorSchemes/default-global');
  state.listeners[1].fail({code:'permission-denied'});
  assert.equal(state.warnings.length,2);
});
