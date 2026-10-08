import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../js/pages/profile/pedidos-perfil.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');const context={console};vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('export function createProfileOrdersController')),context);
test('historial usa importes y datos fiscales guardados sin consultar el catálogo',()=>{
 context.order={id:'order-1',subtotal:100000,shippingCost:0,coupon:{shippingDiscount:25000},total:100000,items:[{name:'Antes <real>',price:50000,qty:2}],invoice:{wanted:true,taxpayerType:'fisica',razonSocial:'Cliente <fiscal>',ruc:'1234567-8'}};
 const html=vm.runInContext('orderMarkup(order)',context);assert.match(html,/Antes &lt;real&gt;/);assert.match(html,/Cliente &lt;fiscal&gt;/);assert.match(html,/Persona física/);assert.match(html,/Descuento de envío/);assert.match(html,/25[.,]000/);assert.match(html,/100[.,]000/);
 context.order={id:'legacy',total:5000,invoice:{wanted:true,razonSocial:'Legado',ruc:'123-4'}};const legacy=vm.runInContext('orderMarkup(order)',context);assert.match(legacy,/No registrado/);assert.match(legacy,/Tipo no registrado/);
});
