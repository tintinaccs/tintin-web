import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GLOBAL_TOKENS, ADMIN_TOKENS, normalizeLegacyBrandColor, normalizeUnifiedPaletteColor } from '../../js/components/color/esquema-color-catalogo.js';

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

test('la paleta decorativa usa solo cuatro colores base y migra HEX, RGB y transparencias', () => {
  const allowed = new Set(['#F8AACA', '#FDECF2', '#222222', '#FFFFFF']);
  for (const token of [...GLOBAL_TOKENS, ...ADMIN_TOKENS]) {
    if (/success|warning|error|danger|info|available|soldout|promo|whatsapp/.test(token.key)) continue;
    if (token.default.startsWith('rgba(')) continue;
    assert.ok(allowed.has(token.default), `${token.key}: ${token.default}`);
  }
  for (const old of ['#713C53', '#995f77', 'rgb(113, 60, 83)']) {
    assert.equal(normalizeUnifiedPaletteColor(old), '#222222');
  }
  assert.equal(normalizeUnifiedPaletteColor('#F1C8D5'), '#FDECF2');
  assert.equal(normalizeUnifiedPaletteColor('rgba(113, 60, 83, 0.55)'), 'rgba(34,34,34, 0.55)');
  assert.equal(normalizeUnifiedPaletteColor('rgba(212,106,138,0.10)'), 'rgba(248,170,202,0.10)');
  assert.equal(normalizeUnifiedPaletteColor('#166534'), '#166534');
  assert.equal(normalizeUnifiedPaletteColor('#123456'), '#123456');
});

test('la primera pintura migra la caché con la misma paleta que el esquema definitivo', () => {
  const source = fs.readFileSync(new URL('../../js/components/color/esquema-color-instantaneo.js', import.meta.url), 'utf8');
  const start = source.indexOf('function normalizeUnifiedPaletteColor(value)');
  const end = source.indexOf('function applyMap(map)', start);
  const instantNormalize = vm.runInNewContext(`(${source.slice(start, end).trim()})`);
  for (const value of ['#713C53', '#F1E4E7', '#FFF6FA', '#F6B7C8', 'rgb(113, 60, 83)', 'rgba(212,106,138,0.1)', '#166534', '#123456']) {
    assert.equal(instantNormalize(value), normalizeUnifiedPaletteColor(value), value);
  }
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

test('el rosa Tintín usa negro suave legible con contraste AA', () => {
  const primary = GLOBAL_TOKENS.find(item => item.key === 'brand-primary').default;
  const channels = primary.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const foreground = GLOBAL_TOKENS.find(item => item.key === 'btn-primary-text').default;
  assert.equal(primary, '#F8AACA');
  assert.equal(foreground, '#222222');
  const fgLinear = foreground.slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4);
  const fgLum=fgLinear[0]*0.2126+fgLinear[1]*0.7152+fgLinear[2]*0.0722;
  assert.ok((luminance+0.05)/(fgLum+0.05)>=4.5);
  assert.equal(ADMIN_TOKENS.find(item => item.key === 'brand').default, primary);
});

test('los textos guardados con los defaults anteriores migran sin tocar estados semánticos', () => {
  for (const token of [...GLOBAL_TOKENS,...ADMIN_TOKENS].filter(token=>token.legacyDefault)) {
    assert.equal(normalizeLegacyBrandColor(token,token.legacyDefault),token.default);
    assert.equal(normalizeLegacyBrandColor(token,'#123456'),'#123456');
  }
});

test('WhatsApp migra el rosa a verde y blanco también en la primera pintura', () => {
  const expected = { 'btn-whatsapp-bg':'#0d8043', 'btn-whatsapp-text':'#FFFFFF', 'btn-whatsapp-hover':'#0a6835' };
  const map = {};
  for (const [key,color] of Object.entries(expected)) {
    const token = GLOBAL_TOKENS.find(item=>item.key===key);
    assert.equal(token.default,color);
    assert.equal(normalizeLegacyBrandColor(token,token.legacyDefault),color);
    assert.equal(normalizeLegacyBrandColor(token,color),color);
    map[token.cssVar]=token.legacyDefault;
  }
  const source=fs.readFileSync(new URL('../../js/components/color/esquema-color-instantaneo.js',import.meta.url),'utf8');
  const start=source.indexOf('function normalizeUnifiedPaletteColor(value)');
  const end=source.indexOf('function currentBreakpoint()',start);
  const result={};
  const context=vm.createContext({root:{style:{setProperty:(key,value)=>result[key]=value}},isSafeColorValue:()=>true});
  vm.runInContext(source.slice(start,end),context);
  context.applyMap(map);
  for(const [key,color] of Object.entries(expected))assert.equal(result[GLOBAL_TOKENS.find(item=>item.key===key).cssVar],color);
  context.applyMap(result);
  assert.equal(result['--color-button-whatsapp-text'],'#FFFFFF');
});
