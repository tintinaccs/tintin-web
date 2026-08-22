import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../js/orders/pedido-checkout-seguro.js', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../../js/components/cart/sincronizacion-carrito.js', import.meta.url), 'utf8');

test('checkout waits for the scoped cart before using it', () => {
  assert.match(source, /awaitCartReady/);
  assert.match(source, /async function readyCartItems\(\)/);
  assert.match(source, /await awaitCartReady\(\)/);
  assert.match(source, /const items = await readyCartItems\(\)/);
});

test('checkout recovers a pending guest cart after auth scope switch', () => {
  assert.match(source, /GUEST_CART_KEY = 'tt_cart_guest'/);
  assert.match(source, /const guestItems = readGuestCartForRecovery\(\)/);
  assert.match(source, /items = setCartLocal\(guestItems\)/);
  assert.match(source, /localStorage\.removeItem\(GUEST_CART_KEY\)/);
});

test('cart runtime preserves the guest cart when App Check falls back offline', () => {
  assert.match(cartSource, /if \(!ready\) \{/);
  assert.match(cartSource, /if \(guestAtLogin\.length\) \{/);
  assert.match(cartSource, /addGuestQuantities\(currentLocalCart\(\), guestAtLogin\)/);
  assert.match(cartSource, /rawStringSet\(dirtyKey\(currentUser\.uid\), '1'\)/);
  assert.match(cartSource, /rawSet\(GUEST_CART_KEY, \[\]\)/);
});

test('every forward checkout step is guarded by a non-empty cart', () => {
  assert.match(source, /#btn-step1-next,#btn-step2-next,#btn-step3-next,#btn-step4-next/);
  assert.match(source, /const items = await ensureCartAvailable\(\)/);
  assert.match(source, /if \(!items\.length\) return/);
  assert.match(source, /forceBackToCart/);
  assert.match(source, /activeCheckoutStep\(\) > 0/);
});

test('CI and invoice defaults are persisted and prefilled from the user profile', () => {
  assert.match(source, /CHECKOUT_DEFAULTS_FIELD = 'checkoutDefaults'/);
  assert.match(source, /async function prefillCheckoutDefaults\(user\)/);
  assert.match(source, /async function persistCheckoutDefaults\(draft\)/);
  assert.match(source, /invoice: \{ razonSocial, ruc \}/);
  assert.match(source, /await persistCheckoutDefaults\(draft\)/);
});

test('a successful server order is not turned into an error by cart cleanup', () => {
  assert.match(source, /const result = await createOrderOnServer\(draft\)/);
  assert.match(source, /orderCompleted = true/);
  assert.match(source, /await clearCart\(\)/);
  assert.match(source, /El pedido se creó, pero no se pudo limpiar el carrito local/);
});
