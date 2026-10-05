import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetsInboundSecret, sheetsInboundSecretStatus } from '../../cloudflare/secretos-sheets.js';
import { onRequestPost as productsWebhook } from '../../functions/api/sheets-products-webhook.js';

test('cada webhook usa su secreto propio y, si falta, el compartido', () => {
  const shared = { SHEETS_ENGAGEMENT_SECRET: 'compartido' };
  assert.equal(sheetsInboundSecret(shared, 'admin'), 'compartido');
  const split = { ...shared, SHEETS_ADMIN_WEBHOOK_SECRET: 'solo-admin' };
  assert.equal(sheetsInboundSecret(split, 'admin'), 'solo-admin');
  assert.equal(sheetsInboundSecret(split, 'products'), 'compartido');
  assert.deepEqual(sheetsInboundSecretStatus(split), { admin: 'dedicated', products: 'shared', snapshot: 'shared' });
  assert.deepEqual(sheetsInboundSecretStatus({}), { admin: 'missing', products: 'missing', snapshot: 'missing' });
  assert.throws(() => sheetsInboundSecret(shared, 'otro'), /desconocido/);
});

test('con secreto propio de productos, el compartido ya no alcanza para editar el catálogo', async () => {
  const env = { SHEETS_ENGAGEMENT_SECRET: 'compartido', SHEETS_PRODUCTS_WEBHOOK_SECRET: 'solo-productos' };
  const call = secret => productsWebhook({
    request: new Request('https://tintinaccesorios.pages.dev/api/sheets-products-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Tintin-Sheets-Secret': secret },
      body: JSON.stringify({ action: 'diagnose' }),
    }),
    env,
  });
  assert.equal((await call('compartido')).status, 401);
  assert.notEqual((await call('solo-productos')).status, 401);
});
