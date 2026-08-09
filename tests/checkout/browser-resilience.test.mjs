import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('checkout conserva una clave idempotente cuando sessionStorage está bloqueado', () => {
  const source = read('js/orders/pedido-checkout-seguro.js');
  assert.match(source, /let inMemoryRequestId = null/);
  assert.match(source, /if \(!inMemoryRequestId\)[\s\S]*return inMemoryRequestId/);
  assert.match(source, /sessionStorage\.removeItem\(REQUEST_KEY\)[\s\S]*inMemoryRequestId = null/);
});

test('el carrito clásico tolera localStorage bloqueado', () => {
  const source = read('tienda.js');
  assert.match(source, /function saveCart\(cart\) \{[\s\S]*try \{[\s\S]*localStorage\.setItem/);
  assert.match(source, /function saveCart\(cart\) \{[\s\S]*catch \{/);
});

test('los campos y errores del checkout exponen nombres y alertas accesibles', () => {
  const html = read('checkout.html');
  for (const id of ['ck-departamento', 'ck-city', 'ck-address', 'ck-referencia', 'ck-location-name', 'ck-name', 'ck-phone-number', 'ck-email', 'ck-notes']) {
    assert.match(html, new RegExp(`<label[^>]+for="${id}"`), `${id} debe tener una etiqueta asociada`);
  }
  for (const id of ['error-0', 'error-1', 'error-2', 'error-3', 'error-3-none', 'error-4']) {
    assert.match(html, new RegExp(`id="${id}"[^>]+role="alert"`), `${id} debe anunciar errores`);
  }
});
