import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GUEST_CART_TTL_MS, guestCartIsExpired, pageHasCompleteCatalog } from '../../js/components/cart/politica-persistencia-carrito.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('el carrito invitado vence a los 30 minutos de inactividad', () => {
  const start = 1_000_000;
  assert.equal(GUEST_CART_TTL_MS, 30 * 60 * 1000);
  assert.equal(guestCartIsExpired(start, start + GUEST_CART_TTL_MS - 1), false);
  assert.equal(guestCartIsExpired(start, start + GUEST_CART_TTL_MS), true);
});

test('una ficha parcial nunca se considera catálogo completo', () => {
  assert.equal(pageHasCompleteCatalog('/product.html'), false);
  assert.equal(pageHasCompleteCatalog('/index.html'), false);
  assert.equal(pageHasCompleteCatalog('/catalogo.html'), true);
  assert.equal(pageHasCompleteCatalog('/collections'), true);
});

test('el carrito agrega líneas sin reemplazar las existentes', async () => {
  const runtime = await read('js/components/cart/sincronizacion-carrito.js');
  const classic = await read('tienda.js');
  assert.match(runtime, /items\.push\(incoming\)/);
  assert.match(classic, /if \(!hasCompleteCatalog\) return getCart\(\)/);
  assert.match(runtime, /GUEST_CART_TTL_MS/);
});

test('favoritos persiste con la cuenta y Me gusta se oculta en la ficha', async () => {
  const [favorites, product, cart, rules] = await Promise.all([
    read('js/components/favorites/sincronizacion-favoritos.js'),
    read('product.html'),
    read('tienda.js'),
    read('firestore.rules'),
  ]);
  assert.match(favorites, /users', currentUser\.uid, 'favorites'/);
  // Los favoritos siguen en catálogo/perfil; la ficha oculta la comunidad
  // según el pedido del propietario, sin introducir otra autoridad.
  assert.doesNotMatch(product, /id="btn-product-like"/);
  assert.match(cart, /data-favorite-id/);
  assert.doesNotMatch(product, /btn-product-favorite/);
  assert.doesNotMatch(cart, /tt-cart-favorites/);
  assert.match(await read('perfil.html'), /id="perfil-favorites-list"/);
  assert.match(rules, /match \/favorites\/\{productId\}/);
});
