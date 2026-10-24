import {productVariantPrice} from '../../js/core/store/inventario-variantes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src = await fs.readFile('tienda.js', 'utf8');

test('precio anterior tachado y % solo si priceBefore > price', async () => {
  const fnSrc = src.slice(src.indexOf('function discountInfo'), src.indexOf('function sanitizePlainText'));
  const fmt = n => 'Gs. ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const { priceMarkup } = new Function('formatPrice', `${fnSrc}; return { priceMarkup };`)(fmt);
  assert.equal(priceMarkup({ price: 50000 }), 'Gs. 50.000');
  assert.equal(priceMarkup({ price: 50000, priceBefore: 50000 }), 'Gs. 50.000');
  assert.equal(priceMarkup({ price: 50000, priceBefore: null }), 'Gs. 50.000');
  const html = priceMarkup({ price: 75000, priceBefore: 100000 });
  assert.match(html, /Gs\. 75\.000/);
  assert.match(html, /line-through[^>]*>Gs\. 100\.000/);
  assert.match(html, /-25%/);
});

test('tarjeta y ficha de producto usan priceMarkup', () => {
  assert.match(src, /tt-product-price">\$\{priceMarkup\(p\.variantCommerceVersion === 2 \? selectedProductMoney\(p\) : p\)\}/);
  assert.match(src, /priceEl\.innerHTML = priceMarkup\(product\.variantCommerceVersion === 2 \? selectedProductMoney\(product\) : product\)/);
});

test('búsqueda y carrito muestran precio anterior y avisan cambio de precio', async () => {
  const search = await fs.readFile('js/components/navigation/compartido/control-busqueda.js', 'utf8');
  assert.match(src, /module => module\.initSearchController\(\)/);
  assert.match(search, /Number\(money\.priceBefore\)/);
  assert.match(search, /document\.createElement\('s'\)/);
  assert.match(src, /selectedProductMoney\(p,item\.variant\)\.priceBefore/);
  assert.match(src, /Cambió el precio de tu carrito/);
  assert.match(src, /dismiss-price-notice/);
});

test('presentation money inherits legacy prices but resolves v2 combination and explicit null discount',()=>{
 const helper=src.slice(src.indexOf('function selectedProductMoney('),src.indexOf('function priceMarkup('));
 const selected=new Function('window','productVariantGroups',helper+'; return selectedProductMoney;')({TintinCatalogPolicy:{priceFor:productVariantPrice}},p=>Object.entries(p.variants || {}));
 assert.equal(selected({price:100}).price,100);
 const p={price:100,priceBefore:120,variantCommerceVersion:2,variants:{Color:['Plateado']},variantInventory:[{variant:'Plateado',attributes:{Color:'Plateado'},stock:null,price:150,priceBefore:null}]};
 assert.deepEqual(selected(p),{price:150,priceBefore:null});
});
