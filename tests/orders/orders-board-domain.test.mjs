import { moveOrderTrash } from '../../cloudflare/order-trash-controls.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOrderAdminMutation, createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { allowedOrderStatuses, assertOrderTransition, orderStage, orderTimeline, customerOrderMessage } from '../../js/orders/ciclo-pedido.mjs';
import { orderContactLinks } from '../../cloudflare/contactos-pedido.mjs';

function store(order) {
  let revision=0;
  const records=new Map([['orders/order_fixture_1',{fields:encodeFirestoreFields(order),updateTime:'v0'}],['products/product_1',{fields:encodeFirestoreFields({stock:10}),updateTime:'v0'}]]);
  const commits=[];
  return {records,commits,batchGet:async(_env,paths)=>paths.map(path=>{const document=records.get(decodeURIComponent(path));return document ? {name:'projects/demo/databases/(default)/documents/'+path,...structuredClone(document)}:null;}).filter(Boolean),get:async(_env,path)=>structuredClone(records.get(decodeURIComponent(path)) || null),
    commit:async(_env,writes)=>{
      for(const w of writes) { const previous=records.get(w.path);if(w.currentDocument?.updateTime && previous?.updateTime!==w.currentDocument.updateTime)throw Object.assign(new Error('Conflicto de versión'),{status:409,code:'version_conflict'}); }
      commits.push(writes);const version=`v${++revision}`;
      for(const w of writes)records.set(w.path,{fields:encodeFirestoreFields({...decodeFirestoreFields(records.get(w.path)?.fields || {}),...decodeFirestoreFields(w.fields)}),updateTime:version});
    },order:()=>decodeFirestoreFields(records.get('orders/order_fixture_1').fields),stock:()=>decodeFirestoreFields(records.get('products/product_1').fields).stock};
}
const order=(extra={})=>({status:'pendiente',paymentStatus:'pendiente',shippingMethod:'delivery',lastChangeId:'',inventoryState:'unreserved',items:[{id:'product_1',name:'Pulsera',qty:1,price:35000}],subtotal:35000,total:35000,...extra});
const actor={uid:'super_fixture',email:'admin@example.test',role:'superadmin',origin:'superadmin'};
async function mutate(s,status,id,extra={}) { return applyOrderAdminMutation({}, {orderId:'order_fixture_1',status,baseChangeId:s.order().lastChangeId || '',changeId:id,...extra},actor,s); }

