import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({ URL, window: { location: { href: 'https://example.test/product' } } });
vm.runInContext(fs.readFileSync(new URL('../../js/components/images/galeria-producto.js', import.meta.url), 'utf8'), context);
const media = context.window.TintinProductMedia;
const image = (name, transform = '') => `https://res.cloudinary.com/shop/image/upload/${transform}v1/${name}.webp`;
test('las cuatro URLs de CELINA representan sólo dos fotos; se conservan los recortes distintos', () => {
  const list = [image('gold','f_auto,q_auto/'),image('silver','f_auto,q_auto/'),image('gold'),image('silver')];
  assert.equal(media.uniqueImages(list).length, 2);
  assert.notEqual(media.imageKey(image('gold','c_crop,w_200/')),media.imageKey(image('gold')));
  assert.notEqual(media.imageKey(image('gold')),media.imageKey(image('other')));
});
test('cada color tiene sus tres fotos; sin selección hay seis y ningún duplicado', () => {
  const gold = [1,2,3].map(n=>image(`gold${n}`)); const silver = [1,2,3].map(n=>image(`silver${n}`));
  const p={variants:{Color:['Dorado','Plateado','Rojo']},imageUrl:gold[0],imagesExtra:[...gold,...silver],variantMedia:[{Color:'Dorado',imageUrls:gold},{Color:'Plateado',imageUrls:silver}]};
  assert.deepEqual(Array.from(media.galleryImages(p,{Color:'Dorado'})),gold);
  assert.deepEqual(Array.from(media.galleryImages(p,{Color:'Plateado'})),silver);
  assert.equal(media.galleryImages(p).length,6);
  assert.equal(media.galleryImages(p,{Color:'Rojo'}).length,0);
});
test('conserva asociaciones importadas de una sola foto y enlaces seguros completos', () => {
  const gold=image('gold','f_auto,q_auto/'),silver=image('silver');
  const p={variants:[{color:'dorado',imageUrl:gold},{color:'plateado',imageUrl:silver}],imageUrl:gold,imagesExtra:[silver]};
  assert.deepEqual(Array.from(media.galleryImages(p,{color:'plateado'})),[silver]);
  assert.equal(media.imageKey('javascript:alert(1)'), '');
  assert.equal(media.imageKey('https://example.test/photo.webp?a=1'), 'https://example.test/photo.webp?a=1');
});
test('mapProduct y las normalizaciones posteriores conservan fotos largas por color', () => {
  const source=fs.readFileSync(new URL('../../js/core/store/estado-productos.js',import.meta.url),'utf8');
  const policy=fs.readFileSync(new URL('../../js/pages/catalog/politica-visibilidad-catalogo.js',import.meta.url),'utf8');
  const c=vm.createContext({cleanText:String,cleanMultilineText:String,sanitizeVariantData:v=>v,normalizeImageUrl:d=>d.imageUrl||'',sanitizeProductImage:String,uniqueSafeImageUrls:list=>list,timestampToMillis:()=>0});
  vm.runInContext(source.slice(source.indexOf('export function mapProduct'),source.indexOf('function compactProduct')).replace('export ',''),c);
  vm.runInContext(policy.slice(policy.indexOf('function clean('),policy.indexOf('function categoryIsVisible')).replace(/export /g,''),c);
  const long='https://example.test/'+ 'a'.repeat(260)+'.webp';
  c.input={name:'Aros',category:'aros',price:100,variants:{Color:['Dorado']},variantMedia:[{Color:'Dorado',imageUrls:[long,image('gold2'),image('gold3')]}]};
  const p=vm.runInContext("normalizeProduct(normalizeProduct(mapProduct('fixture',input)))",c);
  assert.equal(p.variantMedia[0].imageUrls.length,3);assert.equal(p.variantMedia[0].imageUrls[0],long);
});
