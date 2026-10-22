import test from 'node:test';
import assert from 'node:assert/strict';
import {productFingerprint,productBulkPatch,productBulkIds,applyProductBulkTransaction,productDuplicateData} from '../../js/admin/products/maestro-productos-core.mjs';
import {mergeSelectedOrderProducts} from '../../js/admin/orders/seleccion-productos-pedido.mjs';
const product={name:'Anillo',sku:'A1',category:'anillos',price:30000,priceBefore:35000,stock:4,active:true,oferta:false};
const collections=[{slug:'anillos',name:'Anillos'}];
for(const [field,value,patch] of [['price',40000,{price:40000,priceBefore:null}],['pricePercent',-10,{price:27000}],['priceBefore','',{priceBefore:null}],['stock',0,{stock:0}],['stock','',{stock:null}],['stockDelta',-2,{stock:2}],['category','anillos',{category:'anillos'}],['active',false,{active:false}],['oferta',true,{oferta:true}],['destacado',true,{destacado:true}],['badge','Nuevo',{badge:'Nuevo'}],['tags','oro, regalo, oro',{tags:['oro','regalo']}]] ){
 test(`lote ${field}: resultado y separación del resto de campos`,()=>{const before=structuredClone(product);assert.deepEqual(productBulkPatch(product,field,value,collections),patch);assert.deepEqual(product,before);});
}
test('validación estricta rechaza números infinitos, fracciones, precios cero y categorías ausentes',()=>{
 for(const [field,value] of [['price',true],['stock',[2]],['stock',' '],['price',0],['price',Infinity],['price',1.5],['stock',-1],['stock',NaN],['stockDelta',-5],['category','borrada'],['active','false'],['badge','<script>'],['unknown',1],['priceBefore',1000],['tags',Array(31).fill('x').map((v,i)=>v+i).join(',')]])assert.throws(()=>productBulkPatch(product,field,value,collections));
 assert.throws(()=>productBulkPatch({...product,stock:null},'stockDelta',1));
 assert.throws(()=>productBulkPatch({...product,variantInventory:[{variant:'Oro',stock:4}]},'stock',5));
});
test('30 IDs explícitos; no acepta rutas ni duplicados ni selección vacía',()=>{
 assert.equal(productBulkIds(Array.from({length:30},(_,i)=>String(i))).length,30);
 for(const ids of [[],['x','x'],['a/b'],Array.from({length:31},(_,i)=>String(i)),[null]])assert.throws(()=>productBulkIds(ids));
});
test('huella detecta cambios de stock y contenido, conserva igualdad por orden de claves y omite metadatos ajenos',()=>{
 assert.equal(productFingerprint(product),productFingerprint({...product,updatedAt:'nueva',costUnit:99,_docId:'p'}));
 assert.equal(productFingerprint({variants:{Color:['Oro'],Material:['Acero']}}),productFingerprint({variants:{Material:['Acero'],Color:['Oro']}}));
 assert.notEqual(productFingerprint(product),productFingerprint({...product,stock:3}));
});
function transactionFor(rows){const updates=[],reads=[];return {updates,reads,async get(id){reads.push(id);return {exists:()=>Object.hasOwn(rows,id),data:()=>structuredClone(rows[id])};},update(id,patch){assert.equal(reads.length,2);updates.push([id,patch]);}};}
test('transacción sólo escribe después de leer y validar el lote entero',async()=>{
 const rows={a:product,b:{...product,stock:2}},tx=transactionFor(rows);
 const result=await applyProductBulkTransaction(tx,{ids:['a','b'],field:'stockDelta',value:2,expected:{a:productFingerprint(rows.a),b:productFingerprint(rows.b)}},collections,id=>id,()=>123);
 assert.deepEqual(tx.updates,[['a',{stock:6,updatedAt:123,restockedAt:123}],['b',{stock:4,updatedAt:123,restockedAt:123}]]);assert.equal(result.length,2);
});

