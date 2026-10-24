import test from 'node:test';
import assert from 'node:assert/strict';
import {productSuggestionProfile} from '../../js/admin/products/sugerencias-producto-core.mjs';
test('categoría explícita prevalece sobre nombre ambiguo',()=>{
 assert.equal(productSuggestionProfile({category:'Carteras',name:'Pulsera Luna'}).type,'cartera');
});
for(const [category,type] of [['Pulseras','pulsera'],['Brazaletes','pulsera'],['Carteras','cartera'],['Aros','aros'],['Relojes','reloj'],['Collares','collar'],['Anillos','anillo']])test(`sugerencias locales pertinentes: ${category}`,()=>{
 const result=productSuggestionProfile({category});assert.equal(result.type,type);assert.ok(result.care.length);assert.match(result.warrantyReview,/Confirmar|Revisar/);
 assert.doesNotMatch(JSON.stringify(result),/de por vida|impermeable|hipoalerg|30 días|6 meses/);
});
test('material sólo afecta sugerencias al estar informado',()=>{
 assert.equal(productSuggestionProfile({category:'Aros'}).care.length,1);
 assert.match(productSuggestionProfile({material:'Plata 925'}).care[1],/plata/);
 assert.match(productSuggestionProfile({material:'Baño de oro'}).care[1],/baño/);
 assert.match(productSuggestionProfile({material:'Acero inoxidable'}).care[1],/secar/);
});
test('producto desconocido conserva alternativa manual sin inventar clasificación',()=>{
 assert.equal(productSuggestionProfile({name:'Objeto nuevo'}).type,'producto');
 assert.equal(productSuggestionProfile({name:'Carolina'}).type,'producto');
 assert.equal(productSuggestionProfile({category:'Reloj'}).type,'reloj');
 assert.equal(productSuggestionProfile({category:'Collar'}).type,'collar');
});
