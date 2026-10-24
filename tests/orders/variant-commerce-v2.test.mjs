import test from 'node:test';
import assert from 'node:assert/strict';
import { variantInventoryEntries, variantStockLimit, applyVariantInventoryDeltas, productVariantPrice, productStockTotal, stableVariantSelection, assertVariantCompatibility } from '../../js/core/store/inventario-variantes.mjs';
import { productVariantImage } from '../../js/components/images/foto-variante.mjs';
export const product = () => ({ price:50000, priceBefore:60000, stock:3, active:true, variantCommerceVersion:2,
  variants:{Color:['Plateado','Dorado'],Talle:['M']},
  variantInventory:[{variant:'Plateado / M',attributes:{Color:'Plateado',Talle:'M'},stock:2,price:70000,priceBefore:80000},
    {variant:'Dorado / M',attributes:{Color:'Dorado',Talle:'M'},stock:1}],
  variantMedia:[{Color:'Plateado',Talle:'M',imageUrl:'https://example.invalid/silver.png'},{Color:'Dorado',imageUrl:'https://example.invalid/gold.png'}] });
test('version 1 and products without variants retain aggregate price and inventory',()=>{
 assert.deepEqual(productVariantPrice({price:100,priceBefore:120}),{price:100,priceBefore:120});
 assert.equal(productStockTotal({stock:null}),null);assert.equal(productStockTotal({stock:0}),0);
 assert.equal(variantStockLimit({price:100},''),null);
});
test('v2 price override, fallback, discount and selection permutation share identity',()=>{
 const p=product(); assert.deepEqual(productVariantPrice(p,'M / Plateado'),{price:70000,priceBefore:80000});
 assert.deepEqual(productVariantPrice(p,'Dorado / M'),{price:50000,priceBefore:60000});
 p.variantInventory[1].priceBefore=null;assert.equal(productVariantPrice(p,'Dorado / M').priceBefore,null);
 delete p.variantInventory[0].priceBefore;
 assert.deepEqual(productVariantPrice(p,'Plateado / M'),{price:70000,priceBefore:null});
 for(const price of [0,-1,1.5,NaN,Infinity,'70000']){p.variantInventory[0].price=price;assert.throws(()=>productVariantPrice(p,'Plateado / M'));}
});
test('zero and untracked combinations are distinct; aggregate comes from matrix',()=>{
 const p=product();p.stock=999;p.variantInventory[0].stock=0;p.variantInventory[1].stock=null;
 assert.equal(productStockTotal(p),null);assert.equal(variantStockLimit(p,'Plateado / M'),0);assert.equal(variantStockLimit(p,'Dorado / M'),null);
 const next=applyVariantInventoryDeltas(p,[{variant:'Dorado / M',qty:99}]);assert.equal(next[1].stock,null);
 p.variantInventory[1].stock=3;assert.equal(productStockTotal(p),3);
});
test('reordering keeps prices, stock, explicit photos and historical reserve key',()=>{
 const p=product(),after={...p,variants:{Talle:['M'],Color:['Dorado','Plateado']}};
 assertVariantCompatibility(p,after);
 assert.equal(stableVariantSelection(after,'M / Plateado'),'Plateado / M');
 assert.equal(productVariantPrice(after,'M / Plateado').price,70000);
 assert.equal(variantStockLimit(after,'M / Plateado'),2);
 assert.equal(productVariantImage(after,'M / Plateado'),'https://example.invalid/silver.png');
 const next=applyVariantInventoryDeltas(after,[{variant:'M / Plateado',qty:1}]);
 assert.equal(next[0].stock,1);assert.equal(next[0].price,70000);assert.deepEqual(next[0].attributes,{Color:'Plateado',Talle:'M'});
 const restored=applyVariantInventoryDeltas({...after,variantInventory:next},[{variant:'Plateado / M',qty:-1}]);assert.equal(restored[0].stock,2);
});
test('commercial combinations cannot be removed, downgraded or duplicated',()=>{
 const p=product();assert.throws(()=>assertVariantCompatibility(p,{...p,variantCommerceVersion:undefined}));
 assert.throws(()=>assertVariantCompatibility(p,{...p,variantInventory:[p.variantInventory[0]]}));
 assert.throws(()=>variantInventoryEntries({...p,variantInventory:[p.variantInventory[0],{...p.variantInventory[0],variant:'other'}]}));
 assert.throws(()=>productVariantPrice(p,'Z / Plateado'));
 p.variantInventory[0].active=false;assert.equal(variantStockLimit(p,'Plateado / M'),0);
 assert.throws(()=>applyVariantInventoryDeltas(p,[{variant:'Plateado / M',qty:1}]));
 assert.equal(applyVariantInventoryDeltas(p,[{variant:'Plateado / M',qty:-1}])[0].stock,3);
});

import { buildCatalogProductFromImport } from '../../js/core/store/shopify-import-core.mjs';
import { productBulkPatch,productDuplicateData } from '../../js/admin/products/maestro-productos-core.mjs';
test('import opt-in preserves combination prices/photos/mixed stock without enabling existing pipeline',()=>{
 const input={name:'Import fixture',price:100,stock:null,variants:[{Color:'Plateado',price:150,stock:1,imageUrl:'https://example.invalid/silver.png'},{Color:'Dorado',price:200,stock:null,imageUrl:'https://example.invalid/gold.png'}]};
 const old=buildCatalogProductFromImport(input);assert.equal(old.variantCommerceVersion,undefined);
 const next=buildCatalogProductFromImport(input,{variantCommerce:true});assert.equal(next.variantCommerceVersion,2);assert.equal(next.stock,null);
 assert.equal(productVariantPrice(next,'Plateado').price,150);assert.match(productVariantImage(next,'Dorado'),/gold/);
 assert.throws(()=>productBulkPatch(next,'stock',10));const copy=productDuplicateData(next);assert.equal(copy.active,false);assert.equal(copy.stock,0);assert.equal(copy.variantInventory[0].price,next.variantInventory[0].price);assert.deepEqual(copy.variantInventory[0].attributes,next.variantInventory[0].attributes);
});

import {reorderVariantInventory} from '../../js/core/store/inventario-variantes.mjs';
test('draft ordering preserves each legacy quantity and reference without zeroing stock',()=>{
 const p={variants:{Color:['Plateado','Dorado'],Talle:['M']},variantInventory:[{variant:'Plateado / M',stock:2},{variant:'Dorado / M',stock:0}]};
 const reordered=reorderVariantInventory(p,{Talle:['M'],Color:['Dorado','Plateado']});
 assert.equal(reordered[0].variant,'Dorado / M');assert.equal(reordered[1].variant,'Plateado / M');assert.equal(reordered[1].stock,2);
 assert.throws(()=>reorderVariantInventory(p,{Color:['Plateado'],Talle:['M']}),/historial/);
});
