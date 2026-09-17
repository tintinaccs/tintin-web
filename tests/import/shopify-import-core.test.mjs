import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkImportRecords,
  groupShopifyRows,
  sanitizeShopifyBodyHtml,
  stableProductDocumentId,
  summarizeImportRecords,
} from '../../js/core/store/shopify-import-core.mjs';
import { parseLocalizedNumber, parseOptionalStock } from '../../js/core/store/normalizacion-importacion.mjs';

const collections = [{ id: 'relojes', slug: 'relojes', name: 'Relojes' }];

test('agrupa Shopify por Handle y no multiplica stock por filas de galería', () => {
  const { products, invalidRows } = groupShopifyRows([
    {
      handle: 'reloj-alissia', title: 'Reloj Alissia', type: 'Relojes',
      'variant sku': 'AL-01', 'variant price': '100.000', 'variant inventory qty': '2',
      'image position': '1', 'image src': 'https://cdn.example/one.webp',
      'body (html)': '<p>Ligero</p>', status: 'active',
    },
    {
      handle: 'reloj-alissia', title: '', type: '',
      'variant sku': 'AL-01', 'variant price': '', 'variant inventory qty': '2',
      'image position': '2', 'image src': 'https://cdn.example/two.webp',
    },
  ], collections, { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });

  assert.equal(invalidRows.length, 0);
  assert.equal(products.length, 1);
  assert.equal(products[0].product.stock, 2);
  assert.equal(products[0].product.imageUrl, 'https://cdn.example/one.webp');
  assert.deepEqual(products[0].product.imagesExtra, ['https://cdn.example/two.webp']);
  assert.equal(products[0].product.variants.length, 1);
});

test('sanitiza Body HTML a la lista editorial permitida', () => {
  const result = sanitizeShopifyBodyHtml('<p onclick="alert(1)">Hola<script>alert(1)</script><strong>mundo</strong><img src="javascript:bad"></p>');
  assert.equal(result, '<p>Hola<strong>mundo</strong></p>');
  assert.doesNotMatch(result, /script|onclick|javascript|img/i);
});

test('ambiguous collection never becomes a silent garbage category', () => {
  const result = groupShopifyRows([
    { handle: 'x', title: 'Producto', type: 'Relojes', 'variant price': '100' },
  ], [
    { slug: 'relojes-dama', name: 'Relojes' },
    { slug: 'relojes-caballero', name: 'Relojes' },
  ], { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });
  assert.equal(result.products[0].product.category, '');
  assert.match(result.products[0].errors.join(' '), /confirmación/i);
});

test('stable product identity and chunking are deterministic', () => {
  assert.equal(stableProductDocumentId('shopify:reloj-alissia'), stableProductDocumentId('shopify:reloj-alissia'));
  assert.equal(chunkImportRecords([1, 2, 3, 4, 5], 2).length, 3);
  assert.deepEqual(summarizeImportRecords([
    { product: { imagesExtra: ['a'], variants: [{}] }, errors: [], duplicate: false },
    { product: { imagesExtra: [], variants: [] }, errors: ['bad'], duplicate: false },
  ]), { ready: 1, duplicate: 0, invalid: 1, images: 3, variants: 1 });
});

test('10k records se procesan por chunks reanudables sin cambiar identidad', () => {
  const records = Array.from({ length: 10_000 }, (_, index) => ({
    product: { imagesExtra: [], variants: [] }, errors: [], duplicate: false, index,
  }));
  const chunks = chunkImportRecords(records, 50);
  assert.equal(chunks.length, 200);
  assert.equal(chunks.at(-1).length, 50);
  const checkpoint = 73;
  const resumed = chunks.slice(checkpoint).flat();
  assert.equal(resumed[0].index, checkpoint * 50);
  assert.equal(stableProductDocumentId('shopify:reloj-alissia'), stableProductDocumentId('shopify:reloj-alissia'));
});
