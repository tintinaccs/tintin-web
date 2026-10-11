import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('bootstrap observa su rechazo, notifica el fallo y conserva el rechazo para consumidores',async()=>{
 const source=fs.readFileSync(new URL('../../js/components/navigation/compatibilidad/inicio-control-paneles.js',import.meta.url),'utf8');
 const failure=new Error('controller module unavailable');let current,ready;const events=[],logs=[];
 const window={location:{href:'https://runtime.example.test/product'}};
 Object.defineProperty(window,'TintinSurfaceControllerReady',{get:()=>current,set:value=>{current=value;if(value?.then)ready=value;}});
 vm.runInNewContext(source.replace('import(controllerUrl.href)','loadController(controllerUrl.href)'),{
  window,URL,document:{currentScript:{src:'https://runtime.example.test/js/components/navigation/compatibilidad/inicio-control-paneles.js'},dispatchEvent:event=>events.push(event)},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  console:{error:(...args)=>logs.push(args)},loadController:()=>Promise.reject(failure),
 });
 // Give the fire-and-forget bootstrap its own turn before any consumer subscribes.
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(ready,error=>error===failure);
 assert.equal(current,null);assert.equal(logs.length,1);
 assert.equal(events.length,1);assert.equal(events[0].type,'tintin:surface-controller-error');
 assert.equal(events[0].detail.error,failure);
});
