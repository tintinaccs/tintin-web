import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProductMetadataHtml } from '../../functions/product.js';
const source = '<html><head></head><body><div id="product-grid" style="display:none;"><button type="button" id="gallery-main"></button></div></body></html>';
const product = { name: 'Aros', category: 'aros', price: 25000, active: true, stock: 2, imageUrl: 'https://media.example.test/gold.jpg',
  variants: [{ Color: 'Dorado', imageUrl: 'https://media.example.test/gold.jpg' }, { Color: 'Plateado', imageUrl: 'https://media.example.test/silver.jpg' }],
  variantInventory: [{ variant: 'Dorado', stock: 0 }, { variant: 'Plateado', stock: 2 }] };
test('primer HTML y vista previa usan la foto de una opción disponible', () => {
  const rendered = renderProductMetadataHtml(source, 'stock-fixture', product);
  assert.equal(rendered.image, 'https://media.example.test/silver.jpg');
  assert.match(rendered.html, /data-tt-server-image="1" src="https:\/\/media.example.test\/silver.jpg"/);
});
test('metadata y foto del agotado coinciden aunque el agregado conserve stock viejo', () => {
  const rendered = renderProductMetadataHtml(source, 'stock-fixture', { ...product, variantInventory: product.variantInventory.map(row => ({ ...row, stock: 0 })) });
  assert.match(rendered.html, /OutOfStock/); assert.match(rendered.html, /tt-stock-label/);
});
