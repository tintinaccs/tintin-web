import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8');
const createSource=source.slice(source.indexOf('  async function createOrderOnServer('),source.indexOf('  const SHIPPING_LABELS'));
const submitSource=source.slice(source.indexOf('  async function submit('),source.indexOf("  window.addEventListener('tintin:paypal-payment-completed'"));
const error=(code,_message,details={})=>Object.assign(Error(code),{code,details:{code,...details}});
const valid={ok:true,orderId:'uid_request_fixture',order:{shortId:'TINPED100',userId:'uid',items:[{id:'p',qty:1,price:100}],total:100}};
test('respuesta incompleta con ok:true no confirma ni vacía el carrito ni cambia requestId',async()=>{
 for(const response of [{ok:true},{ok:true,orderId:'uid_request_fixture'}, {...valid,order:[]},{...valid,order:{...valid.order,items:[]}},{...valid,order:{...valid.order,total:NaN}},{...valid,order:{...valid.order,items:[{}]}},{...valid,order:{...valid.order,shortId:''}}]){
  let clears=0,successes=0,removed=0;const cart=[{id:'p',qty:1}];
  const c=vm.createContext({REQUEST_KEY:"test-request",inMemoryRequestId:"stable_request_fixture",window:{},submitting:false,orderCompleted:false,pendingPaypal:null,availabilityBlocked:false,console:{error(){},warn(){}},hideError(){},showError(){},message:e=>e.message,buildDraft:async()=>({paymentMethod:'transferencia'}),persistCheckoutDefaults:async()=>{},reserveCheckoutGuard:async()=>{},createOrderViaServer:async()=>response,appError:error,getSessionUser:()=>({uid:'uid'}),success:()=>successes++,clearCart:async()=>clears++,sessionStorage:{removeItem:()=>removed++},getCartLocal:()=>cart,setCartLocal:()=>{throw Error('No modificar carrito');}});
  vm.runInContext(createSource+submitSource,c);await c.submit({disabled:false,innerHTML:'',textContent:''});
  assert.equal(successes,0,JSON.stringify(response));assert.equal(clears,0);assert.equal(removed,0);assert.equal(cart.length,1);
 }
});
test('guardia de checkout completado cubre popstate, pageshow BFCache y entrada ya marcada al cargar',()=>{
 const start=source.indexOf("  window.addEventListener('popstate'");const end=source.indexOf('  function message(',start);const guard=source.slice(start,end);
 for(const mode of ['popstate','pageshow','initial','fresh']){
  const handlers={};let exits=0;const c=vm.createContext({window:{TintinCheckoutOrderCompleted:mode==='popstate',history:{state:mode==='initial'?{tintinOrderCompleted:true}:null},location:{replace:path=>{assert.equal(path,'/');exits++;}},addEventListener:(name,fn)=>{handlers[name]=fn;}}});
  vm.runInContext(guard,c);
  if(mode==='popstate')handlers.popstate({state:null});
  if(mode==='pageshow'){c.window.TintinCheckoutOrderCompleted=true;handlers.pageshow?.({persisted:true});}
  assert.equal(exits,mode==='fresh'?0:1,mode);
 }
});

function submitRuntime(responder){
 const cart=[{id:'p',qty:1}];const stats={created:0,cleared:0,shown:0,removed:0,requests:[]};
 const c=vm.createContext({REQUEST_KEY:"test-request",inMemoryRequestId:"stable_request_fixture",window:{},submitting:false,orderCompleted:false,pendingPaypal:null,availabilityBlocked:false,console:{error(){},warn(){}},hideError(){},showError(){},message:e=>e.message,buildDraft:async()=>({paymentMethod:'transferencia',requestId:'stable_request_fixture'}),persistCheckoutDefaults:async()=>{},reserveCheckoutGuard:async()=>{},createOrderViaServer:async draft=>{stats.created++;stats.requests.push(draft.requestId);return responder(stats.created);},appError:error,getSessionUser:()=>({uid:'uid'}),success:()=>stats.shown++,clearCart:async()=>{stats.cleared++;cart.splice(0);},sessionStorage:{removeItem:()=>stats.removed++},getCartLocal:()=>cart,setCartLocal:()=>{throw Error('No alterar carrito durante fallo de red');}});
 vm.runInContext(createSource+submitSource,c);return {c,cart,stats};
}
test('doble clic y reenvío tras confirmar crean una sola operación y transferencia sigue pendiente',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const response={...valid,order:{...valid.order,paymentStatus:'pendiente'}};
 const {c,stats}=submitRuntime(()=>pending);const button={disabled:false,innerHTML:'',textContent:''};
 const first=c.submit(button);await c.submit(button);release(response);await first;await c.submit(button);
 assert.equal(stats.created,1);assert.equal(stats.shown,1);assert.equal(stats.cleared,1);assert.equal(response.order.paymentStatus,'pendiente');
});
test('fallo recuperable conserva carrito e identificador; reintento confirma exactamente una vez',async()=>{
 const {c,cart,stats}=submitRuntime(attempt=>attempt===1?{ok:false,error:'network_error'}:valid);const button={disabled:false,innerHTML:'',textContent:''};
 await c.submit(button);assert.equal(cart.length,1);assert.equal(stats.cleared,0);assert.equal(stats.removed,0);assert.equal(button.disabled,false);
 await c.submit(button);assert.equal(stats.cleared,1);assert.equal(stats.shown,1);assert.deepEqual(stats.requests,['stable_request_fixture','stable_request_fixture']);
});

test('la identidad del intento se cierra al confirmar sin esperar la sincronización remota del carrito',async()=>{
 const {c,stats}=submitRuntime(()=>valid);let release;
 c.clearCart=()=>new Promise(resolve=>{release=resolve;});
 const pending=c.submit({disabled:false,innerHTML:'',textContent:''});
 for(let n=0;n<30 && !release;n++)await Promise.resolve();
 assert.ok(release,'la operación llegó a limpiar el snapshot confirmado');
 try{assert.equal(stats.removed,1,'un pedido confirmado no puede dejar requestId activo mientras espera red');}finally{release();await pending;}
});
