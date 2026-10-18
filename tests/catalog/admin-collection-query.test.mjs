import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('admin collection listeners use the Firestore rules list bound', () => {
  const admin = read('js/admin/admin-app.js');
  const commerce = read('js/admin/shopify-commerce-admin.js');

  assert.match(admin, /subscribeAdminCollectionPages\('collections', 200,/);
  assert.match(admin, /query\(base, orderBy\('__name__'\), limit\(pageSize\)\)/);
  assert.match(commerce, /query\(collection\(db, 'collections'\), limit\(200\)\)/);
});
