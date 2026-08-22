import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregateCheckoutCart } from '../../js/orders/politica-checkout.js';

const hardening = readFileSync(new URL('../../js/pages/checkout/checkout-hardening.js', import.meta.url), 'utf8');
const loader = readFileSync(new URL('../../js/cargador-mantenimiento-pagina.js', import.meta.url), 'utf8');
const quota = readFileSync(new URL('../../js/pages/checkout/checkout-control-cuota.js', import.meta.url), 'utf8');
const maintenance = readFileSync(new URL('../../js/pages/checkout/checkout-mantenimiento.js', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../../js/create-order-client.js', import.meta.url), 'utf8');

test('hardening runtime waits for scoped cart and blocks empty protected flow', () => {
  assert.match(hardening, /awaitCartReady/);
  assert.match(hardening, /ttCartGuardDisabled/);
  assert.match(hardening, /if \(!getCartLocal\(\)\.length\)/);
  assert.match(hardening, /forceCart/);
});

test('cart controls use lineId so variants cannot mutate the wrong row', () => {
  assert.match(hardening, /row\.dataset\.lineId/);
  assert.match(hardening, /updateQty\(lineId/);
  assert.match(hardening, /removeFromCart\(lineId\)/);
  assert.match(hardening, /dataset\.cartVariant/);
});

test('profile must load and not be blocked before forward navigation', () => {
  assert.match(hardening, /getDoc\(doc\(db, 'users', user\.uid\)\)/);
  assert.match(hardening, /profile\.blocked === true/);
  assert.match(hardening, /const state = await profilePromise/);
});

test('resume target is backed up against lifecycle layers that clear the legacy key', () => {
  assert.match(hardening, /tt_checkout_resume_step_backup_v2/);
  assert.match(hardening, /restoreResumeState/);
  assert.match(hardening, /pagehide.*mirrorResumeState/s);
});

test('same product variants retain separate quantities in the server draft', () => {
  assert.deepEqual(
    aggregateCheckoutCart([
      { id: 'ANILLO', variant: '6', qty: 2 },
      { id: 'ANILLO', variant: '7', qty: 1 },
      { id: 'ANILLO', variant: '6', qty: 1 }
    ]),
    [
      { id: 'ANILLO', variant: '6', qty: 3 },
      { id: 'ANILLO', variant: '7', qty: 1 }
    ]
  );
});

test('order request has timeout and preserves retry-safe draft', () => {
  assert.match(transport, /AbortController/);
  assert.match(transport, /CREATE_ORDER_TIMEOUT_MS/);
  assert.match(transport, /server_timeout/);
  assert.match(transport, /network_error/);
});

test('quota and maintenance only release their own button lock', () => {
  assert.match(quota, /ttQuotaDisabled/);
  assert.match(quota, /ttCartGuardDisabled/);
  assert.match(maintenance, /ttMaintenanceLocked/);
  assert.match(maintenance, /lockedByAnotherGuard/);
});

test('checkout hardening is part of the checkout maintenance bundle', () => {
  assert.match(loader, /pages\/checkout\/checkout-hardening\.js/);
});
