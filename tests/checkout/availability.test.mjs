import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCheckoutAvailability } from '../../js/pages/checkout/disponibilidad-checkout.js';

test('sólo retira la opción agotada y conserva el resto del carrito', async () => {
  const items = [{id:'p',variant:'Dorado',qty:1},{id:'p',variant:'Plateado',qty:2},{id:'q',qty:1}];
  const read = async id => id === 'p' ? {stock:2,variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:2}]} : {stock:null};
  const result = await inspectCheckoutAvailability(items, read);
  assert.deepEqual(result.items, items.slice(1));
  assert.equal(result.issues[0].variant, 'Dorado');
  assert.equal(result.issues[0].available, 0);
  assert.equal(items.length,3);
});
test('cuenta stock agregado entre variantes y consulta cada producto una vez', async () => {
  let reads=0;
  const result=await inspectCheckoutAvailability([{id:'p',variant:'6',qty:2},{id:'p',variant:'7',qty:2}],async()=>{reads++;return {stock:3};});
  assert.equal(reads,1);assert.deepEqual(result.items.map(i=>i.qty),[2,1]);assert.equal(result.issues[0].available,1);
});
test('sin conexión no modifica ni convierte un fallo en agotado', async () => {
  const items=[{id:'p',qty:1}];
  await assert.rejects(inspectCheckoutAvailability(items,async()=>{throw Error('offline');}),/offline/);
  assert.equal(items.length,1);
});
test('producto eliminado, inactivo y metadatos inválidos no se ofrecen como comprables',async()=>{
  for(const product of [null,{active:false,stock:2},{stock:0},{stock:4,variantInventory:[]}]){
    const result=await inspectCheckoutAvailability([{id:'p',qty:1}],async()=>product);
    assert.equal(result.items.length,0);assert.equal(result.issues.length,1);
  }
  await assert.rejects(inspectCheckoutAvailability([{id:'p',qty:1}],async()=>({stock:'invalid'})),/invalid_stock/);
});
