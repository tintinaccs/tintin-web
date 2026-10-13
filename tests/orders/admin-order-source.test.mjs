import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdminOrderSource, reconcileAdminOrderSnapshot } from '../../js/admin/orders/fuente-pedidos-admin.mjs';

function fixture(complete = true) {
  const watches = [], values = [], errors = [];
  const source = createAdminOrderSource({ complete, onLoading() {}, onData: rows => values.push(rows), onError: error => errors.push(error),
    subscribePage(cursor, next, error) { const watch = { cursor, next, error, stopped: false }; watches.push(watch); return () => { watch.stopped = true; }; }
  });
  const send = (index, ids, more = false, extra = {}) => watches[index].next({orders: ids.map(id => ({id,...extra})), cursor: ids.at(-1), cursorKey: ids.at(-1) || '', hasMore: more});
  return {source,watches,values,errors,send,last:()=>values.at(-1)};
}
test('páginas limitadas publican el conjunto completo sin un contador parcial',()=>{
  const f=fixture();f.send(0,['a','b'],true);assert.equal(f.values.length,0);f.send(1,['c','d'],true);assert.equal(f.values.length,0);f.send(2,['e']);
  assert.deepEqual(f.last().map(o=>o.id),['a','b','c','d','e']);assert.deepEqual(f.watches.map(w=>w.cursor),[null,'b','d']);f.source.stop();assert.ok(f.watches.every(w=>w.stopped));
});
test('otros roles conservan una sola página aunque haya más pedidos',()=>{
  const f=fixture(false);f.send(0,['a','b'],true);assert.equal(f.watches.length,1);assert.equal(f.last().length,2);f.source.stop();
});
test('cambio de estado en página anterior conserva las demás suscripciones y actualiza el conjunto',()=>{
  const f=fixture();f.send(0,['a','b'],true);f.send(1,['c','d'],true);f.send(2,['e']);const count=f.watches.length;
  f.send(1,['c','d'],true,{status:'preparando'});assert.equal(f.watches.length,count);assert.equal(f.last().find(o=>o.id==='c').status,'preparando');f.source.stop();
});
test('pedido nuevo desplaza las fronteras sin perder anteriores ni aceptar snapshots obsoletos',()=>{
  const f=fixture();f.send(0,['a','b'],true);f.send(1,['c','d'],true);f.send(2,['e']);const old=f.last();
  f.send(0,['new','a'],true);assert.equal(f.last(),old);assert.ok(f.watches[1].stopped && f.watches[2].stopped);
  f.send(3,['b','c'],true);f.send(4,['d','e']);assert.deepEqual(f.last().map(o=>o.id),['new','a','b','c','d','e']);
  const count=f.values.length;f.send(1,['stale']);assert.equal(f.values.length,count);f.source.stop();
});
test('colección vacía cancela las páginas posteriores y no conserva pedidos borrados',()=>{
  const f=fixture();f.send(0,['a'],true);f.send(1,['b']);f.send(0,[]);assert.deepEqual(f.last(),[]);assert.ok(f.watches[1].stopped);f.source.stop();
});
test('fallo de una página conserva el último conjunto confirmado y recuperación no duplica pedidos',()=>{
  const f=fixture();f.send(0,['a'],true);f.send(1,['b']);const previous=f.last();f.watches[1].error(new Error('offline'));f.send(0,['a'],true,{status:'listo'});
  assert.equal(f.last(),previous);assert.equal(f.errors.length,1);f.send(1,['b']);assert.equal(f.last().length,2);assert.equal(f.last()[0].status,'listo');f.source.stop();
});
test('snapshot retrasado de otra página no revierte una mutación confirmada ni recrea pedidos borrados',()=>{
  const confirmed=[{id:'a',inventoryRevision:2,status:'preparando'},{id:'deleted',inventoryRevision:1}];
  const rows=reconcileAdminOrderSnapshot([{id:'a',inventoryRevision:1,status:'pendiente'},{id:'b',inventoryRevision:1}],confirmed);
  assert.equal(rows[0].status,'preparando');assert.equal(rows.length,2);assert.ok(!rows.some(o=>o.id==='deleted'));
  const updated=reconcileAdminOrderSnapshot([{id:'a',inventoryRevision:3,status:'listo'}],confirmed);assert.equal(updated[0].status,'listo');
});
test('caché incompleta no se presenta como contador confirmado antes del servidor',()=>{
  const f=fixture();f.watches[0].next({orders:[{id:'cached'}],hasMore:false,authoritative:false});assert.equal(f.values.length,0);
  f.send(0,['server-a'],true);f.watches[1].next({orders:[],hasMore:false,authoritative:false});assert.equal(f.values.length,0);
  f.send(1,['server-b']);assert.deepEqual(f.last().map(o=>o.id),['server-a','server-b']);f.source.stop();
});
test('adaptador administrativo original limita cada consulta y espera confirmación de servidor',()=>{
  const original=readFileSync(new URL('../../js/admin/admin-app.js',import.meta.url),'utf8');
  const start=original.indexOf('    const source = createAdminOrderSource({');
  const end=original.indexOf('    adminOrdersUnsubscribe = source.stop;',start)+'    adminOrdersUnsubscribe = source.stop;'.length;
  assert.ok(start>=0 && end>start);
  for(const role of ['superadmin','admin']) {
    const watches=[],ready={orders:false};
    const deps={createAdminOrderSource,reconcileAdminOrderSnapshot,currentRole:role,adminRealtimeReady:ready,adminRealtimeErrors:{},ADMIN_REALTIME_LIMIT:250,db:{},collection:(_db,name)=>name,orderBy:()=>({order:true}),limit:n=>({limit:n}),startAfter:cursor=>({cursor}),query:(...parts)=>parts,activityTimestampMillis:v=>v?.seconds || 0,refreshRealtimeConsumers(){},statisticsSetText(){},recoverAdminRealtimeAuth(){},onSnapshot(q,options,next,error){watches.push({q,options,next,error});return()=>{};}};
    const runtime=new Function('deps',`let {${Object.keys(deps).join(',')}}=deps;let allOrders=[],adminOrdersUnsubscribe;${original.slice(start,end)};return {read:()=>allOrders,stop:()=>adminOrdersUnsubscribe()};`)(deps);
    const docs=Array.from({length:600},(_,i)=>({id:`fixture-${i}`,data:()=>({createdAt:{seconds:600-i},inventoryRevision:1})}));
    watches[0].next({docs:[],metadata:{fromCache:true}});assert.equal(ready.orders,false);
    for(let page=0;page<watches.length;page++) {
      const watch=watches[page];assert.equal(watch.q.at(-1).limit,250);assert.equal(watch.options.includeMetadataChanges,true);
      if(page)assert.equal(watch.q.at(-2).cursor.id,docs[page*250-1].id);
      watch.next({docs:docs.slice(page*250,(page+1)*250),metadata:{fromCache:false}});
    }
    assert.equal(runtime.read().length,role==='superadmin'?600:250);assert.equal(ready.orders,true);runtime.stop();
  }
});
