import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({ URL, window: { location: { href: 'https://example.test/product' } } });
vm.runInContext(fs.readFileSync(new URL('../../js/components/images/galeria-producto.js', import.meta.url), 'utf8'), context);
const colors = context.window.TintinProductColors;
test('paleta editable, alias y metalizados distintos del marrón', () => {
  assert.ok(colors.palette.length >= 25);
  assert.equal(colors.preset('GOLD').name, 'dorado');
  assert.equal(colors.preset('marron').name, 'marrón');
  assert.equal(colors.preset('Fuchsia').name, 'fucsia');
  assert.match(colors.swatch('dorado'), /FFD34E/);
  assert.match(colors.swatch('plateado'), /CFD4DA/);
  assert.notEqual(colors.swatch('dorado'), colors.swatch('marrón'));
});
test('la elección administrativa prevalece y sólo admite CSS de la paleta o hex seguro', () => {
  assert.equal(colors.swatch('dorado', { colorHex: '#123ABC' }), '#123ABC');
  assert.equal(colors.swatch('dorado', { swatch: 'azul' }), '#2463CF');
  assert.equal(colors.swatch('dorado', { swatch: 'url(https://evil.test)', colorHex: '#123456;display:none' }), colors.swatch('dorado'));
});
test('sugerencias aproximadas ignoran el fondo blanco y requieren señal suficiente', () => {
  const pixels = rgb => Uint8ClampedArray.from([...Array(100)].flatMap(() => [...rgb, 255]).concat([...Array(300)].flatMap(() => [255, 255, 255, 255])));
  assert.equal(colors.guessColor(pixels([220, 178, 48])).name, 'dorado');
  assert.equal(colors.guessColor(pixels([170, 177, 184])).name, 'plateado');
  assert.equal(colors.guessColor(pixels([32, 100, 220])).name, 'azul');
  assert.equal(colors.guessColor(pixels([255, 255, 255])), null);
  assert.equal(colors.guessColor(Uint8ClampedArray.from([220, 178, 48, 255])), null);
});

const storeSource = fs.readFileSync(new URL('../../tienda.js', import.meta.url), 'utf8');
vm.runInContext(storeSource.slice(storeSource.indexOf('function productVariantGroups'), storeSource.indexOf('function productPhotoIdentity')), context);
const cardColors = product => JSON.parse(JSON.stringify(context.productCardColorOptions(product)));
test('la tarjeta de ÉLISE muestra sólo dorado; clara no inventa una opción gris', () => {
  assert.deepEqual(cardColors({ colorFinish: 'Color de lente: clara · Color de las varillas: dorado' }), ['Color', ['dorado']]);
  assert.equal(cardColors({ colorFinish: 'Color de lente: clara' }), null);
  assert.equal(cardColors({ colorFinish: '' }), null);
});
test('colores declarados y variantes administrativas conservan sus opciones', () => {
  assert.deepEqual(cardColors({ colorFinish: 'Dorado / Plateado' }), ['Color', ['Dorado', 'Plateado']]);
  assert.deepEqual(cardColors({ variants: { Color: ['Dorado'] }, colorFinish: 'Dorado / Plateado' }), ['Color', ['Dorado']]);
  assert.deepEqual(cardColors({ variants: { Color: ['Personalizado'] } }), ['Color', ['Personalizado']]);
});

test('tarjetas usan fotos múltiples por color y el aspecto administrativo', () => {
  const product = { variants: { Color: ['Dorado', 'Plateado'] }, variantMedia: [
    { Color: 'dorado', imageUrls: ['https://example.test/gold.webp'], colorHex: '#123ABC' },
    { Color: 'Plateado', imageUrls: ['javascript:alert(1)', 'https://example.test/silver.webp'] },
  ] };
  assert.equal(context.productMediaForOption(product, 'Color', 'Dorado'), 'https://example.test/gold.webp');
  assert.equal(context.productMediaForOption(product, 'Color', 'Plateado'), 'https://example.test/silver.webp');
  assert.equal(context.productMediaForOption(product, 'Color', 'Rojo'), '');
  assert.equal(context.productColorSwatch('Dorado', product), '#123ABC');
});

test('inicio, catálogo y colecciones cargan la paleta antes de dibujar tarjetas', () => {
  for (const page of ['index.html', 'catalogo.html', 'collections.html', 'product.html']) {
    const html = fs.readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8');
    const gallery = html.indexOf('<script src="js/components/images/galeria-producto.js');
    const store = html.indexOf('<script src="tienda.js');
    assert.ok(gallery >= 0 && gallery < store, `${page}: falta la paleta antes del renderer`);
    assert.equal((html.match(/<script[^>]+src="js\/components\/images\/galeria-producto\.js/g) || []).length, 1);
  }
});
