import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {createRequire} from 'node:module';
const {collectVitals}=createRequire(import.meta.url)('./_helpers.js');
async function measure(resources){return collectVitals({evaluate:fn=>vm.runInNewContext('('+fn.toString()+')()',{URL,location:{href:'https://fixture.test/',origin:'https://fixture.test'},performance:{getEntriesByType:type=>type==='resource'?resources:[],getEntriesByName:()=>[]},window:{setTimeout:fn=>fn()}})});}
const entry=(path,initiatorType)=>({name:'https://fixture.test'+path,initiatorType,transferSize:1024});
test('beacons de telemetría se contabilizan sin confundirlos con recursos duplicados',async()=>{
 const result=await measure([entry('/api/telemetry','beacon'),entry('/api/telemetry','beacon'),entry('/app.js','script'),entry('/app.js','script')]);
 assert.equal(result.requests,4);assert.equal(result.firstPartyRequests,4);assert.equal(result.transferKB,4);assert.equal(result.telemetryRequests,2);assert.equal(result.duplicateRequests,1);assert.equal(result.duplicateUrls[0].name,'https://fixture.test/app.js');
});
test('consultas fetch repetidas y otros beacons siguen visibles en el tripwire',async()=>{
 for(const [path,type] of [['/api/public-catalog','fetch'],['/api/telemetry','fetch'],['/other','beacon']]){
  const result=await measure([entry(path,type),entry(path,type)]);assert.equal(result.duplicateRequests,1);assert.equal(result.telemetryRequests,0);
 }
});
