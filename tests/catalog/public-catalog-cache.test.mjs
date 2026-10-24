import {productSearchScore} from '../../js/core/store/busqueda-productos.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const api = fs.readFileSync('functions/api/public-catalog.js', 'utf8');
const products = fs.readFileSync('js/core/store/estado-productos.js', 'utf8');
const collections = (fs.readFileSync('js/pages/collections/estado-colecciones.js', 'utf8') + '\n' + fs.readFileSync('js/pages/collections/datos-publicos-colecciones.js', 'utf8'));
const routes = fs.readFileSync('_routes.json', 'utf8');

test('catálogo público pasa por caché edge y usa lista blanca', () => {
  assert.match(api, /caches\.default/);
  assert.match(api, /public, max-age=5, s-maxage=10/);
  assert.match(products, /const HOME_CACHE_TTL = 10 \* 1000/);
  assert.match(products, /const ALL_CACHE_TTL = 10 \* 1000/);
  assert.match(api, /PRODUCT_FIELDS/);
  assert.match(api, /COLLECTION_FIELDS/);
  assert.match(api, /pickKnownFields/);
  assert.match(routes, /\/api\/public-catalog/);
});

test('clientes usan edge sin fallback Firestore de colección completa', () => {
  assert.match(products, /fetchPublicCatalogResource\('products'\)/);
  assert.doesNotMatch(products, /fetchAllProductsFromSdk|fetchHomeProductsFromSdk/);
  assert.doesNotMatch(products, /fetchAllProductsFromRest\(\)/);
  assert.match(collections, /fetchPublicCatalogResource\('collections'\)/);
  assert.doesNotMatch(collections, /listPublicCollectionRest\('collections'/);
});

test('catálogo comercial no abre automáticamente el listener completo', () => {
  assert.doesNotMatch(products, /catalogo\|collections[\s\S]{0,160}return startPublicProductsRealtime\(\)/);
});

test('la proyección pública conserva SKU para buscar y excluye campos internos',()=>{
 const fields=api.slice(api.indexOf('const PRODUCT_FIELDS'),api.indexOf('const COLLECTION_FIELDS'));
 const pick=api.slice(api.indexOf('function pickKnownFields('),api.indexOf('function normalizeResource('));
 const project=new Function(`${fields}\n${pick}\nreturn data=>pickKnownFields(data,PRODUCT_FIELDS);`)();
 const product=project({name:'Anillo',sku:'TIN-00042',price:25000,stock:2,costPrice:12000,supplier:'Interno',internalNotes:'Privado'});
 assert.equal(product.sku,'TIN-00042');
 assert.equal(product.costPrice,undefined);assert.equal(product.supplier,undefined);assert.equal(product.internalNotes,undefined);
 assert.ok(productSearchScore(product,'TIN-00042')>0);assert.equal(productSearchScore(product,'TIN-00043'),0);
});

test('tripwire acepta caché positiva de hasta60s y sigue rechazando valores superiores o cero',()=>{
 const script=fs.readFileSync('scripts/auditar-rendimiento-regresiones.js','utf8');
 for(const seconds of [0,10,60,61,600]){
  let exit=0;const context={__dirname:path.resolve('scripts'),console:{log(){},error(){}},process:{exit:code=>{exit=code;}},require(name){if(name==='path')return path;if(name==='fs')return {...fs,readFileSync(file,...args){const text=fs.readFileSync(file,...args);return String(file).split(path.sep).join('/').endsWith('/js/core/store/estado-productos.js')?text.replace(/const ALL_CACHE_TTL = \d+ \* 1000;/,`const ALL_CACHE_TTL = ${seconds} * 1000;`):text;}};throw Error(name);}};
  vm.runInNewContext(script,context);assert.equal(exit,seconds>0&&seconds<=60?0:1,`TTL ${seconds}`);
 }
});

test('presupuesto conserva caché edge de10 a60s y rechaza TTL insuficiente o excesivo',()=>{
 const script=fs.readFileSync('scripts/auditar-firestore-lecturas-presupuesto.js','utf8');
 for(const seconds of [0,9,10,60,61,600]){
  let exit=0;const context={__dirname:path.resolve('scripts'),console:{log(){},error(){}},process:{exit:code=>{exit=code;}},require(name){if(name==='path')return path;if(name==='fs')return {...fs,readFileSync(file,...args){const text=fs.readFileSync(file,...args);return String(file).split(path.sep).join('/').endsWith('/functions/api/public-catalog.js')?text.replace(/s-maxage=\d+/,`s-maxage=${seconds}`):text;}};throw Error(name);}};
  vm.runInNewContext(script,context);assert.equal(exit,seconds>=10&&seconds<=60?0:1,`TTL edge ${seconds}`);
 }
});
