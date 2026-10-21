import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8');
test('el ticket comunica la reserva real sin atribuirla a pedidos antiguos o liberados',()=>{
 for(const state of ['reserved','released','legacy']){
  const target={innerHTML:''};const c=vm.createContext({document:{getElementById:()=>target},formatPrice:String,escapeHtml:v=>String(v??''),SHIPPING_LABELS:{},PAYMENT_LABELS:{}});
  vm.runInContext(source.slice(source.indexOf('  function renderConfirmedOrder('),source.indexOf('  function updateReceiptEmailStatus(')),c);
  c.renderConfirmedOrder({items:[],total:100,subtotal:100,inventoryState:state,...(state==='legacy'?{}:{inventoryPolicy:'reserve-on-checkout'})});
  assert.equal(target.innerHTML.includes('Productos apartados para este pedido'),state==='reserved');
 }
});

test('el renderer no borra la compra por la reducción de stock de su propia reserva',async()=>{
 const html=fs.readFileSync('checkout.html','utf8');
 const c=vm.createContext({window:{TintinCheckoutOrderInFlight:true},sessionCanMakeCheckoutDecision:()=>true});
 vm.runInContext(html.slice(html.indexOf('let lastCartRenderKey'),html.indexOf('function showCkToast')),c);
 await c.renderCart(); // Cualquier lectura de carrito/DOM fallaría: debe conservar la revisión/pago.
});
test('las guardias reales preservan el paso mientras el propio pedido se registra o espera PayPal',()=>{
 const window={TintinCheckoutOrderInFlight:true};
 const hardening=fs.readFileSync('js/pages/checkout/checkout-hardening.js','utf8');
 const reliability=fs.readFileSync('js/pages/checkout/checkout-confiabilidad.js','utf8');
 for(const [text,start,end,call] of [[hardening,'function forceCart(','function syncConfirmCartGuard(','forceCart()'],[reliability,'  function resetVisualStep(','  function ensureCheckoutSurface(','resetVisualStep()']]){
  const c=vm.createContext({window});vm.runInContext(text.slice(text.indexOf(start),text.indexOf(end)),c);vm.runInContext(call,c);
 }
});

test('PayPal conserva una referencia mínima para reanudar el pedido ya reservado',()=>{
 const saved=new Map(),events=[];
 const c=vm.createContext({pendingPaypal:null,window:{dispatchEvent:e=>events.push(e)},sessionStorage:{setItem:(k,v)=>saved.set(k,v)},getSessionUser:()=>({uid:'owner'}),renderConfirmedOrder(){},document:{querySelectorAll:()=>[],getElementById:()=>({style:{setProperty(){}}})},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 vm.runInContext(source.slice(source.indexOf('  function beginPaypalPayment('),source.indexOf('  function updateReceiptEmailStatus(')),c);
 c.beginPaypalPayment({orderId:'public_owner_req',userId:'owner',shortId:'TINPED99',total:100},{paymentMethod:'paypal',address:'No persistir dirección'});
 assert.equal(c.window.TintinCheckoutOrderInFlight,true);
 const receipt=JSON.parse(saved.get('tt_checkout_receipt_v1'));assert.equal(receipt.paymentPending,true);assert.equal(receipt.uid,'owner');assert.equal(receipt.orderId,'public_owner_req');
 assert.deepEqual(Object.keys(receipt).sort(),['orderId','paymentPending','savedAt','uid']);
 assert.equal(events[0].type,'tintin:paypal-order-ready');assert.equal(c.window.TintinPaypalPendingOrder.orderId,'public_owner_req');
});
test('recargar reanuda PayPal del titular; no confirma pago ni duplica reserva y descarta cancelados',async()=>{
 for(const mode of ['pending','paid','canceled','other']){
  let reads=0,paid=0,resumed=0,cleared=0;const removed=[];
  const saved={uid:mode==='other'?'other':'owner',orderId:'public_owner_req',paymentPending:true,savedAt:Date.now()};
  const c=vm.createContext({window:{},recoveredReceiptUid:'',recoveringReceipt:false,orderCompleted:false,REQUEST_KEY:'request-key',inMemoryRequestId:'request-id',console:{warn(){}},sessionStorage:{getItem:()=>JSON.stringify(saved),removeItem:k=>removed.push(k)},getSessionUser:()=>({uid:'owner'}),awaitCartReady:async()=>{},getCartLocal:()=>[{id:'unlimited',qty:1}],db:{},doc:(_db,_col,id)=>id,clearCart:async()=>cleared++,getDocFromServer:async()=>{reads++;return{id:saved.orderId,exists:()=>true,data:()=>({userId:'owner',paymentMethod:'paypal',paymentStatus:mode==='paid'?'pagado':'pendiente',status:mode==='canceled'?'cancelado':'pendiente'})};},success:()=>paid++,beginPaypalPayment:()=>resumed++});
  vm.runInContext(source.slice(source.indexOf('  async function restoreConfirmedReceipt('),source.indexOf("  window.addEventListener('tintin:order-email-result'")),c);
  await c.restoreConfirmedReceipt({uid:'owner',emailVerified:true});
  assert.equal(reads,mode==='other'?0:1);assert.equal(paid,mode==='paid'?1:0);assert.equal(resumed,mode==='pending'?1:0);
  assert.equal(cleared,mode==='paid'?1:0);
  if(mode==='canceled'||mode==='paid')assert.ok(removed.includes('request-key'));
  if(mode==='paid')assert.equal(c.inMemoryRequestId,null);
  assert.equal(c.window.TintinCheckoutReceiptRestoring===true,false);
 }
});
test('submit protege el paso mientras espera al servidor y mantiene la protección al pasar a PayPal',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const c=vm.createContext({window:{},submitting:false,orderCompleted:false,availabilityBlocked:false,pendingPaypal:null,hideError(){},buildDraft:async()=>({paymentMethod:'paypal'}),persistCheckoutDefaults:async()=>{},reserveCheckoutGuard:async()=>{},createOrderOnServer:()=>pending,getSessionUser:()=>({uid:'owner'}),console:{warn(){},error(){}},beginPaypalPayment(result,draft){c.pendingPaypal={result,draft};},document:{getElementById:()=>null}});
 vm.runInContext(source.slice(source.indexOf('  async function submit('),source.indexOf("  window.addEventListener('tintin:paypal-payment-completed'")),c);
 const work=c.submit({disabled:false,innerHTML:'',style:{}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.window.TintinCheckoutOrderInFlight,true);release({orderId:'public_owner_req',userId:'owner'});await work;
 assert.equal(c.window.TintinCheckoutOrderInFlight,true);assert.equal(c.submitting,false);assert.ok(c.pendingPaypal);
});
