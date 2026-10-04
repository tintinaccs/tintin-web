import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GLOBAL_TOKENS, ADMIN_TOKENS, normalizeLegacyBrandColor } from '../../js/components/color/esquema-color-catalogo.js';

test('el normalizador conserva tokens y colores hex completos sin crear ciclos', () => {
  const elements = [
    '--color-text-primary: #713C53; --color-button-primary-text: #713C53; --color-background-page: #FFF6FA;',
    'color:#713C53;background:#fff6fa;border-color:#ffffff;',
    'color:#ffffff;background:#fff;'
  ].map(style => ({ style, getAttribute() { return this.style; }, setAttribute(name, value) { this.style=value; }, classList:{add(){}} }));
  vm.runInNewContext(fs.readFileSync(new URL('../../js/components/color/normalizador-color-tema.js', import.meta.url), 'utf8'), {
    window:{}, document:{readyState:'complete',querySelectorAll(selector){return selector==='[style]'?elements:[];}}
  });
  assert.equal(elements[0].style, '--color-text-primary: #713C53; --color-button-primary-text: #713C53; --color-background-page: #FFF6FA;');
  assert.equal(elements[1].style, 'color:var(--tt-text);background:#fff6fa;border-color:var(--tt-surface);');
  assert.equal(elements[2].style, 'color:var(--tt-surface);background:var(--tt-surface);');
});

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
