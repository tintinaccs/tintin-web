import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function pushProductsToSheets(productIds)');
const end = source.indexOf('window.tintinPushProductsToSheets =', start);

function harness({ role = 'superadmin', responseOk = true } = {}) {
  const requests = [];
  const context = {
    currentRole: role, SUPER_ADMIN: 'qa@example.test',
    currentUser: { email: 'qa@example.test', getIdToken: async () => 'test-session-token' },
    SHEETS_PRODUCT_SYNC_URL: '/api/sheets-product-sync',
    console: { warn() {} },
    fetch: async (url, options) => {
      requests.push({ url, options });
      // Mirror the endpoint's required transport: a body token alone is insufficient.
      const authenticated = options.headers.Authorization === 'Bearer test-session-token';
      return { ok: authenticated && responseOk, status: authenticated ? 200 : 401,
        json: async () => ({ ok: authenticated && responseOk, error: 'Not authenticated or not acknowledged' }) };
    },
  };
  vm.runInNewContext(source.slice(start, end) + '\nthis.push = pushProductsToSheets;', context);
  return { push: context.push, requests };
}

test('every Sheets batch carries the authenticated session and retains its product IDs', async () => {
  const { push, requests } = harness();
  const ids = Array.from({ length: 21 }, (_, index) => `qa-${index}`);
  assert.equal(await push([...ids, ids[0]]), true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.flatMap(({ options }) => JSON.parse(options.body).productIds), ids);
  for (const { url, options } of requests) {
    assert.equal(url, '/api/sheets-product-sync');
    assert.equal(options.headers.Authorization, 'Bearer test-session-token');
    assert.equal(JSON.parse(options.body).idToken, 'test-session-token');
  }
});

test('a failed Sheets acknowledgement remains a failure after authentication', async () => {
  const { push } = harness({ responseOk: false });
  assert.equal(await push(['qa-1']), false);
});

test('non-superadmin and empty batches never send a privileged synchronization request', async () => {
  const denied = harness({ role: 'client' });
  assert.equal(await denied.push(['qa-1']), false);
  assert.equal(denied.requests.length, 0);
  const empty = harness();
  assert.equal(await empty.push([]), false);
  assert.equal(empty.requests.length, 0);
});
