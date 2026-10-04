import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_TOKENS, ADMIN_TOKENS, normalizeLegacyBrandColor } from '../../js/components/color/esquema-color-catalogo.js';

test('los esquemas históricos migran el rosa de marca y conservan personalizaciones explícitas', () => {
  for (const tokens of [GLOBAL_TOKENS, ADMIN_TOKENS]) {
    for (const token of tokens.filter(item => item.default === '#C52F68')) {
      for (const legacy of ['#AD3F67', '#8b2642', '#711F35', '#c64273', '#9e2451']) {
        assert.equal(normalizeLegacyBrandColor(token, legacy), '#C52F68', token.key);
      }
      assert.equal(normalizeLegacyBrandColor(token, '#123456'), '#123456');
    }
  }
  const success = GLOBAL_TOKENS.find(item => item.cssVar === '--color-success-text');
  assert.ok(success);
  assert.equal(normalizeLegacyBrandColor(success, '#166534'), '#166534');
});

test('el rosa uniforme permite texto blanco pequeño con contraste AA', () => {
  const primary = GLOBAL_TOKENS.find(item => item.key === 'brand-primary').default;
  const channels = primary.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  assert.ok(1.05 / (luminance + 0.05) >= 4.5);
  assert.equal(ADMIN_TOKENS.find(item => item.key === 'brand').default, primary);
});
