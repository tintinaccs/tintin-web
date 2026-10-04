import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignGroupCollection,
  buildCatalogProductFromImport,
  chunkImportRecords,
  groupShopifyRows,
  importVariantOptions,
  pendingCollectionGroups,
  sanitizeShopifyBodyHtml,
  shopifyBodyToPlainText,
  stableProductDocumentId,
  summarizeImportRecords,
  titleGroupKey,
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

  const truncated = sanitizeShopifyBodyHtml('<p>Seguro</p><!-- comentario sin cierre <script>alert(1)');
  assert.equal(truncated, '<p>Seguro</p>');
  assert.doesNotMatch(truncated, /<!--|script/i);
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

const parsers = { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock };
const catalogCollections = [
  { id: 'relojes', slug: 'relojes', name: 'Relojes' },
  { id: 'collares', slug: 'collares', name: 'Collares' },
  { id: 'aros', slug: 'aros', name: 'Aros' },
  { id: 'bolsos', slug: 'bolsos', name: 'Bags' },
];

// Current Shopify Admin export (2024+): "URL handle", "Price",
// "Compare-at price", "Inventory quantity", "Product image URL"… Headers
// arrive lowercased from csvObjectsFromFile.
function newFormatRow(fields) {
  return {
    'url handle': '', title: '', description: '', type: '', tags: '', 'published on online store': '', status: '',
    sku: '', 'option1 name': '', 'option1 value': '', 'option2 name': '', 'option2 value': '',
    price: '', 'compare-at price': '', 'inventory tracker': '', 'inventory quantity': '',
    'continue selling when out of stock': '', 'product image url': '', 'image position': '', 'variant image url': '',
    ...fields,
  };
}

test('formato nuevo de Shopify: URL handle, variantes, galería y compare-at sin partir el producto', () => {
  const { products, invalidRows } = groupShopifyRows([
    newFormatRow({
      'url handle': 'reloj-fiorella', title: 'RELOJ FIORELLA', description: '<p><span>Acero &amp; cristal</span></p>',
      'published on online store': 'TRUE', status: 'Active', sku: 'RF-D', 'option1 name': 'Color', 'option1 value': 'Dorado',
      'option2 name': 'Material del reloj', 'option2 value': 'Acero inoxidable', price: '160000.00', 'compare-at price': '190000.00',
      'inventory tracker': 'shopify', 'inventory quantity': '2', 'continue selling when out of stock': 'DENY',
      'product image url': 'https://cdn.shopify.com/a.png', 'image position': '1', 'variant image url': 'https://cdn.shopify.com/a.png',
    }),
    newFormatRow({
      'url handle': 'reloj-fiorella', sku: 'RF-P', 'option1 name': 'Color', 'option1 value': 'Plateado',
      'option2 name': 'Material del reloj', 'option2 value': 'Acero inoxidable', price: '160000.00',
      'inventory tracker': 'shopify', 'inventory quantity': '3', 'continue selling when out of stock': 'DENY',
      'variant image url': 'https://cdn.shopify.com/b.png',
    }),
    newFormatRow({ 'url handle': 'reloj-fiorella', 'product image url': 'https://cdn.shopify.com/c.png', 'image position': '2' }),
  ], catalogCollections, parsers);

  assert.equal(invalidRows.length, 0);
  assert.equal(products.length, 1);
  const [{ product, errors, warnings }] = products;
  assert.deepEqual(errors, []);
  assert.equal(product.sourceMetadata.handle, 'reloj-fiorella');
  assert.equal(product.category, 'relojes');
  assert.equal(product.price, 160000);
  assert.equal(product.priceBefore, 190000);
  assert.equal(product.stock, 5);
  assert.equal(product.active, true);
  assert.equal(product.imageUrl, 'https://cdn.shopify.com/a.png');
  assert.deepEqual(product.imagesExtra.sort(), ['https://cdn.shopify.com/b.png', 'https://cdn.shopify.com/c.png']);
  assert.equal(product.variants.length, 2);
  assert.equal(product.descriptionText, 'Acero & cristal');
  assert.match(warnings.join(' '), /Stock sumado de 2 variantes/);
});

test('continuation rows inherit option names within their Handle without multiplying gallery inventory', () => {
  const { products } = groupShopifyRows([
    { handle: 'anillo', title: 'Anillo', type: 'Relojes', 'option1 name': 'Color', 'option1 value': 'Dorado', 'option2 name': 'Talla', 'option2 value': '6', 'variant price': '50000', 'variant inventory qty': '2' },
    { handle: 'anillo', 'option1 value': 'Dorado', 'option2 value': '7', 'variant price': '50000', 'variant inventory qty': '3' },
    { handle: 'anillo', 'option1 value': 'Dorado', 'option2 value': '7', 'image src': 'https://cdn.example/gallery.png' },
    { handle: 'otro', title: 'Otro', type: 'Relojes', 'option1 value': 'Default Title', 'variant price': '50000', 'variant inventory qty': '1' },
  ], collections, { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });
  assert.equal(products[0].product.stock, 5);
  assert.equal(products[0].product.variants.length, 2);
  assert.deepEqual(buildCatalogProductFromImport(products[0].product).variants, { Talla: ['6', '7'] });
  assert.equal(products[1].product.stock, 1);
  assert.equal(buildCatalogProductFromImport(products[1].product).variants, undefined);
});

