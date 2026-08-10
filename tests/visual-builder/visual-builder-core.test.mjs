import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRestorableVisualHistory, requireVisualPageId, safeVisualHref, safeVisualImage, safeVisualVideoUrl,
  sanitizeVisualConfig, sanitizeVisualContent, sanitizeVisualDraft, VISUAL_BUILDER_LIMITS, VISUAL_TOP_ANCHOR,
} from '../../cloudflare/visual-builder-core.js';

test('solo admite páginas registradas', () => {
  assert.equal(requireVisualPageId('index'), 'index');
  assert.throws(() => requireVisualPageId('checkout'), /no está habilitada/);
  assert.throws(() => requireVisualPageId('../users'), /no está habilitada/);
});

test('sanea estilos y nunca conserva CSS arbitrario', () => {
  const clean = sanitizeVisualConfig('index', { sections: { hero: {
    background: 'url(https://evil.test)', textColor: '#AABBCC', accentColor: '#fff;display:none',
    spacing: '999px', width: 'expression(alert(1))', align: 'justify', animation: 'spin',
  } } });
  assert.equal(clean.sections.hero.background, '');
  assert.equal(clean.sections.hero.textColor, '#aabbcc');
  assert.equal(clean.sections.hero.accentColor, '');
  assert.deepEqual({ spacing: clean.sections.hero.spacing, width: clean.sections.hero.width, align: clean.sections.hero.align, animation: clean.sections.hero.animation }, {
    spacing: 'normal', width: 'contained', align: 'center', animation: 'none',
  });
});

test('bloques están limitados, deduplicados y conectados a secciones reales', () => {
  const raw = Array.from({ length: VISUAL_BUILDER_LIMITS.maxCustomBlocks + 8 }, (_, index) => ({
    id: index < 2 ? 'duplicado' : `x-${index}`, type: index === 0 ? 'script' : 'products', afterSection: 'checkout', count: 999,
    href: 'javascript:alert(1)', image: 'https://evil.test/tracker.png', title: '<img onerror=alert(1)>',
  }));
  const blocks = sanitizeVisualConfig('index', { customBlocks: raw }).customBlocks;
  assert.ok(blocks.length <= VISUAL_BUILDER_LIMITS.maxCustomBlocks);
  assert.equal(blocks[0].type, 'section');
  assert.notEqual(blocks[0].afterSection, 'checkout');
  assert.equal(blocks[0].href, 'catalogo.html');
  assert.equal(blocks[0].image, '');
  assert.equal(blocks.filter(item => item.id === 'duplicado').length, 1);
  assert.equal(blocks.at(-1).count, 8);
});

test('imágenes y enlaces usan listas permitidas', () => {
  assert.equal(safeVisualImage('assets-tintin/images/general/logo.png'), 'assets-tintin/images/general/logo.png');
  assert.equal(safeVisualImage('https://res.cloudinary.com/demo/image/upload/a.webp'), 'https://res.cloudinary.com/demo/image/upload/a.webp');
  assert.equal(safeVisualImage('data:image/svg+xml,x'), '');
  assert.equal(safeVisualHref('catalogo.html?cat=relojes'), 'catalogo.html?cat=relojes');
  assert.equal(safeVisualHref('javascript:alert(1)'), 'catalogo.html');
});

test('contenido queda limitado al esquema existente', () => {
  const clean = sanitizeVisualContent('index', { hero: { title: 'A'.repeat(1000), unknown: 'secret', primaryHref: 'javascript:alert(1)' }, checkout: { price: 1 } });
  assert.equal(clean.hero.title.length, 220);
  assert.equal(clean.hero.unknown, undefined);
  assert.equal(clean.checkout, undefined);
  assert.equal(clean.hero.primaryHref, 'catalogo.html');
});

test('los embeds de video solo admiten YouTube, Vimeo o Cloudinary', () => {
  assert.equal(safeVisualVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(safeVisualVideoUrl('https://player.vimeo.com/video/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(safeVisualVideoUrl('https://res.cloudinary.com/demo/video/upload/dog.mp4'), 'https://res.cloudinary.com/demo/video/upload/dog.mp4');
  assert.equal(safeVisualVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(safeVisualVideoUrl('https://evil.test/embed'), '');
  assert.equal(safeVisualVideoUrl('javascript:alert(1)'), '');
  assert.equal(safeVisualVideoUrl('data:text/html,<script>alert(1)</script>'), '');
});

test('un bloque nuevo admite tipos ampliados y el ancla especial de "arriba de todo"', () => {
  const clean = sanitizeVisualConfig('index', { customBlocks: [
    { id: 'faq-1', type: 'faq', afterSection: VISUAL_TOP_ANCHOR, items: [{ q: 'A', a: 'B' }, { q: '', a: 'sin pregunta' }] },
    { id: 'video-1', type: 'video', afterSection: 'not-a-real-section', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 'columns-1', type: 'columns', imageSide: 'weird-value' },
  ] });
  assert.equal(clean.customBlocks[0].afterSection, VISUAL_TOP_ANCHOR);
  assert.deepEqual(clean.customBlocks[0].items, [{ q: 'A', a: 'B' }]);
  assert.equal(clean.customBlocks[1].afterSection, 'hero');
  assert.equal(clean.customBlocks[1].videoUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(clean.customBlocks[2].imageSide, 'left');
});

test('draft no puede cambiar de página ni restaurar auditoría no publicada', () => {
  const draft = sanitizeVisualDraft('faq', { pageId: 'checkout' }, { questions: { visible: false } });
  assert.equal(draft.pageId, 'faq');
  assert.equal(draft.config.pageId, 'faq');
  assert.equal(isRestorableVisualHistory({ pageId: 'faq', action: 'save', version: 2, snapshot: {} }, 'faq'), false);
  assert.equal(isRestorableVisualHistory({ pageId: 'faq', action: 'publish', version: 2, snapshot: {} }, 'faq'), true);
  assert.equal(isRestorableVisualHistory({ pageId: 'index', action: 'publish', version: 2, snapshot: {} }, 'faq'), false);
});
