import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function setup(){
 const observers={},listeners={},sent=[];
 const context={window:{addEventListener:(name,cb)=>{listeners[name]=cb;}},document:{addEventListener(){}},navigator:{onLine:true,sendBeacon:(_url,blob)=>{sent.push(JSON.parse(blob.text));return true;}},location:{pathname:'/catalogo',href:'https://tintin.test/catalogo'},performance:{interactionCount:0},setTimeout:()=>1,clearTimeout(){},Blob:class {constructor(parts){this.text=parts.join('');}},PerformanceObserver:class {constructor(cb){this.cb=cb;}observe({type}){observers[type]=entries=>this.cb({getEntries:()=>entries});}}};
 context.window.PerformanceObserver=context.PerformanceObserver;
 vm.runInNewContext(fs.readFileSync('js/quality/observability.js','utf8'),context);
 return {context,observers,listeners,sent,flush:()=>listeners.pagehide()};
}
test('CLS usa ventanas de sesión y no reinicia al enviar telemetría',()=>{
 const env=setup();env.observers['layout-shift']([{startTime:100,value:.05},{startTime:200,value:.06},{startTime:300,value:.8,hadRecentInput:true}]);env.flush();
 assert.equal(env.sent.at(-1).events.find(e=>e.metric==='CLS').value,.11);
 env.observers['layout-shift']([{startTime:3000,value:.04},{startTime:3100,value:.04}]);env.flush();
 assert.equal(env.sent.length,1);
 env.observers['layout-shift']([{startTime:3200,value:.05}]);env.flush();
 assert.equal(env.sent.at(-1).events.find(e=>e.metric==='CLS').value,.13);
});
test('INP agrupa eventos de una interacción y descarta un extremo cada 50',()=>{
 const env=setup();env.context.performance.interactionCount=2;
 env.observers.event([{interactionId:7,duration:80},{interactionId:7,duration:120},{interactionId:14,duration:40}]);env.flush();
 assert.equal(env.sent.at(-1).events.find(e=>e.metric==='INP').value,120);
 env.context.performance.interactionCount=50;env.observers.event([{interactionId:21,duration:240}]);env.flush();
 const summary=env.sent.at(-1).events.find(e=>e.metric==='INP');assert.equal(summary.value,120);
 assert.deepEqual(Object.keys(summary).sort(),['code','kind','metric','online','route','value']);
});
