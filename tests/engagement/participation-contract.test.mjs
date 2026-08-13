import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicCustomerName } from '../../cloudflare/participacion-clientes.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('public review names follow the required mask', () => {
  assert.equal(publicCustomerName('Antonia Peralta'), 'A***a P*****a');
});

test('engagement writes stay behind server APIs', async () => {
  const rules = await read('firestore.rules');
  assert.match(rules, /match \/reviewRecords\/\{reviewId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/likeRecords\/\{likeId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/favorites\/\{productId\}[\s\S]*?allow create, update, delete: if false/);
});

test('one review edit and one review per account/product are enforced server-side', async () => {
  const source = await read('cloudflare/participacion-clientes.js');
  assert.match(source, /Number\(record\.editCount\) >= 1/);
  assert.match(source, /opaqueId\(user\.uid, context\.productId, 'review'\)/);
  assert.match(source, /currentDocument: \{ exists: false \}/);
});

test('admin and customer surfaces are wired', async () => {
  const [admin, product, profile] = await Promise.all([read('admin.html'), read('product.html'), read('perfil.html')]);
  assert.match(admin, /id="section-resenas"/);
  assert.match(admin, /id="section-me-gusta"/);
  assert.match(product, /resenas-producto\.js/);
  assert.match(profile, /favoritos-perfil\.js/);
});
