import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { normalizeLocalEntry, upsertLocalEntries, localCommerceSnapshot, localCustomerId, purchasedCustomers } from '../../cloudflare/comercio-local.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { applyOrderAdminMutation } from '../../cloudflare/order-admin-domain.js';
import {onRequest as localEndpoint} from '../../functions/api/local-commerce.js';
import {onRequestPost as localWebhook} from '../../functions/api/local-commerce-webhook.js';

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
  const context=vm.createContext({Date,console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>[...createHash('sha256').update(v).digest()],getUuid:randomUUID,formatDate:v=>v.toISOString().slice(0,10)},PropertiesService:{getDocumentProperties:()=>({getProperty:key=>store.get(key),getProperties:()=>Object.fromEntries(store),setProperty:(key,v)=>store.set(key,v),setProperties:values=>Object.entries(values).forEach(([key,value])=>store.set(key,value))})},TINTIN_WEBHOOK_SECRET_PROPERTIES:{},TINTIN_ADMIN_WEBHOOK_PATH:'/api/sheets-admin-webhook'});
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
test('API y webhook no exponen datos sin autenticación; secreto de productos no autoriza el alcance local',async()=>{
  const response=await localEndpoint({request:new Request('https://tintin.example/api/local-commerce'),env:{}});assert.equal(response.status,401);assert.match(response.headers.get('cache-control'),/no-store/);
  const webhook=await localWebhook({request:new Request('https://tintin.example/api/local-commerce-webhook',{method:'POST',headers:{'X-Tintin-Sheets-Secret':'fixture-products-only'},body:'{"action":"snapshot"}'}),env:{SHEETS_PRODUCTS_WEBHOOK_SECRET:'fixture-products-only',SHEETS_ADMIN_WEBHOOK_SECRET:'fixture-admin-only'}});assert.equal(webhook.status,401);
});
test('ventas sin importe por línea no se inventan, y los meses de registros existentes no se mueven silenciosamente',async()=>{
  await assert.rejects(()=>normalizeLocalEntry({...sale(),lines:[]}),/importes de las líneas/);
  const h=memory(),entry=sale(),r=await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {},h.deps);
  await assert.rejects(()=>upsertLocalEntries({}, {action:'upsert',entries:[{...entry,month:2,occurredOn:'2026-02-03',baseVersion:r.results[0].version}]}, {},h.deps),/hoja de origen/);
  const partial=await normalizeLocalEntry({...entry,paymentStatus:'señado',lines:[{amount:150000,profit:-2000}]});assert.equal(partial.lines[0].profit,-2000);
});
function bridgeHarness() {
  const properties=new Map(),records=new Map(),logs=[];
  const makeSheet=(name,start,width)=>{
    const cells=Array.from({length:50},()=>Array(width).fill(''));
    return {cells,getName:()=>name,getLastRow:()=>40,setColumnWidth:()=>{},getRange:(r,c,h=1,w=1)=>({getDisplayValue:()=>name+' 2026',getValues:()=>Array.from({length:h},(_,i)=>cells[r-1+i].slice(c-1,c-1+w)),setValue:value=>{cells[r-1][c-1]=value;},setValues:values=>{assert.equal(values.length,h);values.forEach((row,i)=>{assert.equal(row.length,w);row.forEach((value,j)=>{cells[r-1+i][c-1+j]=value;});});},clearContent:()=>{for(let i=0;i<h;i++)for(let j=0;j<w;j++)cells[r-1+i][c-1+j]='';},clearDataValidations:()=>{}})};
  };
  const month=makeSheet('Enero',10,38),contacts=makeSheet('Clientes de ventas',7,13);
  month.cells[9][1]=1;month.cells[9][3]='2026-01-03';month.cells[9][4]='Clienta local';month.cells[9][9]=150000;month.cells[9][11]='Pagado';month.cells[9][28]='FORMULA_AC_INTACTA';
  contacts.cells[6][1]='CUS1';contacts.cells[6][3]='Clienta local';contacts.cells[6][4]=150000;
  const context=gsHarness([]).context;
  context.tintinProductsSpreadsheet_=()=>({getId:()=> '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U',getSheetByName:name=>name==='Enero'?month:name==='Clientes de ventas'?contacts:null});
  context.PropertiesService={getDocumentProperties:()=>({getProperty:key=>properties.get(key),getProperties:()=>Object.fromEntries(properties),setProperty:(key,value)=>properties.set(key,value),setProperties:values=>Object.entries(values).forEach(([key,value])=>properties.set(key,value))})};
  context.LockService={getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};context.tintinRecordSyncSafely_=(...args)=>logs.push(args);
  context.tintinLocalCall_=input=>{
    if(input.action==='upsert'){const result=[];for(const entry of input.entries){const old=records.get(entry.id);if(old&&old.version!==entry.baseVersion)throw new Error('Conflicto 409: registro más reciente');const record={...JSON.parse(JSON.stringify(entry)),version:randomUUID()};delete record.baseVersion;records.set(record.id,record);result.push({id:record.id,version:record.version});}return {ok:true,results:result};}
    const all=[...records.values()],sale=all.find(e=>e.kind==='sale'),contact=all.find(e=>e.kind==='customer');return {ok:true,revision:all.map(e=>e.version).join('_'),entries:all.filter(e=>e.kind!=='customer'),contacts:all.filter(e=>e.kind==='customer'),customers:sale?[{...contact,orderCount:1,totalPurchased:sale.total,lastPurchase:sale.occurredOn}]:[],webOrders:[]};
  };
  return {context,month,contacts,records,logs};
}
test('puente completo: panel→Sheets y Sheets→panel conservan fórmulas, valores y versiones',()=>{
  const h=bridgeHarness();h.context.tintinReconciliarComercioLocal_();const stored=[...h.records.values()].find(e=>e.kind==='sale');
  stored.notes='Cambio confirmado desde panel';stored.version=randomUUID();h.context.tintinReconciliarComercioLocal_();
  assert.equal(h.month.cells[9][13],stored.notes);assert.equal(h.month.cells[9][33],stored.version);assert.equal(h.month.cells[9][28],'FORMULA_AC_INTACTA');
  h.month.cells[9][9]=180000;h.context.tintinReconciliarComercioLocal_();assert.equal(h.records.get(stored.id).total,180000);assert.equal(h.contacts.cells[6][4],180000);
});
test('conflicto de edición simultánea conserva la edición de Sheets y no aplica un snapshot destructivo',()=>{
  const h=bridgeHarness();h.context.tintinReconciliarComercioLocal_();const stored=[...h.records.values()].find(e=>e.kind==='sale');stored.notes='Nota reciente del panel';stored.version=randomUUID();h.month.cells[9][13]='Edición pendiente de Sheets';
  assert.throws(()=>h.context.tintinReconciliarComercioLocal_(),/Conflicto 409/);assert.equal(h.month.cells[9][13],'Edición pendiente de Sheets');assert.equal(h.records.get(stored.id).notes,'Nota reciente del panel');
});
test('un pedido nuevo con dos líneas ocupa dos filas y conserva el total completo',()=>{
  const h=bridgeHarness();h.context.tintinReconciliarComercioLocal_();const entry={...sale(),id:'LOCAL_new_two_lines',orderCode:'2',total:110000,version:randomUUID(),lines:[{amount:50000},{amount:60000}]};h.records.set(entry.id,entry);h.context.tintinReconciliarComercioLocal_();
  const rows=h.month.cells.filter(row=>row[32]===entry.id);assert.equal(rows.length,2);assert.equal(rows.reduce((n,row)=>n+Number(row[9]),0),110000);assert.equal(rows[0][17],110000);
});
test('el importe del pedido incluye envío sin cambiar la venta histórica de artículos',async()=>{
  const h=memory(),entry={...sale(),shippingCost:25000};await upsertLocalEntries({}, {action:'upsert',entries:[entry]}, {},h.deps);const order=decodeFirestoreFields(h.docs.get('orders/'+entry.id).fields);assert.equal(order.subtotal,150000);assert.equal(order.total,175000);assert.equal(order.shippingCost,25000);
});
test('textos externos de ventas y contactos se escriben como literales, sin ejecutar fórmulas',()=>{
  const h=bridgeHarness();h.context.tintinLocalApplySnapshot_({entries:[{...sale(),version:'literal-v1',notes:'=SUM(1,2)',lines:[{amount:150000,detail:'=1+1'}]}],customers:[{id:'CUS_LOCAL_literal',name:'=1+1',notes:'=SUM(1,2)',orderCount:1,totalPurchased:150000}],webOrders:[]});
  assert.equal(h.month.cells[10][5],"'=1+1");assert.equal(h.month.cells[10][13],"'=SUM(1,2)");
  assert.equal(h.contacts.cells[6][3],"'=1+1");assert.equal(h.contacts.cells[6][10],"'=SUM(1,2)");
  assert.equal(h.month.cells[10][9],150000);assert.equal(h.month.cells[9][28],'FORMULA_AC_INTACTA');
});
