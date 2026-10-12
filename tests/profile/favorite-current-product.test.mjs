import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/pages/profile/favoritos-perfil.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
const context = vm.createContext({ document: { getElementById: () => null }, subscribeAuthState: () => {} });
vm.runInContext(source, context);
const resolve = (favorites, products) => JSON.parse(JSON.stringify(context.resolveFavoriteProducts(favorites, products)));
test('favorite uses current public product price and media, never stored zero price', () => {
  const favorite = { productId: 'product1', name: 'Old', price: 0, imageUrl: 'old-image' };
  const [item] = resolve([favorite], [{ id: 'product1', data: { name: 'Current', price: 70000, imageUrl: 'current-image' } }]);
  assert.equal(item.price, 70000); assert.equal(item.name, 'Current'); assert.equal(item.imageUrl, 'current-image');
  assert.equal(favorite.price, 0);
});
test('missing or unavailable catalogue never presents old price as current or free', () => {
  assert.equal(resolve([{ productId: 'missing', price: 20000 }], [])[0].price, null);
  for (const price of [null, '', 'invalid', 0, -1]) {
    assert.equal(resolve([{ productId: 'p', price: 999 }], [{ id: 'p', data: { price } }])[0].price, null);
  }
});
