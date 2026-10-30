import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createOrderAdmin } from '../../cloudflare/order-admin-domain.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { recordOrderEmailDelivery } from '../../functions/api/order-email.js';
const read = path => fs.readFileSync(path, 'utf8');
const secure = read('js/orders/pedido-checkout-seguro.js');
const quiet = { warn() {}, error() {} };
const document = data => ({fields:encodeFirestoreFields(data),updateTime:'v1'});

test('a committed order survives catalog deletion or deactivation without another write', async () => {
  for (const product of [null, document({active:false,price:100})]) {
    let writes=0;
    const result=await createOrderAdmin({}, {orderId:'public_uid_req',userName:'Cliente Test',items:[{id:'p',qty:1,price:100}]},{}, {
      get:async(_,path)=>path.startsWith('products/')?product:path==='orders/public_uid_req'?document({shortId:'TINPED01',userId:'uid'}):null,
      commit:async()=>{writes++;throw Error('Unexpected write');},findFirst:async()=>null,maxNumber:async()=>0,
    });
    assert.equal(result.duplicate,true);assert.equal(result.shortId,'TINPED01');assert.equal(writes,0);
  }
});

test('out-of-stock response changes only the exhausted variant through the actual submit handler',async()=>{
  let cart=[{id:'p',variant:'Dorado',qty:2},{id:'p',variant:'Plateado',qty:1}];
  const context=vm.createContext({submitting:false,orderCompleted:false,availabilityBlocked:false,pendingPaypal:null,window:{},showCheckoutAvailabilityDialog(){},console:quiet,document:{getElementById:()=>null},hideError(){},showError(){},buildDraft:async()=>({paymentMethod:'transferencia'}),persistCheckoutDefaults:async()=>{},reserveCheckoutGuard:async()=>{},createOrderViaServer:async()=>({ok:false,error:'insufficient_stock',productId:'p',variant:'Dorado',available:0}),appError:(code,_,details)=>Object.assign(Error(code),{details:{code,...details}}),getCartLocal:()=>cart,setCartLocal:items=>{cart=items;}});
  vm.runInContext(secure.slice(secure.indexOf('  async function createOrderOnServer('),secure.indexOf('  const SHIPPING_LABELS'))+secure.slice(secure.indexOf('  async function submit('),secure.indexOf("  window.addEventListener('tintin:paypal-payment-completed'")),context);
  await context.submit({disabled:false,textContent:'',innerHTML:''});
  assert.equal(cart.length,1);assert.equal(cart[0].variant,'Plateado');assert.equal(cart[0].qty,1);
});

test('email recovery finds the canonical order directly beyond any historical query limit',async()=>{
  const source=read('js/pages/checkout/checkout-puente-correo.js');let fallback=0;
  const context=vm.createContext({capturedRequestId:'req',db:{},doc:(_db,_col,id)=>id,getDoc:async id=>({id,exists:()=>id==='public_uid_req',data:()=>({userId:'uid',requestId:'req'})}),getDocs:async()=>{fallback++;throw Error('Historical scan not expected');}});
  vm.runInContext(source.slice(source.indexOf('  async function findCreatedOrder('),source.indexOf('  function dispatchSafePurchase(')),context);
  assert.equal((await context.findCreatedOrder({uid:'uid'},'TINPED101')).id,'public_uid_req');assert.equal(fallback,0);
});

test('draft restoration rejects another user, unscoped legacy data and expired data',()=>{
  const source=read('js/pages/checkout/estado-navegacion-checkout.js');
  class Input {constructor(){this.value='';this.type='text';this.tagName='INPUT';}dispatchEvent(){}}
  for(const saved of [{version:1,fields:{'ck-ci':{value:'1234567'}}},{version:2,uid:'other',savedAt:Date.now(),fields:{'ck-ci':{value:'1234567'}}},{version:2,uid:'current',savedAt:1,fields:{'ck-ci':{value:'1234567'}}},{version:2,uid:'current',savedAt:Date.now(),fields:{'ck-ci':{value:'1234567'}}}]){
    let cleared=false;const input=new Input();
    const context=vm.createContext({window:{TintinCheckoutIdentityUid:'current'},sessionStorage:{getItem:()=>JSON.stringify(saved)},document:{getElementById:id=>id==='ck-ci'?input:null},HTMLInputElement:Input,HTMLSelectElement:class{},Event:class{},clearCheckoutState:()=>{cleared=true;}});
    vm.runInContext(source.slice(0,source.indexOf('function scheduleRestore()')),context);context.restoreDraft();
    const valid=saved.version===2&&saved.uid==='current'&&saved.savedAt>1;
    assert.equal(input.value,valid?'1234567':'');assert.equal(cleared,!valid);
  }
});

