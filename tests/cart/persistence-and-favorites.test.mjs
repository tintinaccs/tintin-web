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

test('favoritos y Me gusta ya no existen en la interfaz pública', async () => {
  const files = ['product.html', 'catalogo.html', 'perfil.html', 'tienda.js',
    'js/pages/product/resenas-producto.js', 'js/pages/product/seleccion-producto.js', 'js/cargador-pagina.js'];
  for (const file of files) {
    const text = await read(file);
    assert.doesNotMatch(text, /btn-product-like|btn-product-favorite|data-favorite-id|tt-card-favorite|perfil-favorites-list|sincronizacion-favoritos|favoritos-perfil|data-review-like|data-reply-like|icono-corazon/, file);
  }
});

test('las tarjetas usan «Ver y agregar al carrito» y no «Elegir opciones»', async () => {
  const [catalog, classic] = await Promise.all([read('catalogo.html'), read('tienda.js')]);
  assert.match(catalog, /Ver y agregar al carrito/);
  assert.match(classic, /Ver y agregar al carrito/);
  assert.doesNotMatch(catalog, />\s*Elegir opciones\s*</);
  assert.doesNotMatch(classic, /'Elegir opciones'/);
});
