import {orderAmounts} from '../../js/orders/importes-pedido.mjs';
import {orderMoneyMarkup} from '../../js/orders/presentacion-importes.mjs';
import {orderCashSummary} from '../../js/orders/caja-pedido.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import { ORDER_LIFECYCLE_LABELS, orderStatusLabel, orderTimeline, customerOrderMessage } from '../../js/orders/ciclo-pedido.mjs';
const source=fs.readFileSync(new URL('../../js/pages/profile/pedidos-perfil.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');const context={orderAmounts,orderCashSummary,orderMoneyMarkup,console,ORDER_LIFECYCLE_LABELS,orderStatusLabel,orderTimeline,customerOrderMessage};vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('export function createProfileOrdersController')),context);
test('historial usa importes y datos fiscales guardados sin consultar el catálogo',()=>{
 context.order={id:'order-1',subtotal:100000,shippingCost:0,coupon:{shippingDiscount:25000},total:100000,items:[{name:'Antes <real>',price:50000,qty:2}],invoice:{wanted:true,taxpayerType:'fisica',razonSocial:'Cliente <fiscal>',ruc:'1234567-8'}};
 const html=vm.runInContext('orderMarkup(order)',context);assert.match(html,/Antes &lt;real&gt;/);assert.match(html,/Cliente &lt;fiscal&gt;/);assert.match(html,/Persona física/);assert.match(html,/Descuento de envío/);assert.match(html,/25[.,]000/);assert.match(html,/100[.,]000/);
 context.order={id:'legacy',total:5000,invoice:{wanted:true,razonSocial:'Legado',ruc:'123-4'}};const legacy=vm.runInContext('orderMarkup(order)',context);assert.match(legacy,/No registrado/);assert.match(legacy,/Tipo no registrado/);
});
test('seguimiento de retiro separa pago parcial, preparación y retiro efectivo',()=>{
 context.order={id:'pickup-qa',status:'listo_retiro',shippingMethod:'retiro',paymentMethod:'transferencia',paymentStatus:'parcial',total:35000,items:[]};
 const html=vm.runInContext('orderMarkup(order)',context);assert.match(html,/Parcialmente pagado/);assert.match(html,/Listo para retirar/);assert.doesNotMatch(html,/Enviados|en camino|fue retirado/);
 context.order.status='entregado';context.order.paymentStatus='pagado';const done=vm.runInContext('orderMarkup(order)',context);assert.match(done,/Retirado/);assert.match(done,/Pagado/);assert.doesNotMatch(done,/Enviados|en camino/);
});

test('perfil muestra seña, saldo y fecha prevista sólo cuando existen y no inventa saldos',()=>{
 context.order={id:'bp-1',status:'confirmado',shippingMethod:'delivery',shippingCost:30000,total:130000,paymentMethod:'transferencia',paymentStatus:'parcial',payment:{depositAmount:50000},estimatedDeliveryAt:'2026-12-05',items:[{name:'Bolso',price:100000,qty:1}]};
 const html=vm.runInContext('orderMarkup(order)',context);
 assert.match(html,/Seña recibida<\/strong>Gs\. 50[.,]000/);assert.match(html,/Saldo a pagar<\/strong>Gs\. 80[.,]000/);assert.match(html,/Fecha prevista<\/strong>05\/12\/2026/);
 context.order={id:'plain',status:'confirmado',total:5000,items:[]};
 const plain=vm.runInContext('orderMarkup(order)',context);assert.doesNotMatch(plain,/Seña recibida|Saldo a pagar|Fecha prevista/);
 context.order={id:'bad-date',total:5000,estimatedDeliveryAt:'<script>',items:[]};
 const badDateHtml=vm.runInContext('orderMarkup(order)',context);assert.doesNotMatch(badDateHtml,/Fecha prevista/);assert.equal(badDateHtml.toLowerCase().includes('<script'),false);
});
