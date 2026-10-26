import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd(),source=fs.readFileSync('scripts/auditar-admin-productos-multimedia.js','utf8');
function audit(mutate=x=>x){
 let status=0;
 vm.runInNewContext(source,{__dirname:path.join(root,'scripts'),require(name){
  if(name==='path')return path;
  if(name==='fs')return {...fs,readFileSync(file,encoding){const s=fs.readFileSync(file,encoding);return file===path.join(root,'js/admin/admin-app.js')?mutate(s):s;}};
  throw Error(name);
 },console:{log(){},error(){}},process:{exit:code=>{status=code;}}});return status;
}
function mutateSave(source,change){const start=source.indexOf('async function prodGuardar('),end=source.indexOf('window.prodToggleActive',start);return source.slice(0,start)+change(source.slice(start,end))+source.slice(end);}
test('auditor acepta commit explícito del workspace y sigue exigiendo operación, progreso y resultado del guardado',()=>{
 assert.equal(audit(),0);
 for(const change of [s=>s.replaceAll('runAdminCrudOperation(','skipOperation('),s=>s.replaceAll("ctx.start('save')",'void 0'),s=>s.replaceAll("ctx.ok('save')",'void 0')])assert.equal(audit(s=>mutateSave(s,change)),1);
});
