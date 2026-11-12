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

test('las tarjetas tienen «Ver» y «Agregar al carrito»; con varias opciones abren la hoja de confirmación sin salir de la página', async () => {
  const [catalog, classic] = await Promise.all([read('catalogo.html'), read('tienda.js')]);
  for (const text of [catalog, classic]) {
    assert.match(text, />Ver</);
    assert.match(text, />Agregar al carrito</);
    assert.match(text, /data-card-options="\$\{safeId\}"/);
    assert.doesNotMatch(text, />Elegir opciones</);
    assert.doesNotMatch(text, /Ver y agregar al carrito/);
  }
  const checkout = await read('checkout.html');
  assert.match(checkout, /data-card-options="\$\{safeId\}"/);
  assert.match(checkout, /button\.ck-sug-add:not\(\[data-card-options\]\)/);
  assert.match(catalog, /data-pid="\$\{safeId\}"/);
  assert.match(catalog, /window\.openCardAddSheet\?\.\(btn\.dataset\.cardOptions, btn\)/);
  assert.match(classic, /tt-add-to-cart" data-id=/);
  assert.match(classic, /function openCardAddSheet/);
  assert.match(classic, /role="dialog" aria-modal="true"/);
  assert.match(classic, /await addToCart\(p\.id, _sheetVariantString\(p, sel\)\)/);
});

test('una variante única (una sola opción por grupo) se agrega directo desde la tarjeta', async () => {
  const [catalog, classic] = await Promise.all([read('catalogo.html'), read('tienda.js'), read('tienda.js')]);
  assert.match(classic, /function singleVariantLabel/);
  assert.match(catalog, /resolveProductVariant\(p, ''\)/);
  assert.match(catalog, /data-variant="\$\{escapeCatalogHtml\(singleVariant\)\}"/);
  assert.match(catalog, /\.\.\.\(variant \? \{ variant \} : \{\}\)/);
  assert.match(classic, /addToCart\(id, btn\.dataset\.variant \|\| ''\)/);
  const { resolveProductVariant } = await import('../../js/core/store/inventario-variantes.mjs');
  assert.equal(resolveProductVariant({ variants: { Color: ['Dorado'] } }, ''), 'Dorado');
  assert.equal(resolveProductVariant({ variants: { Color: ['Dorado', 'Plata'] } }, ''), null);
});
