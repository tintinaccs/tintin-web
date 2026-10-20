import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { testOrderNumber, orderDisplayCode, ordersForView } from '../../js/orders/pedidos-prueba.mjs';
import { purchasedCustomers, localCommerceSnapshot } from '../../cloudflare/comercio-local.js';
import { encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
const samples=Array.from({length:27},(_,i)=>({id:`fixture_${i+1}`,orderNumber:`TINPED${String(i+1).padStart(2,'0')}`,userId:'real_customer',userName:'Cliente',status:'entregado',total:i===25?205000:10000,createdAt:'2026-10-19'}));
test('sólo el lote 01–25 se reclasifica; 26 y futuros mantienen código, ID e identidad',()=>{
 const original=structuredClone(samples),shown=ordersForView(samples,true),hidden=ordersForView(samples);
 assert.equal(shown.length,27);assert.equal(hidden.length,2);assert.strictEqual(hidden[0],samples[25]);
 for(let i=0;i<25;i++){assert.equal(testOrderNumber(shown[i]),i+1);assert.equal(shown[i].orderNumber,`TINPEDPRUEBA${String(i+1).padStart(2,'0')}`);assert.equal(shown[i].id,samples[i].id);}
 assert.deepEqual(samples,original);assert.deepEqual(ordersForView(shown),hidden);
 for(const code of ['TINPED26','TINPED27','TINPED250','TINPED2026','LOCAL-TINPED01','TINPED01-extra','TINPED00','TINPED001'])assert.equal(testOrderNumber({orderNumber:code}),null,code);
 assert.equal(testOrderNumber({orderNumber:'TINPED26',shortId:'TINPED01'}),null);
 assert.equal(orderDisplayCode({shortId:'TINPED08'}),'TINPEDPRUEBA08');
});
function statsRuntime(){
 const source=fs.readFileSync(new URL('../../js/core/store/estadisticas-pedidos.js',import.meta.url),'utf8');
 const head=source.slice(source.indexOf('const ZERO_STATS'),source.indexOf('async function getOrdersByField'));
 const calc=source.slice(source.indexOf('export function calculateOrderStats'),source.indexOf('export function buildUserStatsPayload')).replace('export ','');
 const c={ordersForView};vm.createContext(c);vm.runInContext(head+calc,c);return c.calculateOrderStats;
}
test('totales, última compra y perfil ignoran pruebas; la revisión administrativa puede incluirlas',()=>{
 const calculate=statsRuntime();assert.equal(calculate(null).totalOrders,0);const clean=calculate(samples);assert.equal(clean.totalOrders,2);assert.equal(clean.totalSpent,215000);
 assert.equal(calculate(samples.slice(0,25)).lastOrderId,'');assert.equal(calculate(samples,{includeTestOrders:true}).totalOrders,27);
 assert.equal(calculate([...samples,samples[25]]).totalOrders,2);
});
test('compradores derivados no conservan importes ni clientes exclusivamente de prueba',()=>{
 const rows=samples.map((o,i)=>({...o,userId:i<25?'only_test':o.userId}));
 const hidden=purchasedCustomers([],rows),shown=purchasedCustomers([],rows,{includeTestOrders:true});
 assert.equal(hidden.length,1);assert.equal(hidden[0].orderCount,2);assert.equal(hidden[0].totalPurchased,215000);assert.equal(shown.length,2);
});
test('el espejo autenticado aplica el mismo corte sin escrituras y conserva ventas locales',async()=>{
 const rows=[...samples,{id:'local',orderNumber:'LOCAL-2026-10-01',localEntryId:'local',total:7000,status:'historico'}];
 const deps={get:async()=>null,list:async(_env,name)=>name==='orders'?rows.map(o=>({name:`projects/test/databases/(default)/documents/orders/${o.id}`,fields:encodeFirestoreFields(o)})):[],commit:async()=>assert.fail('Ocultar no escribe documentos')};
 const hidden=await localCommerceSnapshot({}, {},deps),shown=await localCommerceSnapshot({}, {includeTestOrders:true},deps);
 assert.equal(hidden.webOrders.length,2);assert.equal(shown.webOrders.length,27);assert.equal(hidden.customers.reduce((n,c)=>n+c.orderCount,0),3);
});
test('preferencia aislada por usuario y rol; los snapshots originales sobreviven a mostrar/ocultar',()=>{
 const src=fs.readFileSync(new URL('../../js/admin/admin-app.js',import.meta.url),'utf8');
 const context={ordersForView,currentRole:'superadmin',currentUser:{uid:'owner'},localStorage:{getItem:key=>context.preferences.get(key)},preferences:new Map()};vm.createContext(context);
 vm.runInContext(src.slice(src.indexOf('let allOrders = [];'),src.indexOf('let adminOrdersUnsubscribe')),context);
 context.records=samples;vm.runInContext('rawAdminOrders=records;projectAdminOrders();',context);
 assert.equal(vm.runInContext('allOrders.length',context),2);
 context.preferences.set('tt-test-orders:owner','show');vm.runInContext('projectAdminOrders()',context);assert.equal(vm.runInContext('allOrders.length',context),27);
 context.currentUser={uid:'other'};vm.runInContext('projectAdminOrders()',context);assert.equal(vm.runInContext('allOrders.length',context),2);
 context.currentUser={uid:'owner'};context.currentRole='viewer';vm.runInContext('projectAdminOrders()',context);assert.equal(vm.runInContext('allOrders.length',context),2);
 assert.equal(samples[0].orderNumber,'TINPED01');
});

test('el controlador real del perfil filtra antes de renderizar y sumar aunque una consulta tardía vuelva a traer pruebas',async()=>{
 const {reconcileAccountOrders}=await import('../../js/pages/profile/estado-canonico-perfil.mjs');
 const source=fs.readFileSync(new URL('../../js/pages/profile/pedidos-perfil.js',import.meta.url),'utf8');
 const callbacks=[],renders=[],stats=[];
 const context={ordersForView,reconcileAccountOrders,calculateOrderStats:statsRuntime(),clean:v=>String(v??'').trim(),timestamp:()=>0};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('export function createProfileOrdersController'),source.indexOf('export function startProfileOrders')).replace('export ',''),context);
 const controller=context.createProfileOrdersController({subscribe:(field,value,next,fail)=>{callbacks.push({next,fail});return()=>{};},render:rows=>renders.push(rows),onStatus(){},onStats:value=>stats.push(value)});
 controller.start({uid:'real_customer',email:'customer@example.test'});callbacks[0].next(samples);callbacks[1].next(samples.slice(0,25));
 assert.deepEqual(Array.from(renders.at(-1),o=>o.id),['fixture_26','fixture_27']);assert.equal(stats.at(-1).totalOrders,2);assert.equal(stats.at(-1).totalSpent,215000);
 controller.start({uid:'other'});callbacks[0].next(samples);assert.equal(renders.at(-1).length,0);assert.equal(controller.orders.length,0);
});
