import {productStockTotal} from '../../js/core/store/inventario-variantes.mjs';
import { wristCategory } from '../../js/core/store/categorias-pulseras.mjs';
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

test('retirar un color lo oculta en catálogo/ficha sin ocultar otros colores ni borrar su matriz',()=>{
 const product={variantCommerceVersion:2,variants:{Color:['Oro','Plata','Negro'],Talle:['M']},variantInventory:[
   {variant:'gold',attributes:{Color:'Oro',Talle:'M'},stock:3,active:false},
   {variant:'silver',attributes:{Color:'Plata',Talle:'M'},stock:2},
   {variant:'black',attributes:{Color:'Negro',Talle:'M'},stock:0},
 ]};
 assert.deepEqual(JSON.parse(JSON.stringify(context.productVariantGroups(product))),[['Color',['Plata','Negro']],['Talle',['M']]]);
 assert.deepEqual(JSON.parse(JSON.stringify(context.productPreferredSelection(product,{Color:'Oro',Talle:'M'}))),{Color:'Plata',Talle:'M'});
 assert.equal(context.productOptionUnavailable(product,0,'Plata'),false);
 assert.equal(context.productOptionUnavailable(product,0,'Negro'),true);
 assert.equal(product.variantInventory[0].stock,3);assert.deepEqual(product.variants.Color,['Oro','Plata','Negro']);
 product.variantInventory[0].active=true;
 assert.deepEqual(JSON.parse(JSON.stringify(context.productVariantGroups(product)))[0][1],['Oro','Plata','Negro']);
});

test('abrir una ficha desde el color elegido conserva ese color y encuentra un talle disponible',()=>{
 const product={variantCommerceVersion:2,variants:{Color:['Oro','Plata'],Talle:['M','L']},variantInventory:[
  {variant:'gold-m',attributes:{Color:'Oro',Talle:'M'},stock:3},
  {variant:'silver-m',attributes:{Color:'Plata',Talle:'M'},stock:0},
  {variant:'silver-l',attributes:{Color:'Plata',Talle:'L'},stock:2},
 ]};
 assert.deepEqual(JSON.parse(JSON.stringify(context.productPreferredSelection(product,{Color:'Plata'}))),{Color:'Plata',Talle:'L'});
});

test('una matriz inválida no genera controles comprables ni rompe la presentación',()=>{
 for(const variantInventory of [undefined,{},[null]]){
  const product={variantCommerceVersion:2,variants:{Color:['Oro']},variantInventory};
  assert.deepEqual(JSON.parse(JSON.stringify(context.productVariantGroups(product))),[['Color',[]]]);
  assert.equal(context.productOptionUnavailable(product,0,'Oro'),true);
  assert.deepEqual(JSON.parse(JSON.stringify(context.productPreferredSelection(product))),{});
 }
});
test('una opción agotada no hace desaparecer las demás ni confunde stock agregado',()=>{
  const product={stock:5,variantInventory:[{variant:'Dorado / M',stock:0},{variant:'Negro / M',stock:5}]};
  assert.equal(context.productOptionUnavailable(product,0,'Dorado'),true);
  assert.equal(context.productOptionUnavailable(product,0,'Negro'),false);
  assert.equal(context.productOptionUnavailable({...product,stock:0},0,'Negro'),true);
  assert.equal(context.productOptionUnavailable({stock:null},0,'Dorado'),false);
});

test('normalizar el catálogo conserva fotos por opción después de una segunda publicación',()=>{
 const policy=fs.readFileSync(new URL('../../js/pages/catalog/politica-visibilidad-catalogo.js',import.meta.url),'utf8');const c=vm.createContext({wristCategory,timestampToMillis:()=>0});vm.runInContext(policy.slice(policy.indexOf('function clean('),policy.indexOf('function categoryIsVisible')).replace(/export /g,''),c);
 c.input={id:'p',price:100,variants:[{Color:'Negro',imageUrl:'https://example.com/black.webp'}]};const result=vm.runInContext('normalizeProduct(normalizeProduct(input))',c);assert.equal(result.variantMedia[0].imageUrl,'https://example.com/black.webp');assert.deepEqual(Array.from(result.variants.Color),['Negro']);
});

test('invalid opt-in commerce cannot crash the whole catalog or remain purchasable',()=>{
 const policy=fs.readFileSync(new URL('../../js/pages/catalog/politica-visibilidad-catalogo.js',import.meta.url),'utf8');
 const c=vm.createContext({wristCategory,timestampToMillis:()=>0,productStockTotal});
 vm.runInContext(policy.slice(policy.indexOf('function clean('),policy.indexOf('function categoryIsVisible')).replace(/export /g,''),c);
 c.input={id:'bad',price:100,stock:4,active:true,variantCommerceVersion:2,variants:{Color:['Dorado']},variantInventory:[]};
 assert.equal(vm.runInContext('normalizeProduct(input).active',c),false);
 c.input.variantCommerceVersion=3;assert.equal(vm.runInContext('normalizeProduct(input).active',c),false);
});
