import test from 'node:test';
import assert from 'node:assert/strict';
import { wristCategory, unifyWristCollections } from '../../js/core/store/categorias-pulseras.mjs';
test('los alias históricos forman una sola colección sin perder productos', () => {
  for (const value of ['brazaletes', 'Brazalete', 'Pulsera', 'bracelets', 'bangle', 'esclavas']) assert.equal(wristCategory(value), 'pulseras');
  assert.equal(wristCategory('armcuff'), 'armcuff');
  const input = [{ slug:'brazaletes', name:'Brazaletes', image:'/legacy.webp', visible:true }, { slug:'pulseras', name:'Pulseras', visible:true }, { slug:'aros', name:'Aros' }];
  const merged = unifyWristCollections(input);
  assert.equal(merged.filter(x => x.slug === 'pulseras').length, 1);
  assert.equal(merged.find(x => x.slug === 'pulseras').image, '/legacy.webp');
  assert.equal(input[0].slug, 'brazaletes');
  assert.equal(unifyWristCollections([input[0]], false)[0].slug, 'brazaletes');
});
test('ocultar la colección canónica también oculta el alias anterior', () => {
  const list = unifyWristCollections([{slug:'brazaletes',visible:true},{slug:'pulseras',visible:false}]);
  assert.equal(list.length,1);
  assert.equal(list[0].visible,false);
});
