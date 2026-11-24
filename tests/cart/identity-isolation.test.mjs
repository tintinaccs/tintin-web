import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../js/components/cart/sincronizacion-carrito.js',import.meta.url),'utf8');
test('salir conserva el carrito de la cuenta sin entregárselo a otra cuenta o invitada',async()=>{
 const saved=new Map([['guest',[{id:'g',qty:1}]],['user-a',[{id:'a',qty:1}]],['user-b',[{id:'b',qty:1}]]]);
 const c=vm.createContext({authGeneration:0,remoteUnsubscribe:null,syncTimer:0,currentUser:null,activeCartKey:'guest',
  GUEST_CART_KEY:'guest',GUEST_ACTIVITY_KEY:'guest-activity',appCheckReady:Promise.resolve(false),
  window:{clearTimeout(){}},resetReady(){},identityReadyResolve(){},readyResolve(){},scheduleGuestExpiry(){},clearGuestExpiryTimer(){},
  setStatus(){},dispatchCartUpdated(){},normalizeCart:rows=>rows,projection:JSON.stringify,cartKeyForUser:user=>'user-'+user.uid,
  rawGet:key=>saved.get(key)||[],rawSet:(key,rows)=>saved.set(key,rows),rawRemove(){},rawStringSet(){},dirtyKey:uid=>'dirty-'+uid,
  addGuestQuantities:(a,b)=>[...a,...b],currentLocalCart:()=>saved.get(c.activeCartKey)||[],writeLocal:rows=>(saved.set(c.activeCartKey,rows),rows)});
 vm.runInContext(source.slice(source.indexOf('  function activateIdentity('),source.indexOf('  function migrateLegacyGuestCart(')),c);
 c.activateIdentity({uid:'a'});await Promise.resolve();await Promise.resolve();
 assert.deepEqual(saved.get('user-a').map(row=>row.id),['a','g']);
 c.activateIdentity(null);assert.equal(c.currentLocalCart().length,0);
 c.activateIdentity({uid:'b'});await Promise.resolve();
 assert.deepEqual(c.currentLocalCart().map(row=>row.id),['b']);
 c.activateIdentity({uid:'a'});await Promise.resolve();
 assert.deepEqual(c.currentLocalCart().map(row=>row.id),['a','g']);
});


function additionFixture({qty=0,items,readStock=async()=>{}}={}) {
 let cart=items || (qty?[{id:'p',lineId:'p',qty,price:100}]:[]);
 const events=[];
 const c=vm.createContext({authGeneration:1,pendingAdds:new Map(),MAX_QTY:99,MAX_CART_LINES:100,CHECKOUT_CART_LINE_LIMIT:60,
  window:{PRODUCTS:[],TintinAnalytics:{track:(name,params)=>events.push({name,params})}},
  normalizeItem:item=>({...item,lineId:item.id}),withCartMutation:fn=>fn(),refreshProductStock:readStock,
  currentLocalCart:()=>cart,stockLimit:()=>150,availableVariantQuantity:()=>150,
  mergeMetadata:()=>({}),writeLocal:rows=>(cart=rows),scheduleRemoteSync(){},showFeedback(){},confirmedAddition(){}});
 vm.runInContext(source.slice(source.indexOf('  async function addToCart('),source.indexOf('  async function removeFromCart(')),c);
 return {c,events,cart:()=>cart};
}

test('una adición pendiente de otra identidad no absorbe la adición de la cuenta actual',async()=>{
 let release;
 const f=additionFixture({readStock:()=>new Promise(resolve=>{release=resolve;})});
 const previous=f.c.addToCart({id:'p',qty:1,price:100});const releasePrevious=release;
 f.c.authGeneration=2;
 const current=f.c.addToCart({id:'p',qty:1,price:100});
 releasePrevious();assert.equal((await previous).reason,'identity_changed');
 assert.notEqual(release,releasePrevious,'la cuenta nueva inicia su propia operación');
 release();assert.equal((await current).changed,true);assert.equal(f.cart()[0].qty,1);
});

test('el carrito deja agregar unidades de una línea existente al alcanzar el límite de checkout', async () => {
 const items=Array.from({length:60},(_,i)=>({id:`p-${i}`,lineId:`p-${i}`,qty:1,price:100}));
 const f=additionFixture({items});
 assert.equal((await f.c.addToCart({id:'producto-nuevo',qty:1,price:100})).reason,'line_limit');
 assert.equal((await f.c.addToCart({id:'p-0',qty:1,price:100})).changed,true);
 assert.equal(f.cart().length,60);
 assert.equal(f.cart()[0].qty,2);
});

for(const [qty,requested,accepted] of [[99,1,0],[80,30,19]])test(`analítica registra solo unidades persistidas: ${qty} + ${requested}`,async()=>{
 const f=additionFixture({qty});const result=await f.c.addToCart({id:'p',qty:requested,price:100});
 assert.equal(result.accepted,accepted);assert.equal(result.changed,accepted>0);
 assert.equal(f.cart()[0].qty,99);assert.equal(f.events.length,accepted?1:0);
 if(accepted)assert.equal(f.events[0].params.quantity,accepted);
});
