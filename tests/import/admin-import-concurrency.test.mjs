import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../js/admin/importacion-admin.js',import.meta.url),'utf8');
function handler(start,end){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from);return source.slice(from,to);}
const handlers=[handler('  async function processFile(', '\n  function summary('),handler('  async function restoreLocalJob(', '\n  async function offerLocalResume('),handler('  function clearPreview(', '\n  function hideLegacyImporters(')].join('\n');
function fixture(){
 let release;const gate=new Promise(resolve=>{release=resolve});
 const state={busy:false,source:'shopify-csv',records:[{product:{name:'Original'}}],existingProducts:[],invalidRows:[],collections:[],jobId:'original-job',job:{status:'READY'},ui:{drop:{classList:{add(){},remove(){}}},summary:{},input:{value:'selected'}}};
 const context={state,MAX_FILE_BYTES:250*1024*1024,allowed:true,reads:[],messages:[],renders:0,fail:false,console:{error(){},warn(){}},
  isSuperAdmin:()=>context.allowed,renderPreview:()=>context.renders++,toast:(message,error)=>context.messages.push({message,error}),
  readCollection:async name=>{context.reads.push(name);await gate;if(context.fail)throw new Error('Read failed');return []},
  csvObjectsFromFile:async file=>[{name:file.name}],groupShopifyRows:rows=>({products:rows.map(row=>({product:row,errors:[]})),invalidRows:[]}),
  reconcileShopifyImportIdentities:records=>records,parseLocalizedNumber(){},parseOptionalStock(){},fileSampleChecksum:async file=>file.name,
  clearLocalJob:async()=>{},apiJob:async()=>({status:'READY'})};
 vm.runInNewContext(handlers+'\nthis.processFile=processFile;this.restoreLocalJob=restoreLocalJob;this.clearPreview=clearPreview;',context);
 return {context,state,release};
}

test('dos archivos y limpiar/restaurar no pueden competir con un análisis en curso',async()=>{
 const {context,state,release}=fixture();const first=context.processFile({name:'first.csv',size:1});
 assert.equal(state.busy,true);
 await context.processFile({name:'second.csv',size:1});context.clearPreview();
 await context.restoreLocalJob({fileName:'saved.csv',records:[{product:{name:'Saved'}}]});
 assert.deepEqual(context.reads,['collections']);assert.equal(state.jobId,'original-job');
 release();await first;
 assert.equal(state.fileName,'first.csv');assert.equal(state.fileChecksum,'first.csv');assert.equal(state.records[0].product.name,'first.csv');assert.equal(state.busy,false);
 context.clearPreview();assert.equal(state.records.length,0);assert.equal(state.jobId,'');
});

test('restaurar conserva el bloqueo hasta completar la lectura y el estado del job',async()=>{
 const {context,state,release}=fixture();const restored=context.restoreLocalJob({fileName:'saved.csv',source:'shopify-csv',records:[{product:{name:'Saved'}}],jobId:'saved-job'});
 assert.equal(state.busy,true);context.clearPreview();await context.processFile({name:'other.csv',size:1});
 assert.deepEqual(context.reads,['products']);assert.equal(state.jobId,'original-job');
 release();await restored;assert.equal(state.fileName,'saved.csv');assert.equal(state.jobId,'saved-job');assert.equal(state.busy,false);
});

test('un fallo de análisis libera el bloqueo y limpia un preview no válido',async()=>{
 const {context,state,release}=fixture();context.fail=true;const parsed=context.processFile({name:'broken.csv',size:1});release();await parsed;
 assert.equal(state.busy,false);assert.equal(state.records.length,0);assert.equal(state.ui.input.value,'');assert.ok(context.messages.some(item=>item.error));
});

test('un fallo de restauración libera el bloqueo y conserva el trabajo anterior',async()=>{
 const {context,state,release}=fixture();context.fail=true;const restored=context.restoreLocalJob({source:'shopify-csv',records:[{product:{name:'Saved'}}]});release();await restored;
 assert.equal(state.busy,false);assert.equal(state.jobId,'original-job');assert.equal(state.records[0].product.name,'Original');assert.ok(context.messages.some(item=>item.error));
});

test('sin Super Admin no se analiza, restaura ni limpia ningún trabajo',async()=>{
 const {context,state}=fixture();context.allowed=false;
 await context.processFile({name:'file.csv',size:1});await context.restoreLocalJob({records:[{product:{name:'Saved'}}]});context.clearPreview();
 assert.deepEqual(context.reads,[]);assert.equal(state.jobId,'original-job');assert.equal(state.busy,false);
});
