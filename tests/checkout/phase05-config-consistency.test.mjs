import {configuredShippingPrice} from '../../js/components/location/tarifas-delivery.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizePaymentCatalog} from '../../js/orders/nucleo-metodos-pago.js';
import {aggregateCheckoutCart} from '../../js/orders/politica-checkout.js';
const page=fs.readFileSync('checkout.html','utf8');
test('catálogo de pagos explícitamente vacío o inválido nunca reactiva métodos legacy',()=>{
 for(const paymentMethodsCatalog of [{},[],null,'invalid',{bad:null}])assert.deepEqual(normalizePaymentCatalog({paymentMethodsCatalog,paymentMethods:{efectivo:true,transferencia:true}}),[]);
 assert.equal(normalizePaymentCatalog({}).length,2,'compatibilidad sólo cuando el catálogo todavía no existe');
});
test('cantidades explícitas cero no se convierten en una compra de una unidad',()=>{
 for(const qty of [0,-1,1.5,100,NaN])assert.throws(()=>aggregateCheckoutCart([{id:'fixture',qty}]),error=>error.code==='invalid_cart');
 assert.equal(aggregateCheckoutCart([{id:'fixture',qty:1}])[0].qty,1);
});
test('configuración parcial de tarifas conserva cada campo canónico y permite envío cero',()=>{
 const context=vm.createContext({_shipRatesReal:{deliveryCities:['Asunción'],deliveryCost:0},_shipRatesFallback:{encomiendaCities:['Encarnación'],encomiendaCost:25000},DEFAULT_DELIVERY_COST:15000,DEFAULT_ENCOMIENDA_COST:25000,configuredShippingPrice,canonicalDeliveryCities:rows=>rows,normalizeCities:(rows,cost)=>(rows||[]).map(name=>({name,price:cost})),populateCities(){}});
 vm.runInContext(page.slice(page.indexOf('function applyShippingRates_()'),page.indexOf('function subscribeStoreConfig()')),context);
 context.applyShippingRates_();
 assert.equal(context.DELIVERY_CITIES[0].price,0);
 assert.equal(context.ENCOMIENDA_CITIES[0].name,'Encarnación');
});
test('Retiro existente sigue accesible en Central sin inventar ciudades para delivery o encomienda',()=>{
 const context=vm.createContext({DELIVERY_CITIES:[],ENCOMIENDA_CITIES:[],shippingDepartment:()=>{throw Error('No debe inventar una ciudad');}});
 vm.runInContext(page.slice(page.indexOf('function departamentosDisponibles()'),page.indexOf('// Se puede llamar más de una vez')),context);
 assert.deepEqual([...context.departamentosDisponibles()],['Central']);
});

test('una lectura de pagos atrasada no reactiva un método deshabilitado después',async()=>{
 const source=fs.readFileSync('js/pages/checkout/checkout-metodos-pago.js','utf8');
 const pending=[],rendered=[];let callback;
 const c=vm.createContext({settingsRevision:0,onPublicSettings:fn=>{callback=fn;},normalizePaymentCatalog,paypalAvailability:()=>new Promise(resolve=>pending.push(resolve)),render:methods=>rendered.push(methods)});
 vm.runInContext(source.slice(source.indexOf('  onPublicSettings(async settings => {'),source.indexOf('\n}\n\nif (document.readyState')),c);
 const old=callback({paymentMethodsCatalog:{cash:{kind:'efectivo',enabled:true}},paypal:{enabled:false}});
 const latest=callback({paymentMethodsCatalog:{},paypal:{enabled:false}});
 pending[1](null);await latest;pending[0](null);await old;
 assert.equal(rendered.at(-1).length,0);assert.equal(rendered.length,1);
});
