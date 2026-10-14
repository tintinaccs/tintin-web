import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { variantStockLimit } from '../../js/core/store/inventario-variantes.mjs';
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
