import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/components/images/utilidades-imagenes.js', import.meta.url), 'utf8');
const context = vm.createContext({ URL });
vm.runInContext(source.slice(0, source.indexOf('export function sanitizeImageUrl')), context);
const base = 'https://res.cloudinary.com/tintin/image/upload/';

test('entrega de alta calidad conserva original, recorte y versión y es idempotente', () => {
  const original = base + 'c_crop,w_800,h_900/v123/photo.webp';
  const result = context.withCloudinaryAutoDelivery(original);
  assert.equal(result, base + 'f_auto,q_auto:best/c_crop,w_800,h_900/v123/photo.webp');
  assert.equal(context.withCloudinaryAutoDelivery(result), result);
  assert.equal(context.withCloudinaryAutoDelivery(base + 'f_auto,q_auto/v123/photo.webp'), base + 'f_auto,q_auto:best/v123/photo.webp');
  assert.equal(context.withCloudinaryAutoDelivery(base + 'f_auto,q_auto/v123/q_auto/photo.webp'), base + 'f_auto,q_auto:best/v123/q_auto/photo.webp');
});

test('firmas y hosts externos conservan su URL exacta', () => {
  for (const url of [base + 's--abcd1234--/v123/photo.webp', 'https://example.com/image/upload/v123/photo.webp']) {
    assert.equal(context.withCloudinaryAutoDelivery(url), url);
  }
});
