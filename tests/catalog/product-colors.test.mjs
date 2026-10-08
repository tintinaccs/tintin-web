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
