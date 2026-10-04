import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyProductHandleAliases, normalizeShopifyHandle } from '../../functions/products/[handle].js';

test('Shopify handles with underscores normalize to the legacy alias format', () => {
  assert.equal(normalizeShopifyHandle('sin-nombre-21feb_17-25'), 'sin-nombre-21feb-17-25');
  assert.equal(normalizeShopifyHandle('gafas__royal'), 'gafas-royal');
  assert.equal(normalizeShopifyHandle('invalid/handle'), '');
});

test('legacy product aliases include the Shopify handle preserved by import', () => {
  const aliases = legacyProductHandleAliases({
    name: 'Collar Ismera',
    sourceMetadata: { platform: 'shopify', handle: 'collar-ismera-1' },
  });

  assert.deepEqual(aliases, ['collar-ismera-1', 'collar-ismera']);
});

test('legacy product aliases normalize alternate fields and de-duplicate equivalent slugs', () => {
  const aliases = legacyProductHandleAliases({
    name: 'Reloj Violette',
    source_metadata: { handle: 'reloj-violette' },
    shopifyHandle: 'legacy item #1',
  });

  assert.deepEqual(aliases, ['legacy-item-1', 'reloj-violette']);
});
