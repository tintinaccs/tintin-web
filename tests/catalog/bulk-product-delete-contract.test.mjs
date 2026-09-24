import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('productos muestra eliminación masiva solo con permisos y conecta la acción canónica', () => {
  const admin = read('js/admin/shopify-commerce-admin.js');
  assert.match(admin, /products-bulk-delete/);
  assert.match(admin, /canDelete && canBulk/);
  assert.match(admin, /window\.bulkDelete\(\[\.\.\.state\.productSelected\]\)/);
  assert.match(admin, /ADMIN_PAGE_SIZE\s*=\s*30/);
  assert.match(admin, /MAX_BULK_SELECTION\s*=\s*30/);
});
