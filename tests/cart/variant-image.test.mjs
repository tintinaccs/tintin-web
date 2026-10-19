import test from 'node:test';
import assert from 'node:assert/strict';
import { productVariantImage } from '../../js/components/images/foto-variante.mjs';

const gold = 'https://cdn.example.test/gold.jpg';
const silver = 'https://cdn.example.test/silver.jpg';
const product = { imageUrl: gold, variants: { Talla: ['6', '7'], Color: ['Dorado', 'Plateado', 'Azul'] },
  variantMedia: [{ Color: 'Dorado', imageUrls: [gold] }, { Color: 'Plateado', imageUrl: silver }] };

test('la foto corresponde al color dentro de una selección con varios atributos', () => {
  assert.equal(productVariantImage(product, '6 / Dorado', silver), gold);
  assert.equal(productVariantImage(product, '7 / Plateado', gold), silver);
  assert.equal(productVariantImage(product, '6 / Azul', gold), '');
});
test('una variante importada usa su foto y un producto sin variantes conserva su imagen', () => {
  assert.equal(productVariantImage({ imageUrl: gold, variants: [{ imageUrl: gold, Color: 'Dorado' }, { imageUrl: silver, Color: 'Plateado' }] }, 'Plateado'), silver);
  assert.equal(productVariantImage({ imageUrl: gold }, ''), gold);
});
test('no se admiten protocolos ejecutables en las fotos del color', () => {
  assert.equal(productVariantImage({ variants: { Color: ['Azul'] }, variantMedia: [{ Color: 'Azul', imageUrl: 'javascript:alert(1)' }] }, 'Azul'), '');
});

 test('una optimización de una foto de otro color tampoco se usa como imagen general', () => {
  const original = 'https://res.cloudinary.com/demo/image/upload/v1/gold.jpg';
  const optimized = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_200,dpr_auto/v1/gold.jpg';
  assert.equal(productVariantImage({ imageUrl: optimized, variants: { Color: ['Dorado', 'Azul'] }, variantMedia: [{ Color: 'Dorado', imageUrl: original }] }, 'Azul', optimized), '');
  const best = optimized.replace('q_auto,', 'q_auto:best,');
  assert.equal(productVariantImage({ imageUrl: best, variants: { Color: ['Dorado', 'Azul'] }, variantMedia: [{ Color: 'Dorado', imageUrl: original }] }, 'Azul', best), '');
});

test('forma y combinación exacta conservan la foto elegida al agregar al carrito', () => {
  const item = { imageUrl: gold, variants: { Color: ['Dorado'], Forma: ['ovalado','redondo'] },
    variantMedia: [{Color:'Dorado',imageUrl:gold},{Color:'Dorado',Forma:'redondo',imageUrl:silver}] };
  assert.equal(productVariantImage(item, 'Dorado / redondo'), silver);
  assert.equal(productVariantImage(item, 'Dorado / ovalado'), gold);
  assert.equal(productVariantImage({imageUrl:gold,variants:{Forma:['ovalado','redondo']},variantMedia:[{Forma:'redondo',imageUrl:silver}]}, 'redondo'), silver);
});

test('sin asociación de una forma no reutiliza la foto de otra forma del mismo color', () => {
  const item={imageUrl:gold,variants:{Color:['Dorado'],Forma:['ovalado','redondo']},variantMedia:[{Color:'Dorado',Forma:'ovalado',imageUrl:gold}]};
  assert.equal(productVariantImage(item,'Dorado / redondo'), '');
  assert.equal(productVariantImage({...item,imagesExtra:[silver]},'Dorado / redondo'), silver);
});
