import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/admin/products/integridad-inventario-admin.js','utf8').replace(/import[\s\S]*?;\n/g,'');
function fixture({decision='keep',status='confirmado',version='c0',beforeChoice=()=>{}}={}) {
 const posts=[], choices=[];
 const order={id:'order_test_123',status,lastChangeId:version};
 const auth={currentUser:{uid:'admin',email:'admin@example.com'}};
 const window={TintinAdminOrders:{get:()=>order}};
 const context={window,auth,db:{},doc:(_db,collection,id)=>({collection,id}),getDoc:async()=>({exists:()=>true,data:()=>order}),
  orderNeedsCancellationStockChoice:(before,next)=>['cancelado','rechazado'].includes(next)&&before.status!==next,
  chooseCancellationStock:async(before,next)=>{choices.push({before,next});beforeChoice(auth);return decision;},
  authenticatedFetch:async(_url,options)=>{posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{order:{status:'cancelado'}}})};},
  crypto:{randomUUID:()=> 'fixture-uuid'}};
 vm.runInNewContext(source,context);
 return {api:window.TintinInventoryIntegrity,posts,choices,auth};
}
for(const decision of ['keep','release']) test(`la mutación central pide y envía la decisión ${decision} con la versión leída`,async()=>{
 const f=fixture({decision});await f.api.transitionStatus('order_test_123','cancelado',{baseChangeId:'c0'});
 assert.equal(f.choices.length,1);assert.equal(f.posts.length,1);assert.equal(f.posts[0].inventoryCancellationDecision,decision);assert.equal(f.posts[0].baseChangeId,'c0');
});
test('volver sin cambios no envía una cancelación ni modifica el borrador',async()=>{
 const f=fixture({decision:null});const result=await f.api.updateEditedOrder('order_test_123',{status:'cancelado',baseChangeId:'c0'});
 assert.equal(result.cancelled,true);assert.equal(f.posts.length,0);
});
test('una versión antigua no abre el selector ni envía una decisión ajena al snapshot',async()=>{
 const f=fixture();await assert.rejects(f.api.transitionStatus('order_test_123','cancelado',{baseChangeId:'old'}),/El pedido cambió/);
 assert.equal(f.choices.length,0);assert.equal(f.posts.length,0);
});
test('cambiar de cuenta mientras se decide stock no envía la mutación',async()=>{
 const f=fixture({beforeChoice:auth=>{auth.currentUser={uid:'other'};}});await assert.rejects(f.api.transitionStatus('order_test_123','cancelado'),/sesión administrativa cambió/);assert.equal(f.posts.length,0);
});
test('editar una cancelación existente no vuelve a pedir stock ni inventa otra decisión',async()=>{
 const f=fixture({status:'cancelado'});await f.api.updateEditedOrder('order_test_123',{status:'cancelado',notes:'revisado'});assert.equal(f.choices.length,0);assert.equal(f.posts.length,1);assert.equal(f.posts[0].inventoryCancellationDecision,undefined);
});
