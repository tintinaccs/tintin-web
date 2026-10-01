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
  assert.match(src, /tt-product-price">\$\{priceMarkup\(p\)\}/);
  assert.match(src, /priceEl\.innerHTML = priceMarkup\(product\)/);
});

test('búsqueda y carrito muestran precio anterior y avisan cambio de precio', () => {
  assert.match(src, /tt-search-result-price">\$\{priceMarkup\(p\)\}/);
  assert.match(src, /priceBefore: \(Array\.isArray\(window\.PRODUCTS\)/);
  assert.match(src, /Cambió el precio de tu carrito/);
  assert.match(src, /dismiss-price-notice/);
});
