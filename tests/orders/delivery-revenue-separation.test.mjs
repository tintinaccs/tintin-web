import test from 'node:test';
import assert from 'node:assert/strict';
import {orderAmounts,orderAmountSummary,sumOrderAmounts} from '../../js/orders/importes-pedido.mjs';
test('pedido actual separa venta, delivery y total sin cambiar el cobro',()=>{
 const order={subtotal:100000,shippingCost:15000,total:115000};
 assert.deepEqual(orderAmounts(order),{products:100000,delivery:15000,total:115000,externalDelivery:false,deliveryPending:false,incomplete:false});
 assert.equal(order.total,115000);assert.match(orderAmountSummary(order),/Productos: Gs\. 100\.000 · Delivery: Gs\. 15\.000 · Total del pedido: Gs\. 115\.000/);
});
test('histórico con total y envío guardados recupera venta sin catálogo ni migración',()=>assert.equal(orderAmounts({total:80000,shipping:{cost:10000}}).products,70000));
test('no inventa ventas ni delivery para un total histórico sin desglose',()=>{
 assert.equal(orderAmounts({total:115000}).products,null);assert.equal(orderAmounts({total:115000}).delivery,null);
 assert.deepEqual(sumOrderAmounts([{total:115000}]),{products:0,delivery:0,unknownProducts:1,unknownDelivery:1});
});
test('retiro, cupón de envío y descuento de productos respetan el neto guardado',()=>{
 assert.equal(orderAmounts({total:100000,shipping:{method:'retiro'}}).products,100000);
 assert.equal(orderAmounts({subtotal:100000,shippingCost:0,total:100000,coupon:{shippingDiscount:15000}}).delivery,0);
 assert.equal(orderAmounts({subtotal:100000,shippingCost:15000,total:105000,discount:10000}).products,90000);
});
test('encomienda externa y precio pendiente no acreditan envío gratis ni ingreso de envío',()=>{
 for(const order of [{subtotal:100000,total:100000,shipping:{method:'encomienda'},shippingCost:0},{subtotal:100000,total:100000,shippingPending:true}]){
 assert.equal(orderAmounts(order).products,100000);assert.equal(orderAmounts(order).delivery,null);
 }
});
test('ventas locales antiguas conservan envío ausente como ausente',()=>{
 const order={subtotal:50000,total:50000,shippingCost:0,localSale:{total:50000,shippingCost:null}};
 assert.equal(orderAmounts(order).products,50000);assert.equal(orderAmounts(order).delivery,null);
});
test('líneas históricas válidas recuperan productos; valores inválidos nunca inflan ingresos',()=>{
 assert.equal(orderAmounts({items:[{price:25000,qty:2}],total:65000}).products,50000);
 assert.equal(orderAmounts({total:100,shippingCost:200}).products,null);
 assert.equal(orderAmounts({total:'bad',shippingCost:-1}).products,null);
 assert.equal(orderAmounts({items:[{price:null,qty:2}],total:65000}).products,null);
});
test('períodos antiguos y actuales suman exclusivamente productos como venta',()=>{
 const sums=sumOrderAmounts([{createdAt:'2024-01-01',total:115000,shippingCost:15000},{createdAt:'2026-11-12',subtotal:200000,total:225000,shippingCost:25000}]);
 assert.equal(sums.products,300000);assert.equal(sums.delivery,40000);assert.equal(sums.unknownProducts,0);
});

import {notificationMoneyBody,createNotificationMoneyReader} from '../../js/components/notifications/importes-notificacion.mjs';
import {buildPushContent} from '../../cloudflare/nucleo-push.js';
import {orderCustomerNotice} from '../../cloudflare/notificaciones-pedido.mjs';
test('push y campana nuevos incluyen ambos importes, sin atribuir delivery a productos',()=>{
 const order={userId:'fixture',subtotal:100000,shippingCost:15000,total:115000};
 for(const type of ['order.created','payment.completed','payment.refunded']){
  const push=buildPushContent({type,orderId:'fixture-order',order,eventId:'fixture-event'});
  assert.match(push.body,/Productos: Gs\. 100\.000/);assert.match(push.body,/Delivery: Gs\. 15\.000/);assert.match(push.body,/Total del pedido: Gs\. 115\.000/);
 }
 const notice=orderCustomerNotice('fixture-order',order,{}, {created:true});
 assert.equal(notice.event.amountBreakdown.products,100000);assert.match(notice.event.body,/Delivery: Gs\. 15\.000/);
});
test('campana histórica oculta monto ambiguo y recupera el desglose sin mutar el aviso',async()=>{
 const notification={orderId:'fixture_order',body:'Nuevo pedido por 115.000 Gs.'};
 assert.doesNotMatch(notificationMoneyBody(notification),/115/);
 let reads=0,changes=0;
 const reader=createNotificationMoneyReader({readOrder:async()=>{reads++;return{subtotal:100000,shippingCost:15000,total:115000};},onChange:()=>changes++});
 reader.body(notification);reader.body(notification);await new Promise(r=>setTimeout(r,0));
 assert.equal(reads,1);assert.equal(changes,1);assert.match(reader.body(notification),/Productos: Gs\. 100\.000/);assert.equal(notification.body,'Nuevo pedido por 115.000 Gs.');
});
test('cambio de cuenta descarta lecturas antiguas y fallos no muestran importes inventados',async()=>{
 let resolve;const reader=createNotificationMoneyReader({readOrder:()=>new Promise(r=>resolve=r),onChange:()=>{}});
 const notification={orderId:'fixture_order',body:'115000'};reader.body(notification);await Promise.resolve();reader.reset();resolve({subtotal:1,total:1,shippingCost:0});await new Promise(r=>setTimeout(r,0));
 assert.doesNotMatch(reader.body(notification),/Gs\. 1/);
 const denied=createNotificationMoneyReader({readOrder:async()=>{throw Error('permission denied');},onChange:()=>{}});denied.body(notification);await new Promise(r=>setTimeout(r,0));assert.match(denied.body(notification),/detalle del pedido/);
});

