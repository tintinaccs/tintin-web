import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../tienda.js', import.meta.url), 'utf8');
const context = vm.createContext({ URL, window: { location: { href: 'https://tintinaccesorios.pages.dev/product' } }, sanitizeClassicImageUrl: value => String(value || '') });
vm.runInContext(source.slice(source.indexOf('function productPhotoIdentity'), source.indexOf('function _pdSyncVariantToImage')), context);

test('una foto conserva identidad entre tamaños y transformaciones Cloudinary', () => {
  const base = 'https://res.cloudinary.com/tintin/image/upload/';
  assert.equal(context.productPhotoIdentity(base + 'f_auto,q_auto,c_limit,w_900/f_auto,q_auto/v123/photo.webp'), context.productPhotoIdentity(base + 'w_480/v123/photo.webp'));
  assert.notEqual(context.productPhotoIdentity(base + 'v123/photo.webp'), context.productPhotoIdentity(base + 'v124/photo.webp'));
  assert.notEqual(context.productPhotoIdentity(base + 'v123/gold.webp'), context.productPhotoIdentity(base + 'v123/silver.webp'));
});

test('las fotos externas no se agrupan por segmentos parecidos a versiones', () => {
  assert.equal(context.productPhotoIdentity('https://example.com/w_480/v123/photo.webp'), 'https://example.com/w_480/v123/photo.webp');
  assert.equal(context.productPhotoIdentity(''), '');
});
