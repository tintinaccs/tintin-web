import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { variantStockLimit, productVariantPrice, stableVariantSelection, variantSelectionLabel } from '../../js/core/store/inventario-variantes.mjs';
const source=fs.readFileSync(new URL('../../js/components/cart/sincronizacion-carrito.js',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(readProduct) {
  const items=[{id:'ring',lineId:'ring-solitario',variant:'solitario',qty:1}];
  let writes=0;
  const c=vm.createContext({window:{TintinProductsStore:{readProduct}},MAX_QTY:99,variantStockLimit,normalizeVariant:v=>v,
    currentLocalCart:()=>items,withCartMutation:fn=>fn(),writeLocal:value=>(writes++,value),scheduleRemoteSync(){},showFeedback(){}});
  vm.runInContext(slice('  const cartStockReads','  async function addToCart')+slice('  async function updateQty','  async function clearCart'),c);
  return {c,items,writes:()=>writes};
}
test('checkout sin catálogo recupera el stock real por ID y limita la variante',async()=>{
  let reads=0;const f=fixture(async()=>{reads++;return {id:'ring',stock:9,variantInventory:[{variant:'solitario',stock:1}]};});
  const result=await f.c.updateQty('ring-solitario',1);
  assert.equal(result.changed,false);assert.equal(f.items[0].qty,1);assert.equal(f.writes(),0);assert.equal(reads,1);
});
test('un fallo de lectura no permite aumentar, pero sí reducir la cantidad',async()=>{
  const f=fixture(async()=>{throw new Error('offline');});f.items[0].qty=2;
  assert.equal((await f.c.updateQty('ring-solitario',1)).reason,'stock_unavailable');
  assert.equal((await f.c.updateQty('ring-solitario',-1)).changed,true);assert.equal(f.items[0].qty,1);
});
test('una variante disponible aumenta sin exceder la suma del inventario',async()=>{
  const f=fixture(async()=>({id:'ring',stock:2,variantInventory:[{variant:'solitario',stock:2}]}));
  assert.equal((await f.c.updateQty('ring-solitario',1)).changed,true);
  assert.equal((await f.c.updateQty('ring-solitario',1)).changed,false);assert.equal(f.items[0].qty,2);
});

test('recorte de stock en tiempo real informa una sola vez y descarta otra identidad',async()=>{
 for(const changeUser of [false,true]){
  let items=[{id:'ring',lineId:'ring',name:'Anillo',qty:1}],serialized=JSON.stringify(items);const jobs=[],events=[];
  const c=vm.createContext({activeCartKey:'user-a',GUEST_CART_KEY:'guest',currentUser:{uid:'a'},normalizeCart:i=>i,enforceStockLimits:()=>[],rawGet:()=>items,rawString:()=>serialized,rawSet:(_,value)=>{items=value;serialized=JSON.stringify(value);},queueMicrotask:fn=>jobs.push(fn),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},window:{dispatchEvent:event=>events.push(event)}});
  vm.runInContext(slice('  function currentLocalCart()','  function writeLocal('),c);
  c.currentLocalCart();c.currentLocalCart();assert.equal(jobs.length,1);
  if(changeUser)c.activeCartKey='user-b';jobs[0]();
  assert.equal(events.length,changeUser?0:1);
  if(!changeUser){assert.equal(events[0].type,'tintin:cart-stock-adjusted');assert.equal(events[0].detail.issues[0].available,0);}
 }
});

test('legacy carts with reordered selections merge one v2 identity and refresh canonical unit price',()=>{
 const product={id:'ring',price:100,variantCommerceVersion:2,variants:{Talle:['M'],Color:['Plateado','Dorado']},variantInventory:[{variant:'Plateado / M',attributes:{Color:'Plateado',Talle:'M'},stock:4,price:150},{variant:'Dorado / M',attributes:{Color:'Dorado',Talle:'M'},stock:null}]};
 const c=vm.createContext({window:{PRODUCTS:[product]},MAX_QTY:99,MAX_CART_LINES:100,productVariantPrice,stableVariantSelection,variantSelectionLabel,sanitizeImageUrl:v=>v});
 vm.runInContext(slice('  function cleanText(', '  function enforceStockLimits('),c);
 const old=[{id:'ring',variant:'Plateado / M',qty:1,price:100},{id:'ring',variant:'M / Plateado',qty:2,price:999}];
 const rows=c.normalizeCart(old);assert.equal(rows.length,1);assert.equal(rows[0].qty,3);assert.equal(rows[0].price,150);
 const again=c.normalizeCart(JSON.parse(JSON.stringify(rows)));assert.equal(again.length,1);assert.equal(again[0].qty,3);assert.equal(again[0].lineId,rows[0].lineId);
});

test('persisted legacy label keeps its original combination when overlapping attributes are reordered',()=>{
 const product={id:'ring',price:100,variantCommerceVersion:2,variants:{Talle:['S','L'],Color:['S','L']},variantInventory:[{variant:'S / L',attributes:{Color:'S',Talle:'L'},stock:1,price:150},{variant:'L / S',attributes:{Color:'L',Talle:'S'},stock:1,price:200}]};
 const c=vm.createContext({window:{PRODUCTS:[product]},MAX_QTY:99,MAX_CART_LINES:100,productVariantPrice,stableVariantSelection,variantSelectionLabel,sanitizeImageUrl:v=>v});
 vm.runInContext(slice('  function cleanText(', '  function enforceStockLimits('),c);
 const [row]=c.normalizeCart([{id:'ring',variant:'S / L',qty:1,price:100}]);
 assert.equal(row.variantKey,'S / L');assert.equal(row.variant,'L / S');assert.equal(row.price,150);
 assert.equal(c.normalizeCart([row])[0].lineId,row.lineId);
});

test('legacy identities remain distinct by product and option with the original line ID contract',()=>{
 const c=vm.createContext({window:{PRODUCTS:[]},MAX_QTY:99,MAX_CART_LINES:100,sanitizeImageUrl:v=>v});
 vm.runInContext(slice('  function cleanText(', '  function enforceStockLimits('),c);
 const rows=c.normalizeCart([{id:'a',variant:'Plateado',qty:1},{id:'a',variant:'Dorado',qty:1},{id:'b',variant:'Plateado',qty:1}]);
 assert.equal(rows.length,3);
 assert.equal(new Set(rows.map(row=>row.lineId)).size,3);
 for(const row of rows) assert.equal(row.lineId,c.lineIdFor({id:row.id,variant:row.variant}));
});

test('clave de carrito V2 no cambia al salir de una página que tiene el catálogo cargado',()=>{
 const product={id:'p',price:100,variantCommerceVersion:2,variants:{Color:['Dorado']},variantInventory:[{variant:'stable-gold',stock:2,attributes:{Color:'Dorado'}}]};
 const c=vm.createContext({window:{PRODUCTS:[product]},stableVariantSelection});
 vm.runInContext(slice('  function cleanText(', '  function normalizeItem('),c);
 const item={id:'p',variant:'Dorado',variantKey:'stable-gold'};const before=c.lineIdFor(item);c.window.PRODUCTS=[];
 assert.equal(c.lineIdFor(item),before);assert.notEqual(c.lineIdFor({...item,variantKey:'stable-other'}),before);
});

test('limpiar compra confirmada conserva nuevas líneas y cantidades agregadas durante la solicitud',async()=>{
 let cart=[{id:'p',lineId:'p-gold',qty:3},{id:'p',lineId:'p-silver',qty:1},{id:'q',lineId:'q',qty:1}];
 const c=vm.createContext({authGeneration:1,withCartMutation:fn=>fn(),normalizeCart:rows=>rows,currentLocalCart:()=>cart,writeLocal:rows=>(cart=rows),scheduleRemoteSync(){},flushCartSync:async()=>{}});
 vm.runInContext(slice('  async function clearCart(', '  function getCartLocal('),c);
 await c.clearCart([{id:'p',lineId:'p-gold',qty:2}]);
 assert.deepEqual(JSON.parse(JSON.stringify(cart)),[{id:'p',lineId:'p-gold',qty:1},{id:'p',lineId:'p-silver',qty:1},{id:'q',lineId:'q',qty:1}]);
 await c.clearCart();assert.deepEqual([...cart],[],'Vaciar carrito explícito conserva su comportamiento');
});

test('una limpieza encolada por la cuenta anterior no modifica el carrito de la nueva sesión',async()=>{
 let run,writes=0,flushes=0;
 const c=vm.createContext({authGeneration:1,withCartMutation:fn=>new Promise(resolve=>{run=()=>resolve(fn());}),normalizeCart:rows=>rows,currentLocalCart:()=>[{id:'p',lineId:'p',qty:1}],writeLocal:()=>writes++,scheduleRemoteSync(){},flushCartSync:async()=>flushes++});
 vm.runInContext(slice('  async function clearCart(', '  function getCartLocal('),c);
 const pending=c.clearCart([{id:'p',lineId:'p',qty:1}]);c.authGeneration=2;run();await pending;
 assert.equal(writes,0);assert.equal(flushes,0);
});