test('delivery metadata preserves sent channels and retries an optimistic conflict',async()=>{
  let attempts=0;let fields;
  const result={adminSent:null,customerSent:true,error:''};
  await recordOrderEmailDelivery({},'public_uid_req',result,{
    get:async(_,path)=>path.startsWith('orders/')?document({notificationAdminSent:true}):null,
    merge:async(_,path,incoming,options)=>{assert.equal(options.updateTime,'v1');if(attempts++===0)throw Object.assign(Error('Conflict'),{code:'version_conflict'});fields=decodeFirestoreFields(incoming);},
  });
  assert.equal(attempts,2);assert.equal(fields.notificationStatus,'sent');assert.equal(fields.notificationError,'');
});

test('order response starts push before the email queue and waits for neither delivery',async()=>{
  const source=read('functions/api/apps-script-bridge.js');const events=[];const jobs=[];let release;
  const delivery=new Promise(resolve=>{release=resolve;});
  const context=vm.createContext({created:{orderId:'public_uid_req',duplicate:false,order:{notificationStatus:'pending'}},env:{RESEND_API_KEY:'test-only'},context:{waitUntil:job=>jobs.push(job)},dispatchOrderPushEvent:async()=>{events.push('push');await delivery;return {ok:true};},recordPushFailure:async()=>{throw Error('Unexpected push failure');},queuePendingOrderEmail:async()=>{events.push('queued');},sendOrderEmails:async()=>{events.push('sending');await delivery;return {success:true};},console:quiet});
  const block=source.slice(source.indexOf('      const emailStatus ='),source.indexOf('        context.waitUntil?.(syncOrderOwnerStats'));
  vm.runInContext('async function run(){'+block+'} return emailStatus;}',context);
  assert.equal(await context.run(),'pending');assert.deepEqual(events,['push','queued','sending']);assert.equal(jobs.length,2);release();await Promise.all(jobs);
});


test('receipt recovery reads only its owner, skips a fresh cart and releases offline guards',async()=>{
  const fn=secure.slice(secure.indexOf('  async function restoreConfirmedReceipt('),secure.indexOf("  window.addEventListener('tintin:order-email-result'"));
  for(const mode of ['restore','other-user','new-cart','offline']){
    let reads=0,shown=0;const saved={uid:mode==='other-user'?'other':'uid',orderId:'public_uid_req',savedAt:Date.now()};
    const context=vm.createContext({window:{},sessionStorage:{getItem:()=>JSON.stringify(saved),removeItem(){}},recoveredReceiptUid:'',recoveringReceipt:false,orderCompleted:false,console:quiet,getSessionUser:()=>({uid:'uid'}),awaitCartReady:async()=>{},getCartLocal:()=>mode==='new-cart'?[{id:'new'}]:[],db:{},doc:(_db,_col,id)=>id,getDoc:async()=>{reads++;if(mode==='offline')throw Error('offline');return {exists:()=>true,id:saved.orderId,data:()=>({userId:'uid',shortId:'TINPED01',shipping:{}})};},success:()=>shown++});
    vm.runInContext(fn,context);await context.restoreConfirmedReceipt({uid:'uid',emailVerified:true});
    assert.equal(shown,mode==='restore'?1:0);assert.equal(reads,mode==='restore'||mode==='offline'?1:0);assert.equal(context.window.TintinCheckoutReceiptRestoring===true,false);
  }
});
