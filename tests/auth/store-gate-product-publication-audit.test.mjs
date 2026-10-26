import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd();
const source=fs.readFileSync('scripts/auditar-control-tienda.js','utf8');
function audit(mutate=x=>x){
 let status=0;
 vm.runInNewContext(source,{__dirname:path.join(root,'scripts'),require(name){
   if(name==='path')return path;
   if(name==='fs')return {...fs,readFileSync(file,encoding){const text=fs.readFileSync(file,encoding);return file===path.join(root,'firestore.rules')?mutate(text):text;}};
   throw Error(name);
 },console:{log(){},error(){}},process:{exit:code=>{status=code;}}});
 return status;
}
test('auditor de tienda acepta publicación privada y rechaza perder cualquiera de sus guardas públicas',()=>{
 assert.equal(audit(),0);
 const mutations=[
  s=>s.replace("allow get: if (isStoreOpenOrAllowed() &&",'allow get: if (true &&'),
  s=>s.replace("resource.data.get('active', true) != false &&",'true &&'),
  s=>s.replace("resource.data.get('publicationStatus', 'active') == 'active'",'true'),
  s=>s.replace('request.query.limit <= 1000','request.query.limit <= 10000'),
  s=>s.replace('resource.data.publicationStatus == \'active\'','true'),
  s=>s.replace('resource.data.active == true','true'),
  s=>s.replace('|| canReadProductDrafts();','|| true;'),
 ];
 for(const mutate of mutations)assert.equal(audit(mutate),1);
});
