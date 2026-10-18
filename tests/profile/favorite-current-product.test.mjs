import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { hasProductStock, firstAvailableVariant } from '../../js/core/store/inventario-variantes.mjs';
import { productVariantImage } from '../../js/components/images/foto-variante.mjs';

const source = fs.readFileSync(new URL('../../js/pages/profile/favoritos-perfil.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
const context = vm.createContext({ document: { getElementById: () => null }, subscribeAuthState: () => {}, hasProductStock, firstAvailableVariant, productVariantImage });
vm.runInContext(source, context);
const resolve = (favorites, products) => JSON.parse(JSON.stringify(context.resolveFavoriteProducts(favorites, products)));

test('profile removal passes a product object to the canonical favorites API', async () => {
  let click;
  let received;
  const alerts = [];
  const button = { dataset: { removeFavorite: 'product1' }, disabled: false };
  const root = { addEventListener: (name, handler) => { if (name === 'click') click = handler; } };
  const sandbox = vm.createContext({
    document: { getElementById: () => root }, subscribeAuthState: () => {},
    window: { TintinFavorites: { toggle: async item => { received = item; return { changed: typeof item === 'object', selected: false }; } } },
    alert: message => alerts.push(message),
  });
  vm.runInContext(source, sandbox);
  await click({ target: { closest: () => button } });
  assert.deepEqual(JSON.parse(JSON.stringify(received)), { id: 'product1' });
  assert.deepEqual(alerts, []);
});

test('an unsuccessful removal unlocks the button for retry and reports the error', async () => {
  let click;
  const alerts = [];
  const button = { dataset: { removeFavorite: 'product1' }, disabled: false };
  const sandbox = vm.createContext({
    document: { getElementById: () => ({ addEventListener: (name, handler) => { if (name === 'click') click = handler; } }) },
    subscribeAuthState: () => {}, window: { TintinFavorites: { toggle: async () => ({ changed: false }) } },
    alert: message => alerts.push(message),
  });
  vm.runInContext(source, sandbox);
  await click({ target: { closest: () => button } });
  assert.equal(button.disabled, false);
  assert.equal(alerts.length, 1);
});
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
