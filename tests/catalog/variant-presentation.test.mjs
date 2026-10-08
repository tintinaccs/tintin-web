import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../tienda.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function productVariantGroups'),source.indexOf('function _pdGetSelectedVariant')),context);
test('opciones importadas excluyen metadata y mantienen el orden contractual',()=>{
  const product={variants:[{Color:'Dorado',Talle:'M',price:100,stock:0,imageUrl:'a'},{Color:'Negro',Talle:'M',price:100,stock:2},{Color:'Negro',Talle:'L',sku:'x'}]};
  assert.equal(JSON.stringify(context.productVariantGroups(product)),JSON.stringify([['Color',['Dorado','Negro']],['Talle',['M','L']]]));
});
test('una opción agotada no hace desaparecer las demás ni confunde stock agregado',()=>{
  const product={stock:5,variantInventory:[{variant:'Dorado / M',stock:0},{variant:'Negro / M',stock:5}]};
  assert.equal(context.productOptionUnavailable(product,0,'Dorado'),true);
  assert.equal(context.productOptionUnavailable(product,0,'Negro'),false);
  assert.equal(context.productOptionUnavailable({...product,stock:0},0,'Negro'),true);
  assert.equal(context.productOptionUnavailable({stock:null},0,'Dorado'),false);
});

test('normalizar el catálogo conserva fotos por opción después de una segunda publicación',()=>{
 const policy=fs.readFileSync(new URL('../../js/pages/catalog/politica-visibilidad-catalogo.js',import.meta.url),'utf8');const c=vm.createContext({timestampToMillis:()=>0});vm.runInContext(policy.slice(policy.indexOf('function clean('),policy.indexOf('function categoryIsVisible')).replace(/export /g,''),c);
 c.input={id:'p',price:100,variants:[{Color:'Negro',imageUrl:'https://example.com/black.webp'}]};const result=vm.runInContext('normalizeProduct(normalizeProduct(input))',c);assert.equal(result.variantMedia[0].imageUrl,'https://example.com/black.webp');assert.deepEqual(Array.from(result.variants.Color),['Negro']);
});
