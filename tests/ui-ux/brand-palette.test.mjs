import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_TOKENS, ADMIN_TOKENS, normalizeLegacyBrandColor } from '../../js/components/color/esquema-color-catalogo.js';

test('los esquemas históricos migran el rosa de marca y conservan personalizaciones explícitas', () => {
  for (const tokens of [GLOBAL_TOKENS, ADMIN_TOKENS]) {
    for (const token of tokens.filter(item => item.default === '#F8AACA')) {
      for (const legacy of ['#C52F68', '#AD3F67', '#8b2642', '#711F35', '#c64273', '#9e2451']) {
        assert.equal(normalizeLegacyBrandColor(token, legacy), '#F8AACA', token.key);
      }
      assert.equal(normalizeLegacyBrandColor(token, '#123456'), '#123456');
    }
  }
  const success = GLOBAL_TOKENS.find(item => item.cssVar === '--color-success-text');
  assert.ok(success);
  assert.equal(normalizeLegacyBrandColor(success, '#166534'), '#166534');
});

test('el rosa de la referencia usa tinta malva legible con contraste AA', () => {
  const primary = GLOBAL_TOKENS.find(item => item.key === 'brand-primary').default;
  const channels = primary.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const foreground = GLOBAL_TOKENS.find(item => item.key === 'btn-primary-text').default;
  assert.equal(primary, '#F8AACA');
  assert.equal(foreground, '#713C53');
  const fgLinear = foreground.slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4);
  const fgLum=fgLinear[0]*0.2126+fgLinear[1]*0.7152+fgLinear[2]*0.0722;
  assert.ok((luminance+0.05)/(fgLum+0.05)>=4.5);
  assert.equal(ADMIN_TOKENS.find(item => item.key === 'brand').default, primary);
});

test('los textos guardados con los defaults anteriores migran a malva sin tocar estados semánticos', () => {
  for (const token of [...GLOBAL_TOKENS,...ADMIN_TOKENS].filter(token=>token.legacyDefault)) {
    assert.equal(normalizeLegacyBrandColor(token,token.legacyDefault),token.default);
    assert.equal(normalizeLegacyBrandColor(token,'#123456'),'#123456');
  }
});