import {commercePeriodStart,commercePeriodContains,commerceYear} from '../../js/admin/statistics/periodos-comerciales.mjs';
test('rangos de hoy, 7/30 días, 2 años y año histórico usan Paraguay e incluyen datos anteriores',()=>{
 const now=new Date('2026-11-12T15:00:00Z');
 assert.equal(commercePeriodStart(1,now).toISOString(),'2026-11-12T03:00:00.000Z');
 assert.equal(commercePeriodContains(new Date('2026-11-12T02:59:59Z'),{days:1,now}),false);
 assert.equal(commercePeriodContains(new Date('2026-11-12T03:00:00Z'),{days:1,now}),true);
 assert.equal(commercePeriodContains(new Date('2025-01-01T12:00:00Z'),{days:730,now}),true);
 assert.equal(commercePeriodContains(new Date('2023-01-01T12:00:00Z'),{days:730,now}),false);
 assert.equal(commercePeriodContains(new Date('2023-01-01T12:00:00Z'),{days:0,now}),true);
 assert.equal(commercePeriodContains(new Date('2025-01-01T02:00:00Z'),{year:2024,now}),true);
 assert.equal(commerceYear(new Date('2025-01-01T02:00:00Z')),'2024');
 assert.equal(commercePeriodContains(new Date('2027-01-01T12:00:00Z'),{days:0,now}),false);
});

test('cifras mal formadas o vacías permanecen desconocidas, sin aparentar envío gratis',()=>{
 for(const shippingCost of ['  ','15.000','15,000',-1,Number.MAX_SAFE_INTEGER+1])assert.equal(orderAmounts({subtotal:100000,total:115000,shippingCost}).delivery,null);
 assert.equal(orderAmounts({items:[{price:100,qty:2}],total:100,shippingCost:200}).products,null);
});
import {customerEmail,adminEmail} from '../../functions/api/order-email.js';
test('comprobantes de clienta y Tintín conservan cobro pero distinguen venta y envío',()=>{
 const order={userName:'Fixture',items:[],subtotal:100000,shippingCost:15000,total:115000};
 for(const build of [customerEmail,adminEmail]){const mail=build(order,'fixture-order');assert.match(mail.text,/Productos \(sin delivery\): Gs\. 100\.000/);assert.match(mail.text,/Delivery \(aparte\): Gs\. 15\.000/);assert.match(mail.text,/Total del pedido: Gs\. 115\.000/);}
});

test('campana cerrada presenta un texto seguro sin descargar pedidos históricos',async()=>{
 let reads=0;const reader=createNotificationMoneyReader({readOrder:async()=>{reads++;return {subtotal:100000,shippingCost:15000,total:115000};},onChange(){}});
 const item={orderId:'fixture_order',body:'Nuevo pedido por 115000'};
 reader.body(item,{load:false});await new Promise(r=>setTimeout(r,0));assert.equal(reads,0);
 reader.body(item,{load:true});await new Promise(r=>setTimeout(r,0));assert.equal(reads,1);assert.match(reader.body(item,{load:false}),/Productos: Gs\. 100\.000/);
});

import fs from 'node:fs';
test('CSV de clientes distingue desglose incompleto y datos aún no disponibles de importes cero',()=>{
 const source=fs.readFileSync('js/admin/admin-app.js','utf8');
 const code=source.slice(source.indexOf('function userRowsToCsv_('),source.indexOf('window.bulkExportUsers ='));
 const build=new Function('ROLE_LABELS',code+';return userRowsToCsv_;')({});
 const rows=build([{uid:'incomplete',productsSpent:0,deliverySpent:0,unknownProducts:1,unknownDelivery:1},{uid:'loading'}]);
 assert.equal(rows[0][9],'Pedidos sin desglose de productos');assert.equal(rows[0][10],'Pedidos sin importe de delivery');
 assert.deepEqual(rows[1].slice(7,11),[0,0,1,1]);assert.deepEqual(rows[2].slice(7,11),['','','','']);
});