for(const method of ['delivery','encomienda','retiro'])test(`ciclo completo ${method}: pago separado, reserva única e historial atómico`,async()=>{
  const s=store(order({shippingMethod:method}));
  const sequence=method==='retiro' ? ['preparando','listo_retiro','entregado'] : ['preparando','listo','en_camino','entregado'];
  for(let i=0;i<sequence.length;i++){
    await mutate(s,sequence[i],`change_${i}`,{statusNote:`Acción ${i}`});assert.equal(s.order().status,sequence[i]);assert.equal(s.stock(),9);assert.equal(s.order().paymentStatus,'pendiente');
    assert.equal(s.commits.at(-1).filter(w=>w.path.startsWith('auditLog/')).length,1);
    assert.equal(decodeFirestoreFields(s.commits.at(-1).find(w=>w.path.startsWith('auditLog/')).fields).notes,`Acción ${i}`);
  }
  assert.equal(orderStage(s.order()),'done');
});
test('servidor rechaza saltar de nuevo a entregado sin tocar stock ni historial',async()=>{
  const s=store(order());await assert.rejects(mutate(s,'entregado','invalid'),e=>e.code==='invalid_order_transition');assert.equal(s.commits.length,0);assert.equal(s.stock(),10);
});
test('retiro no permite enviado y listo no equivale a entregado',()=>{
  const pickup=order({shippingMethod:'retiro',status:'listo_retiro'});
  assert.throws(()=>assertOrderTransition(pickup,'en_camino'));
  assert.ok(!orderTimeline(pickup).some(s=>/enviad|camino/i.test(s.label)));
  assert.equal(orderTimeline(pickup).at(-1).done,false);
  assert.match(customerOrderMessage(pickup),/listo para retirar/);
});
test('dos sesiones con versión inicialmente vacía no pisan el cambio confirmado',async()=>{
  const s=store(order());await mutate(s,'preparando','first');
  await assert.rejects(applyOrderAdminMutation({}, {orderId:'order_fixture_1',status:'cancelado',baseChangeId:'',changeId:'second'},actor,s),e=>e.code==='stale_order');assert.equal(s.order().status,'preparando');
});
test('doble ejecución con la misma clave no descuenta stock ni duplica el historial',async()=>{
  const s=store(order());const first=await mutate(s,'preparando','same');
  const again=await applyOrderAdminMutation({}, {orderId:'order_fixture_1',status:'preparando',baseChangeId:'',changeId:'same'},actor,s);
  assert.equal(first.duplicate,false);assert.equal(again.duplicate,true);assert.equal(s.commits.length,1);assert.equal(s.stock(),9);
});
test('cancelar conserva el pedido y libera la reserva una sola vez; devolver no presume stock vendible',async()=>{
  const s=store(order());await mutate(s,'preparando','accept');await mutate(s,'cancelado','cancel');assert.equal(s.stock(),10);assert.equal(s.order().status,'cancelado');assert.ok(s.records.has('orders/order_fixture_1'));
  const returned=store(order({status:'entregado',inventoryState:'reserved',paymentStatus:'pagado'}));await mutate(returned,'devuelto','return');assert.equal(returned.stock(),10);assert.equal(returned.order().paymentStatus,'pagado');
});
test('incidencia conserva la etapa para recuperar el flujo sin entrega falsa',async()=>{
  const s=store(order());await mutate(s,'preparando','accept');await mutate(s,'incidencia','incident');assert.equal(s.order().previousFulfillmentStatus,'preparando');assert.ok(allowedOrderStatuses(s.order()).includes('preparando'));await mutate(s,'preparando','recover');assert.equal(s.stock(),9);
});
test('consultar contactos exige Super Admin antes de leer y no ejecuta mutaciones',async()=>{
  const source=readFileSync(new URL('../../functions/api/admin-order-mutation.js',import.meta.url),'utf8').replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/g,'').replaceAll('export async function','async function');
  let reads=0,auth=true;
  const deps={rateLimitErrorResponse:()=>null,requireSuperAdmin:async()=>{if(!auth)throw Object.assign(new Error('denied'),{status:403});},originIsAllowed:()=>true,jsonResponse:(data,status)=>new Response(JSON.stringify(data),{status}),statusFromError:(e,f)=>e.status || f,firestoreAdminGet:async()=>{reads++;return {fields:encodeFirestoreFields(order({userName:'QA',userPhone:'0981123456',shipping:{mapLocation:{lat:-25.3,lng:-57.5}}}))};},decodeFirestoreFields,orderContactLinks};
  const handler=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${source};return onRequest;`)(deps);
  const request=new Request('https://tintinaccesorios.pages.dev/api/admin-order-mutation?orderId=order_fixture_1');
  auth=false;assert.equal((await handler({request,env:{}})).status,403);assert.equal(reads,0);
  auth=true;const response=await handler({request,env:{}});assert.equal(response.status,200);const body=await response.json();assert.match(body.links.dispatch,/595982518206/);assert.equal(reads,1);
  const missingVersion = await handler({request:new Request('https://tintinaccesorios.pages.dev/api/admin-order-mutation',{method:'POST',headers:{origin:'https://tintinaccesorios.pages.dev'},body:JSON.stringify({orderId:'order_fixture_1',status:'preparando'})}),env:{}});
  assert.equal(missingVersion.status,400);assert.match((await missingVersion.json()).error,/falta la versión/);assert.equal(reads,1);
});
test('una incidencia durante envío no autoriza cancelar ni liberar stock automáticamente',()=>{
  const shipped=order({status:'incidencia',previousFulfillmentStatus:'en_camino'});
  assert.throws(()=>assertOrderTransition(shipped,'cancelado'));
  assert.ok(allowedOrderStatuses(shipped).includes('en_camino'));
});
test('archivar/restaurar entregados conserva entrega, pago e inventario históricos',async()=>{
  const source=readFileSync(new URL('../../js/admin/orders/pedidos-superadmin-crud.js',import.meta.url),'utf8').replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/g,'');
  const records=new Map([['orders/order_fixture_1',{status:'entregado',paymentStatus:'pagado',inventoryState:'reserved',lastChangeId:'delivered_revision',orderNumber:'TINPEDQA'}]]);
  const snapshot=ref=>({exists:()=>records.has(ref),data:()=>structuredClone(records.get(ref))});
  const deps={subscribeAuthState:()=>()=>{},chooseOrderTrash:async orders=>({reason:'QA',selections:Object.fromEntries(orders.map(order=>[order.id,{baseChangeId:order.lastChangeId || '',returnItems:[]}]))}),crypto,authenticatedFetch:async(_url,options)=>{const body=JSON.parse(options.body);const result=await moveOrderTrash({},body,actor,{get:async(_env,ref)=>records.has(ref)?{fields:encodeFirestoreFields(records.get(ref)),updateTime:'fixture-version'}:null,commit:async(_env,writes)=>{for(const write of writes){if(write.delete)records.delete(write.path);else records.set(write.path,decodeFirestoreFields(write.fields));}}});return {ok:true,json:async()=>({ok:true,result})};},auth:{currentUser:{email:'admin@example.test'}},db:{},SUPER_ADMIN:'admin@example.test',allowedOrderStatuses,doc:(_db,c,id)=>c+'/'+id,serverTimestamp:()=>new Date(),document:{addEventListener(){}},window:{confirm:()=>true,TintinInventoryIntegrity:{transitionStatus(){throw new Error('No debe cancelar entregados');}}},getDoc:async ref=>snapshot(ref),runTransaction:async(_db,fn)=>fn({get:async ref=>snapshot(ref),set:(ref,data)=>records.set(ref,data),delete:ref=>records.delete(ref)})};
  new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${source}`)(deps);
  await deps.window.TintinOrderAdmin.trashOrder('order_fixture_1');assert.equal(records.has('orders/order_fixture_1'),false);assert.equal(records.get('orderTrash/order_fixture_1').status,'entregado');
  await deps.window.TintinOrderAdmin.restoreOrder('order_fixture_1');const restored=records.get('orders/order_fixture_1');assert.equal(restored.status,'entregado');assert.equal(restored.paymentStatus,'pagado');assert.equal(restored.inventoryState,'reserved');
});
test('crear retiro enviado se rechaza antes de consultar productos o guardar',async()=>{
  let reads=0;
  await assert.rejects(createOrderAdmin({}, {status:'en_camino',shippingMethod:'retiro',userName:'QA'},actor,{get:async()=>{reads++;return null;}}),e=>e.code==='invalid_order_transition');
  assert.equal(reads,0);
});
test('cambiar modalidad no puede dejar listo para retirar como delivery ni envío como retiro',async()=>{
  for(const [status,shippingMethod,requested] of [['listo_retiro','retiro','delivery'],['en_camino','delivery','retiro']]){
    const s=store(order({status,shippingMethod}));
    await assert.rejects(applyOrderAdminMutation({}, {orderId:'order_fixture_1',shippingMethod:requested,baseChangeId:'',changeId:'invalid_mode'},actor,s),e=>e.code==='invalid_order_transition');assert.equal(s.commits.length,0);
  }
});