test('un lote comercial registra su fecha sin convertirlo en reposición',async()=>{
 const rows={a:product,b:{...product,price:20000}},tx=transactionFor(rows);
 await applyProductBulkTransaction(tx,{ids:['a','b'],field:'destacado',value:true,expected:{a:productFingerprint(rows.a),b:productFingerprint(rows.b)}},collections,id=>id,()=>456);
 assert.deepEqual(tx.updates,[['a',{destacado:true,updatedAt:456,merchandisingUpdatedAt:456}],['b',{destacado:true,updatedAt:456,merchandisingUpdatedAt:456}]]);
});
test('cambio concurrente, borrado o variante invalidan todo el lote sin escrituras parciales',async()=>{
 for(const rows of [{a:product,b:{...product,stock:9}},{a:product},{a:product,b:{...product,variantInventory:[]}}]){
  const tx=transactionFor(rows);
  await assert.rejects(applyProductBulkTransaction(tx,{ids:['a','b'],field:'stockDelta',value:1,expected:{a:productFingerprint(product),b:productFingerprint(product)}},collections,id=>id,()=>123));assert.deepEqual(tx.updates,[]);
 }
});
test('duplicar conserva sólo datos comerciales, desactiva y reinicia inventario e identificadores',()=>{
 const source={...product,_docId:'original',createdAt:123,userId:'privado',costUnit:100,purchased:5,variantInventory:[{variant:'Oro',stock:4}],variants:{Color:['Oro']},imageUrl:'https://img.test/a',imagesExtra:['https://img.test/b']};
 const copy=productDuplicateData(source);assert.equal(copy.active,false);assert.equal(copy.stock,0);assert.equal(copy.sku,'');assert.equal(copy.priceBefore,null);assert.deepEqual(copy.variantInventory,[{variant:'Oro',stock:0}]);assert.equal(copy.name,'Anillo (copia)');
 for(const field of ['_docId','createdAt','userId','costUnit','purchased'])assert.equal(Object.hasOwn(copy,field),false);
 copy.variants.Color.push('Plata');assert.deepEqual(source.variants.Color,['Oro']);
});
test('agregar selección a compra conserva líneas y variantes originales, sin crear otro pedido',()=>{
 const original=[{productId:'a',name:'Viejo',qty:2,price:20000,variant:''},{id:'b',name:'Con variante',qty:1,price:25000,variant:'Oro'}];
 const result=mergeSelectedOrderProducts(original,[{...product,id:'a'},{...product,id:'c',variantInventory:[{variant:'Rojo',stock:3}]}]);
 assert.equal(result[0].qty,3);assert.equal(result[0].price,20000);assert.equal(result[1].variant,'Oro');assert.equal(result[2].id,'c');assert.equal(result[2].variant,'');assert.equal(original[0].qty,2);
});
test('vinculación rechaza selección inválida y cantidades máximas sin alterar el borrador',()=>{
 assert.throws(()=>mergeSelectedOrderProducts([],[{...product,id:'a',active:false}]));
 assert.throws(()=>mergeSelectedOrderProducts([{id:'a',qty:99,variant:''}],[{...product,id:'a'}]));
 assert.throws(()=>mergeSelectedOrderProducts([],[{...product,id:'a'},{...product,id:'a'}]));
});

test('quitar oferta elimina también el precio anterior y su badge, sin alterar el precio real',()=>{assert.deepEqual(productBulkPatch({...product,badge:'Oferta'},'oferta',false),{oferta:false,priceBefore:null,badge:null});});

test('la tarjeta actualiza sólo la variante elegida y conserva el total consistente', async () => {
 const {productCardPatch}=await import('../../js/admin/products/maestro-productos-core.mjs');
 const product={stock:3,variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:3}]};
 assert.deepEqual(productCardPatch(product,{field:'stock',variant:'Dorado',value:'500'}),{stock:503,variantInventory:[{variant:'Dorado',stock:500},{variant:'Plateado',stock:3}]});
 assert.deepEqual(productCardPatch(product,{field:'stock',variant:'Plateado',value:0}),{stock:0,variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:0}]});
 for(const value of [-1,1.5,'',1000001])assert.throws(()=>productCardPatch(product,{field:'stock',variant:'Dorado',value}));
 assert.throws(()=>productCardPatch(product,{field:'stock',variant:'Inexistente',value:5}));
 assert.deepEqual(productCardPatch({stock:3},{field:'stock',value:0}),{stock:0});
 assert.deepEqual(productCardPatch(product,{field:'active',value:false}),{active:false});
});
