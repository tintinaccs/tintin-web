import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { productSearchScore,productSearchText,normalizeProductSearch } from '../../js/core/store/busqueda-productos.mjs';
import { hasProductStock } from '../../js/core/store/inventario-variantes.mjs';
const root=process.cwd();
const controller=fs.readFileSync('js/components/navigation/compartido/control-busqueda.js','utf8');
function audit(mutate=(_file,source)=>source){
 const source=fs.readFileSync('scripts/auditar-fase-7-catalogo.js','utf8');let exit=0;
 const context=vm.createContext({__dirname:path.join(root,'scripts'),require(name){if(name==='path')return path;if(name==='fs')return {readFileSync(file){return mutate(path.relative(root,file).split(path.sep).join('/'),fs.readFileSync(file,'utf8'));}};throw Error(name);},console:{log(){},error(){}},process:{exit:code=>{exit=code;}}});
 vm.runInContext(source,context);return exit;
}
test('el auditor exige campos, delegación clásica y política de visibilidad en la autoridad compartida',()=>{
 assert.equal(audit(),0);
 for(const mutate of [
  (file,s)=>file==='js/core/store/busqueda-productos.mjs'?s.replace('Array.isArray(product?.tags)','false'):s,
  (file,s)=>file==='js/core/store/busqueda-productos.mjs'?s.replace('JSON.stringify(product.variants)',"''"):s,
  (file,s)=>file==='tienda.js'?s.replace('module => module.initSearchController()','module => undefined'):s,
  (file,s)=>file==='tienda.js'?s+'\nfunction runSearch() {}':s,
  (file,s)=>file.endsWith('control-busqueda.js')?s.replace('window.TintinCatalogPolicy.isCatalogVisible(product)','true'):s,
  (file,s)=>file.endsWith('politica-visibilidad-catalogo.js')?s.replace('loadCollections({ onData(collections)', 'skipCollections({ onData(collections)'):s,
  (file,s)=>file.endsWith('politica-visibilidad-catalogo.js')?s.replace('visibleCollectionSlugs = new Set', 'unusedCollectionSlugs = new Set'):s,
 ])assert.equal(audit(mutate),1);
});
test('controlador real excluye ocultos/inactivos y prioriza opciones disponibles antes de agotados',()=>{
 const c=vm.createContext({window:{TintinCatalogPolicy:{isCatalogVisible:p=>p.active!==false&&!p.hidden&&p.price>0}},productSearchText,productSearchScore,normalize:normalizeProductSearch,hasProductStock,MAX_RESULTS:10});
 vm.runInContext('let index=[];'+controller.slice(controller.indexOf('function buildIndex'),controller.indexOf('function stateNode')),c);
 const products=[{id:'out',name:'Anillo',price:1,stock:0},{id:'in',name:'Anillo corazón',price:1,stock:1},{id:'inactive',name:'Anillo secreto',price:1,stock:2,active:false},{id:'hidden',name:'Anillo oculto',price:1,stock:2,hidden:true}];
 c.buildIndex(products);
 assert.deepEqual(Array.from(c.searchProducts('anilo'),p=>p.id),['in','out']);
});
