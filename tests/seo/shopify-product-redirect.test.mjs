import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyProductHandleAliases } from '../../functions/products/[handle].js';

test('redirect aliases include the Shopify handle preserved by the import pipeline', () => {
  const aliases = legacyProductHandleAliases({
    name: 'Collar Ismera',
    sourceMetadata: { platform: 'shopify', handle: 'collar-ismera-1' },
  });

  assert.deepEqual(aliases, ['collar-ismera-1', 'collar-ismera']);
});

test('legacy aliases normalize alternate fields and de-duplicate equivalent slugs', () => {
  const aliases = legacyProductHandleAliases({
    name: 'Reloj Violette',
    source_metadata: { handle: 'reloj-violette' },
    shopifyHandle: 'legacy item #1',
  });

  assert.deepEqual(aliases, ['legacy-item-1', 'reloj-violette']);
});
