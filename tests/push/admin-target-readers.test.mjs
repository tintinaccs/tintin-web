import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../js/admin/participacion/gestion-participacion-admin-v2.js', import.meta.url),'utf8');
const start = source.indexOf('window.TintinAdminEngagement = {');
const code = source.slice(start,source.indexOf('\n};',start)+3);
function fixture({exists=true, authorized=true, delayed=false}={}) {
 let resolve; const reads=[], opened=[];
 const gate = new Promise(done=>{resolve=done;});
 const context=vm.createContext({window:{},user:{uid:'owner',email:'owner@example.test'},db:{},reviews:[],likes:[],linkedLike:null,linkedReview:null,
  isSuperAdmin:()=>authorized,waitForAdminAppCheck:async()=>true,
  doc:(_db,collection,id)=>({collection,id}),
  getDoc:async ref=>{reads.push(ref);if(delayed)await gate;return {exists:()=>exists,data:()=>({productName:'Fixture',likeId:'stored_wrong_id'})};},
  openReviewDrawer:id=>opened.push(['review',id]),openLikeDrawer:id=>opened.push(['like',id]),
 });
 vm.runInContext(code,context);
 return {context,reads,opened,resolve,open:(...args)=>context.window.TintinAdminEngagement.openNotificationTarget(...args)};
}
test('abre reseña/Me gusta por lectura puntual aunque no estén en los 250 registros de la lista',async()=>{
 for(const [kind,collection] of [['review','reviewRecords'],['like','likeRecords']]){
  const f=fixture();assert.equal(await f.open(kind,'selected_123'),true);
  assert.deepEqual(f.reads,[{collection,id:'selected_123'}]);
  assert.deepEqual(f.opened,[[kind,'selected_123']]);
 }
});
test('una cuenta sin permiso, ficha inexistente o ID inválido no abre otro registro',async()=>{
 const denied=fixture({authorized:false});assert.equal(await denied.open('like','selected_123'),false);assert.equal(denied.reads.length,0);
 const missing=fixture({exists:false});assert.equal(await missing.open('review','missing_123'),false);assert.equal(missing.opened.length,0);
 const invalid=fixture();assert.equal(await invalid.open('like','../private'),false);assert.equal(invalid.reads.length,0);
});
test('si cambia la cuenta durante la lectura no muestra los datos de la sesión anterior',async()=>{
 const f=fixture({delayed:true});const opening=f.open('review','selected_123');
 await new Promise(resolve=>setImmediate(resolve));f.context.user={uid:'different'};f.resolve();
 assert.equal(await opening,false);assert.equal(f.opened.length,0);
});
