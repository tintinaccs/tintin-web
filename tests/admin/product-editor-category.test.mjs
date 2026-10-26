import test from 'node:test';
import assert from 'node:assert/strict';
import {productEditorCategoryProfile} from '../../js/admin/products/sugerencias-producto-core.mjs';
for(const [category,key] of [['Bags','bag'],['Billeteras','wallet'],['Relojes','watch'],['Aros','earring'],['Collares','necklace'],['Anillos','ring'],['Earcuffs','earcuff'],['Tobilleras','anklet'],['Pulseras','bracelet'],['Gafas','sunglasses'],['Accesorios para el cabello','hair'],['Llaveros','keyring'],['Joyeros','organizer']])test(`opciones de categoría ${category}`,()=>{
 const profile=productEditorCategoryProfile({category,name:'Anillo de prueba'});assert.equal(profile.key,key);assert(profile.materials.length>0);assert(profile.variantGroups.length>0);assert(profile.descriptionChoices.length>0);assert(!JSON.stringify(profile).includes('undefined'));
});
test('una categoría reconocida prevalece y las categorías propias admiten edición libre',()=>{
 assert.equal(productEditorCategoryProfile({category:'Bags',name:'Reloj'}).key,'bag');
 assert.equal(productEditorCategoryProfile({category:'Diseños propios',name:'Objeto'}).key,'generic');
 assert.equal(productEditorCategoryProfile({category:'Diseños propios',name:'Bolso de viaje'}).key,'bag');
 const first=productEditorCategoryProfile({category:'Bags'});first.materials.push('No compartir referencias');assert(!productEditorCategoryProfile({category:'Bags'}).materials.includes('No compartir referencias'));
});
