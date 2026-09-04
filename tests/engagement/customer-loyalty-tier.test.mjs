import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../cloudflare/fidelidad-clientes.js', import.meta.url), 'utf8');
const participation = fs.readFileSync(new URL('../../cloudflare/participacion-clientes.js', import.meta.url), 'utf8');
const reviews = fs.readFileSync(new URL('../../js/pages/product/resenas-producto.js', import.meta.url), 'utf8');

test('la fidelidad usa compras válidas y niveles explícitos', () => {
  assert.match(source, /purchaseCount/);
  assert.match(source, /minPurchases: 5/);
  assert.match(source, /minPurchases: 10/);
  assert.match(source, /minPurchases: 20/);
  assert.match(participation, /resolveCustomerTier\(\{ purchaseCount \}, settings\.loyaltyTiers\)/);
  assert.match(participation, /settings\/general/);
  assert.match(participation, /firestoreAdminQueryEqual\(env, 'orders', 'userId', uid\)/);
  assert.match(participation, /rawEmail !== normalizedEmail/);
  assert.match(participation, /No se pudo verificar compras válidas; se omite el pin/);
});

test('el nivel de cliente es solo una identidad pública, no un permiso', () => {
  assert.match(reviews, /tt-public-badge-customer-tier/);
  assert.match(reviews, /customerTier\?\.label/);
  assert.doesNotMatch(participation, /rolePermissions|requireStaffPermission/);
});
