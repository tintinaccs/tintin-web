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
