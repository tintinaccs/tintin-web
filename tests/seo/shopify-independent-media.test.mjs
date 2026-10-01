import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNoShopifyHostedUrls, findShopifyHostedUrls } from '../../scripts/lib/referencias-shopify.mjs';

test('detecta CDN de Shopify en imágenes, variantes y descripciones públicas', () => {
  const records = [{
    id: 'reloj-1',
    data: {
      imageUrl: 'https://cdn.shopify.com/s/files/1/watch.webp',
      imagesExtra: ['//cdn.shopify.com/s/files/1/side.webp'],
      variants: [{ image: 'https://store.myshopify.com/cdn/item.png' }],
      description: 'Galería: https://cdn.shopify.com/s/files/1/detail.webp.',
    },
  }];

  const references = findShopifyHostedUrls(records);
  assert.equal(references.length, 4);
  assert.ok(references.some(item => item.path === '[0].data.variants[0].image'));
  assert.ok(references.every(item => item.host.endsWith('.shopify.com') || item.host.endsWith('.myshopify.com')));
  assert.equal(assertNoShopifyHostedUrls(records).ok, false);
});

test('acepta medios propios, Cloudinary, URLs relativas y dominios no Shopify', () => {
  const records = [{
    id: 'reloj-2',
    data: {
      imageUrl: 'https://res.cloudinary.com/tintin/image/upload/watch.webp',
      imagesExtra: ['/assets-tintin/images/producto.png', 'https://images.example.test/side.webp'],
      description: 'Disponible en https://tintinaccs.com/catalogo.',
    },
  }];

  assert.deepEqual(assertNoShopifyHostedUrls(records), { ok: true, references: [] });
});

test('no confunde subdominios engañosos o nombres que solo contienen shopify', () => {
  const records = [
    { imageUrl: 'https://cdn.shopify.com.evil.example/image.webp' },
    { imageUrl: 'https://notshopify.com/image.webp' },
  ];
  assert.deepEqual(findShopifyHostedUrls(records), []);
});
