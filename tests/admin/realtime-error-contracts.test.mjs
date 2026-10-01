import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('commerce lists preserve confirmed data and expose persistent read errors', async () => {
  const source = await read('js/admin/shopify-commerce-admin.js');

  assert.match(source, /productsError:\s*''/);
  assert.match(source, /collectionsError:\s*''/);
  assert.match(source, /data-action="products-retry"/);
  assert.match(source, /data-action="collections-retry"/);
  assert.match(source, /Se muestran los últimos datos confirmados/);
  assert.match(source, /productsUnavailable/);
  assert.match(source, /collectionsUnavailable/);
  assert.match(source, /rangeLabel\(page, 'productos', productsUnavailable\)/);
  assert.match(source, /rangeLabel\(page, 'colecciones', collectionsUnavailable\)/);
  assert.doesNotMatch(source, /Mostrando \$\{page\.page \* ADMIN_PAGE_SIZE \+ 1\}–\$\{page\.page \* ADMIN_PAGE_SIZE \+ page\.items\.length\} de \$\{page\.total\} productos/);
});

test('commerce permission failures get one controlled auth recovery, not a listener storm', async () => {
  const source = await read('js/admin/shopify-commerce-admin.js');

  assert.match(source, /commerceAuthRecoveryAttempted/);
  assert.match(source, /permission-denied/);
  assert.match(source, /getIdToken\(true\)/);
  assert.match(source, /waitForAdminAppCheck\(12000\)/);
  assert.match(source, /recordAuthDiagnostic\('FIRESTORE_LISTENER_ERROR'/);
  assert.match(source, /recoverCommerceAuth\(error, 'products'\)/);
  assert.match(source, /recoverCommerceAuth\(error, 'collections'\)/);
  assert.match(source, /recoverCommerceAuth\(error, 'orders'\)/);
});

test('dashboard never renders order read failures as commercial zeroes', async () => {
  const source = await read('js/admin/admin-app.js');

  assert.match(source, /const ordersReady = adminRealtimeReady\.orders === true/);
  assert.match(source, /if \(canMetricas && ordersReady\)/);
  assert.match(source, /if \(canVentas && ordersReady\)/);
  assert.match(source, /statOrdersTotalEl\.textContent = '—'/);
  assert.match(source, /statOrdersTodayEl\.textContent = '—'/);
  assert.match(source, /statSalesMonthEl\.textContent = '—'/);
  assert.match(source, /adminRealtimeErrors\.orders/);
  assert.match(source, /refreshRealtimeConsumers\(\);[\s\S]{0,200}\}\);/);
  assert.match(source, /recoverAdminRealtimeAuth\(error, 'orders'\)/);
  assert.match(source, /recoverAdminRealtimeAuth\(error, 'users'\)/);
});
