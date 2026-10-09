import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { normalizeLocalEntry, upsertLocalEntries, localCommerceSnapshot, localCustomerId, purchasedCustomers } from '../../cloudflare/comercio-local.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { applyOrderAdminMutation } from '../../cloudflare/order-admin-domain.js';

function memory() {
  const docs=new Map(),commits=[];
  return {docs,commits,deps:{get:async(_,path)=>docs.get(path)||null,list:async(_,path)=>[...docs].filter(([key])=>key.startsWith(path+'/')).map(([,doc])=>doc),commit:async(_,writes)=>{
    for(const write of writes){const old=docs.get(write.path);if(write.currentDocument?.exists===false&&old||write.currentDocument?.updateTime&&old?.updateTime!==write.currentDocument.updateTime)throw Object.assign(new Error('Conflicto'),{status:409});}
    commits.push(writes);
    for(const write of writes){const old=docs.get(write.path);docs.set(write.path,{name:'projects/test/databases/(default)/documents/'+write.path,fields:write.mergeFields?{...old.fields,...write.fields}:write.fields,updateTime:randomUUID()});}
  }}};
}
const sale=()=>({id:'LOCAL_2026_01_1',kind:'sale',year:2026,month:1,occurredOn:'2026-01-03',customerName:'Clienta local',orderCode:'1',total:150000,paymentStatus:'pagado',paymentMethod:'transferencia',lines:[{detail:'',quantity:null,amount:150000,cost:null,profit:null}],source:{sheet:'Enero',rows:[10]}});
test('importar historia conserva total y fecha sin inventar artículos, usuarios, stock ni TINPED',async()=>{
  const h=memory(),entry=sale();const result=await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {uid:'owner'},h.deps);
  const order=decodeFirestoreFields(h.docs.get('orders/'+entry.id).fields);
  assert.equal(order.total,150000);assert.equal(order.createdAt,'2026-01-03T12:00:00.000Z');assert.equal(order.orderNumber,'LOCAL-2026-01-1');assert.deepEqual(order.items,[]);assert.equal(order.userId,'');assert.equal(order.inventoryState,'historical_unmanaged');
  assert.ok(h.commits.flat().every(w=>/^(localCommerceEntries|orders|syncMeta|auditLog)\//.test(w.path)));
  const count=h.commits.length;await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {},h.deps);assert.equal(h.commits.length,count);
  await assert.rejects(()=>upsertLocalEntries({}, {action:'upsert',entries:[{...entry,notes:'Edición sin versión vigente'}]}, {},h.deps),error=>error.status===409);
  await upsertLocalEntries({}, {action:'upsert',entries:[{...entry,notes:'Corrección real',baseVersion:result.results[0].version}]}, {},h.deps);
  assert.equal(decodeFirestoreFields(h.docs.get('orders/'+entry.id).fields).notes,'Corrección real');
});
test('un lote inválido no escribe parcialmente; no se puede vaciar una venta confirmada',async()=>{
  const h=memory(),entry=sale();await assert.rejects(()=>upsertLocalEntries({}, {action:'upsert',entries:[entry,{...entry,id:'LOCAL_invalid',occurredOn:'2026-13-01'}]}, {},h.deps),/Fecha/);assert.equal(h.docs.size,0);
  const result=await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {},h.deps);
  await assert.rejects(()=>upsertLocalEntries({}, {action:'upsert',entries:[{...entry,occurredOn:'',baseVersion:result.results[0].version}]}, {},h.deps),/conservar fecha/);
});
test('clientes locales y cuentas web con el mismo nombre permanecen separados',async()=>{
  const id=await localCustomerId('Clienta local');assert.equal(id,await localCustomerId(' CLIENTA   LOCAL '));
  const customers=purchasedCustomers([{id,name:'Clienta local'}],[{id:'local1',customerId:id,userName:'Clienta local',total:150000,paymentStatus:'pagado',createdAt:'2026-01-03'}, {id:'web1',userId:'uid123',userName:'Clienta local',total:40000,paymentStatus:'pendiente',createdAt:'2026-10-08'}]);
  assert.equal(customers.length,2);assert.equal(customers.find(c=>c.id===id).totalPaid,150000);assert.equal(customers.find(c=>c.hasWebAccount).totalPaid,0);
});
test('archivo retira la venta de totales sin borrar su evidencia',async()=>{
  const h=memory(),entry=sale(),r=await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {},h.deps);
  await upsertLocalEntries({}, {action:'upsert',entries:[{...entry,archived:true,baseVersion:r.results[0].version}]}, {},h.deps);
  const snapshot=await localCommerceSnapshot({}, {},h.deps);assert.equal(snapshot.entries[0].archived,true);assert.equal(snapshot.customers[0].totalPurchased,0);
});
test('el editor normal de pedidos rechaza ventas locales antes de leer productos o escribir',async()=>{
  const reads=[],commits=[];
  await assert.rejects(()=>applyOrderAdminMutation({}, {orderId:'LOCAL_2026_01_1',paymentStatus:'pagado'}, {}, {get:async(_,path)=>{reads.push(path);return {fields:encodeFirestoreFields({localEntryId:'LOCAL_2026_01_1'})};},commit:async(_,writes)=>commits.push(writes)}),error=>error.code==='local_order_separate_ledger');
  assert.deepEqual(reads,['orders/LOCAL_2026_01_1']);assert.equal(commits.length,0);
});
function gsHarness(rows,name='Mayo') {
  const store=new Map(),writes=[];
  const sheet={getName:()=>name,getLastRow:()=>rows.length+9,getRange:(r,c,h=1,w=1)=>({getDisplayValue:()=>name+' 2026 · Tintin',getValues:()=>rows.slice(r-10,r-10+h).map(v=>v.slice(c-1,c-1+w)),setValue:v=>writes.push({r,c,v}),setValues:()=>{}})};
  const context=vm.createContext({Date,console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>[...createHash('sha256').update(v).digest()],getUuid:randomUUID,formatDate:v=>v.toISOString().slice(0,10)},PropertiesService:{getDocumentProperties:()=>({getProperty:key=>store.get(key),setProperty:(key,v)=>store.set(key,v)})},TINTIN_WEBHOOK_SECRET_PROPERTIES:{},TINTIN_ADMIN_WEBHOOK_PATH:'/api/sheets-admin-webhook'});
  vm.runInContext(readFileSync(new URL('../../apps-script/ComercioLocal.gs',import.meta.url),'utf8'),context);return {context,sheet,store,writes};
}
test('línea continuación de combo es un solo pedido; fórmulas cero no crean gastos ni compras',()=>{
  const first=Array(38).fill('');first[1]=30;first[2]='Combo';first[3]='2026-05-31';first[4]='Clienta local';first[9]=90000;first[11]='Pagado';
  const next=Array(38).fill('');next[1]=30;next[2]='Combo';next[9]=0;next[21]=0;next[25]=0;
  const h=gsHarness([first,next]),entries=h.context.tintinLocalMonthlyRows_(h.sheet);
  assert.equal(entries.length,1);assert.equal(entries[0].lines.length,2);assert.equal(entries[0].total,90000);assert.equal(entries[0].occurredOn,'2026-05-31');assert.deepEqual(Array.from(entries[0].source.rows),[10,11]);
  assert.ok(h.writes.every(write=>write.c===33));
});
test('sin edición local pendiente la reconciliación no reenvía datos viejos sobre cambios del panel',()=>{
  const h=gsHarness([]),entry={...sale(),baseVersion:'oldVersion'},key='LOCAL_BASE_'+entry.id;
  h.store.set(key,h.context.tintinLocalFingerprint_(entry));let calls=0;h.context.tintinLocalCall_=()=>{calls++;throw new Error('No debe llamar');};
  h.context.tintinLocalPush_(h.sheet,[entry]);assert.equal(calls,0);
});
test('borradores no aparecen como compras ni se publican en pedidos',async()=>{
  const h=memory();await upsertLocalEntries({}, {action:'upsert',entries:[{...sale(),occurredOn:'',total:0,lines:[]}]}, {},h.deps);
  assert.equal(h.docs.has('orders/LOCAL_2026_01_1'),false);const snapshot=await localCommerceSnapshot({}, {},h.deps);assert.equal(snapshot.entries[0].draft,true);assert.equal(snapshot.customers.length,0);
});
test('validación de teléfono y fechas rechaza formatos incompletos y mantiene los aceptados',async()=>{
  await assert.rejects(()=>normalizeLocalEntry({id:'CUS_LOCAL_test',kind:'customer',name:'Clienta',phone:'1299331'}),/Teléfono/);
  const customer=await normalizeLocalEntry({id:'CUS_LOCAL_test',kind:'customer',name:'Clienta',phone:'0981 299 331'});assert.equal(customer.phone,'+595981299331');
  await assert.rejects(()=>normalizeLocalEntry({...sale(),occurredOn:'2026-02-31',month:2}),/Fecha/);
});
