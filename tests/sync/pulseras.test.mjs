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

import fs from 'node:fs';
import vm from 'node:vm';
test('el API público agrupa antes de filtrar visibilidad y normaliza productos históricos', async () => {
  const context = vm.createContext({ wristCategory, unifyWristCollections, decodeFirestoreFields: value => value, firestoreAdminListAll: async () => context.docs });
  const source = fs.readFileSync('functions/api/public-catalog.js', 'utf8').replace(/^import[\s\S]*?;\s*$/gm, '').replace(/\bexport\s+/g, '');
  vm.runInContext(source, context);
  context.docs = [{ name: 'collections/brazaletes', fields: { name: 'Brazaletes', visible: true, image: '/legacy.webp' } }, { name: 'collections/pulseras', fields: { name: 'Pulseras', visible: false, imageUrl: '/preferred.webp' } }, { name: 'collections/aros', fields: { name: 'Aros', visible: true } }];
  let payload = await vm.runInContext("buildPayload({}, 'collections')", context);
  assert.deepEqual(Array.from(payload.items, item => item.id), ['aros']);
  context.docs[1].fields.visible = true;
  payload = await vm.runInContext("buildPayload({}, 'collections')", context);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items.filter(item => item.id === 'pulseras').length, 1);
  assert.equal(payload.items.find(item => item.id === 'pulseras').data.image, '/preferred.webp');
  context.docs = [{ name: 'products/legacy', fields: { name: 'Pulsera rígida', category: 'brazaletes', active: true, price: 10000, privateNote: 'no publicar' } }];
  payload = await vm.runInContext("buildPayload({}, 'products')", context);
  assert.equal(payload.items[0].data.category, 'pulseras');
  assert.equal(payload.items[0].data.privateNote, undefined);
});

test('eliminar la colección agrupada elimina sus documentos en un solo lote', async () => {
  const deleted = []; let committed = 0;
  const context = vm.createContext({ _allCollections: unifyWristCollections([{slug:'brazaletes'}, {slug:'pulseras'}], false), db:{}, doc:(_db,_collection,id) => id, writeBatch:() => ({ delete:id => deleted.push(id), commit:async() => { committed++; } }) });
  const source = fs.readFileSync('js/admin/admin-app.js', 'utf8');
  vm.runInContext(source.slice(source.indexOf('function collectionDocumentSlugs'), source.indexOf('function collSlugify')), context);
  await vm.runInContext("deleteCollectionDocuments('pulseras')", context);
  assert.deepEqual(deleted, ['brazaletes', 'pulseras']);
  assert.equal(committed, 1);
});