test('stock del formato nuevo: sin seguimiento, seguir vendiendo, sin cantidad y negativo', () => {
  const row = (handle, fields) => newFormatRow({ 'url handle': handle, title: `Collar ${handle}`, status: 'active', price: '50000', ...fields });
  const { products } = groupShopifyRows([
    row('untracked', { 'inventory tracker': '', 'inventory quantity': '4' }),
    row('continue', { 'inventory tracker': 'shopify', 'inventory quantity': '4', 'continue selling when out of stock': 'CONTINUE' }),
    row('missing', { 'inventory tracker': 'shopify' }),
    row('negative', { 'inventory tracker': 'shopify', 'inventory quantity': '-2' }),
    row('invalid', { 'inventory tracker': 'shopify', 'inventory quantity': '1.5' }),
    row('hidden', { 'inventory tracker': 'shopify', 'inventory quantity': '1', 'published on online store': 'FALSE' }),
  ], catalogCollections, parsers);
  const byHandle = Object.fromEntries(products.map(item => [item.product.sourceMetadata.handle, item]));

  assert.equal(byHandle.untracked.product.stock, null);
  assert.match(byHandle.untracked.warnings.join(' '), /Sin límite/);
  assert.equal(byHandle.continue.product.stock, null);
  assert.equal(byHandle.missing.product.stock, null);
  assert.match(byHandle.missing.warnings.join(' '), /Sin cantidad de stock/);
  assert.equal(byHandle.negative.product.stock, 0);
  assert.deepEqual(byHandle.negative.errors, []);
  assert.match(byHandle.negative.warnings.join(' '), /negativo/);
  assert.match(byHandle.invalid.errors.join(' '), /stock contiene un valor inválido/);
  assert.equal(byHandle.hidden.product.active, false);
  assert.equal(byHandle.hidden.product.stock, 1);
});

test('colección por la primera palabra del título tolera plurales y no adivina', () => {
  assert.equal(titleGroupKey('Reloj Alissia'), 'reloj');
  const grouped = groupShopifyRows([
    newFormatRow({ 'url handle': 'reloj-violette', title: 'Reloj Violette', price: '100' }),
    newFormatRow({ 'url handle': 'collar-ismera-1', title: 'Collar Ismera', price: '100' }),
    newFormatRow({ 'url handle': 'aro-luna', title: 'Aro Luna', price: '100' }),
    newFormatRow({ 'url handle': 'bolso-mia', title: 'Bolso Mia', price: '100' }),
    newFormatRow({ 'url handle': 'cadena-fina', title: 'Cadena fina', price: '100' }),
  ], catalogCollections, parsers).products;
  assert.deepEqual(grouped.map(item => item.product.category), ['relojes', 'collares', 'aros', 'bolsos', '']);
  assert.equal(grouped[4].product._group, 'cadena');
  assert.match(grouped[4].errors.join(' '), /no pudo mapearse/);

  const ambiguous = groupShopifyRows([
    newFormatRow({ 'url handle': 'reloj-x', title: 'Reloj X', price: '100' }),
  ], [{ slug: 'relojes', name: 'Relojes' }, { slug: 'watches', name: 'Relojes' }], parsers).products[0];
  assert.equal(ambiguous.product.category, '');
  assert.match(ambiguous.errors.join(' '), /confirmación/);
});

test('descripción de Shopify pasa a texto plano seguro', () => {
  assert.equal(
    shopifyBodyToPlainText('<p><span>Acero&nbsp;inoxidable &amp; ba&ntilde;o</span></p><p>Línea<br>dos</p><ul><li>Uno</li><li>Dos</li></ul>'),
    'Acero inoxidable & baño\n\nLínea\ndos\n\n• Uno\n• Dos',
  );
  const hostile = shopifyBodyToPlainText('<p onclick="x()">Hola<script>alert(1)</script> <style>p{}</style>mundo</p><!-- nota -->&lt;b&gt; &#65;&#x42; &amp;lt; < 5 cm');
  assert.equal(hostile, 'Hola mundo\n<b> AB &lt; < 5 cm');
  assert.doesNotMatch(hostile, /alert|onclick|nota/);
  assert.equal(shopifyBodyToPlainText('x'.repeat(5000)).length, 4000);
});

test('opciones de un solo valor son atributos; solo 2+ valores son variantes seleccionables', () => {
  const { groups, attributes } = importVariantOptions([
    { Color: 'Dorado', 'Material de joyería': 'Acero', sku: 'A', price: 1, stock: 2, imageUrl: 'https://cdn.shopify.com/a.png' },
    { Color: 'Plateado / Rosa', 'Material de joyería': 'Acero', sku: 'B' },
  ]);
  assert.deepEqual(groups, { Color: ['Dorado', 'Plateado - Rosa'] });
  assert.deepEqual(attributes, { 'Material de joyería': 'Acero' });
});

test('producto de catálogo respeta los límites del formulario del Admin', () => {
  const data = buildCatalogProductFromImport({
    name: 'N'.repeat(300), category: 'relojes', price: 160000, priceBefore: 150000, stock: 5_000_000,
    imageUrl: 'https://cdn.shopify.com/a.png', imagesExtra: Array.from({ length: 20 }, (_, index) => `https://cdn.shopify.com/${index}.png`),
    description: '<p>ignorado</p>', descriptionText: 'Reloj elegante',
    tags: ['a', 'a', 'b'.repeat(90)], active: false,
    variants: [
      { Color: 'Dorado', 'Material del reloj': 'Acero', 'Características del reloj': 'Cuarzo', Talla: 'Única' },
      { Color: 'Plateado', 'Material del reloj': 'Acero', 'Características del reloj': 'Cuarzo', Talla: 'Única' },
    ],
    sourceMetadata: { platform: 'shopify', handle: 'reloj-fiorella' }, importFingerprint: 'shopify:reloj-fiorella',
  });
  assert.equal(data.name.length, 180);
  assert.equal(data.priceBefore, null);
  assert.equal(data.stock, 1_000_000);
  assert.equal(data.imagesExtra.length, 12);
  assert.deepEqual(data.tags, ['a', 'b'.repeat(60)]);
  assert.equal(data.active, false);
  assert.equal(data.material, 'Acero');
  assert.equal(data.sizeFit, 'Única');
  assert.equal(data.colorFinish, '');
  assert.deepEqual(data.variants, { Color: ['Dorado', 'Plateado'] });
  assert.equal(data.description, 'Reloj elegante\n\nCaracterísticas del reloj: Cuarzo');
  assert.equal(data.shopifyHandle, 'reloj-fiorella');
  assert.equal(data.collection, null);
  assert.equal(data.badge, null);
  assert.equal('createdAt' in data, false);

  const single = buildCatalogProductFromImport({ name: 'Aro', category: 'aros', price: 100, priceBefore: 150, stock: null, variants: [{ Color: 'Dorado' }] });
  assert.equal(single.priceBefore, 150);
  assert.equal(single.stock, null);
  assert.equal(single.colorFinish, 'Dorado');
  assert.equal('variants' in single, false);
  assert.equal(single.imageUrl, null);
});

test('grupos sin colección se asignan a mano, se pueden corregir y no aceptan colecciones inexistentes', () => {
  const { products } = groupShopifyRows([
    newFormatRow({ 'url handle': 'cadena-fina', title: 'Cadena fina', price: '100' }),
    newFormatRow({ 'url handle': 'cadena-gruesa', title: 'CADENA gruesa', price: '100' }),
    newFormatRow({ 'url handle': 'hoops-oro', title: 'Hoops oro', price: '100' }),
    newFormatRow({ 'url handle': 'reloj-x', title: 'Reloj X', price: '100' }),
  ], catalogCollections, parsers);
  assert.deepEqual(pendingCollectionGroups(products).map(item => [item.group, item.count, item.category]), [['cadena', 2, ''], ['hoops', 1, '']]);

  assert.equal(assignGroupCollection(products, 'cadena', 'no-existe', catalogCollections), 0);
  assert.equal(assignGroupCollection(products, 'cadena', 'collares', catalogCollections), 2);
  assert.deepEqual(products.slice(0, 2).map(item => [item.product.category, item.errors.length]), [['collares', 0], ['collares', 0]]);
  assert.equal(products[3].product.category, 'relojes');
  assert.deepEqual(pendingCollectionGroups(products).map(item => [item.group, item.category]), [['cadena', 'collares'], ['hoops', '']]);

  assert.equal(assignGroupCollection(products, 'cadena', 'relojes', catalogCollections), 2);
  assert.equal(products[0].product.category, 'relojes');
  assert.equal(assignGroupCollection(products, 'hoops', 'aros', catalogCollections), 1);
  assert.equal(products.every(item => item.errors.length === 0), true);
  assert.equal('_manualCollection' in buildCatalogProductFromImport(products[0].product), false);
});
