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
    spacing: '999px', width: 'expression(alert(1))', align: 'justify', animation: 'spin', variant: '<style>',
    responsive: { mobile: { visibility: 'hide', columns: '2', spacing: 'roomy' }, tablet: { visibility: 'javascript:1', columns: '999' } },
  } } });
  assert.equal(clean.sections.hero.background, '');
  assert.equal(clean.sections.hero.textColor, '#aabbcc');
  assert.equal(clean.sections.hero.accentColor, '');
  assert.deepEqual({ spacing: clean.sections.hero.spacing, width: clean.sections.hero.width, align: clean.sections.hero.align, animation: clean.sections.hero.animation, variant: clean.sections.hero.variant }, {
    spacing: 'normal', width: 'contained', align: 'center', animation: 'none', variant: 'default',
  });
  assert.deepEqual(clean.sections.hero.responsive.mobile, {
    visibility: 'hide', spacing: 'roomy', width: 'inherit', align: 'inherit', columns: '2', imageFit: 'inherit',
  });
  assert.equal(clean.sections.hero.responsive.tablet.visibility, 'inherit');
  assert.equal(clean.sections.hero.responsive.tablet.columns, 'inherit');
  assert.equal(clean.sections.hero.css, undefined);
  assert.equal(clean.sections.hero.style, undefined);
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
  assert.equal(blocks[0].href, '/catalogo');
  assert.equal(blocks[0].image, '');
  assert.equal(blocks.filter(item => item.id === 'duplicado').length, 1);
  assert.equal(blocks.at(-1).count, 12);
});

test('imágenes y enlaces usan listas permitidas y rutas internas limpias', () => {
  assert.equal(safeVisualImage('assets-tintin/images/general/logo.png'), 'assets-tintin/images/general/logo.png');
  assert.equal(safeVisualImage('https://res.cloudinary.com/demo/image/upload/a.webp'), 'https://res.cloudinary.com/demo/image/upload/a.webp');
  assert.equal(safeVisualImage('data:image/svg+xml,x'), '');
  assert.equal(safeVisualHref('catalogo.html?cat=relojes'), '/catalogo?cat=relojes');
  assert.equal(safeVisualHref('/catalogo?cat=relojes'), '/catalogo?cat=relojes');
  assert.equal(safeVisualHref('about.html#historia'), '/about#historia');
  assert.equal(safeVisualHref('javascript:alert(1)'), '/catalogo');
});

test('contenido queda limitado al esquema existente', () => {
  const clean = sanitizeVisualContent('index', { hero: { title: 'A'.repeat(1000), unknown: 'secret', primaryHref: 'javascript:alert(1)' }, checkout: { price: 1 } });
  assert.equal(clean.hero.title.length, 220);
  assert.equal(clean.hero.unknown, undefined);
  assert.equal(clean.checkout, undefined);
  assert.equal(clean.hero.primaryHref, '/catalogo');
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

test('bloques creativos nuevos permanecen dentro de listas blancas', () => {
  const clean = sanitizeVisualConfig('index', { customBlocks: [
    { id: 'faq-1', type: 'faq', afterSection: VISUAL_TOP_ANCHOR, items: [{ q: 'A', a: 'B' }, { q: '', a: 'sin pregunta' }] },
    { id: 'video-1', type: 'video', afterSection: 'not-a-real-section', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 'columns-1', type: 'columns', imageSide: 'weird-value' },
    { id: 'features-1', type: 'features', items: [{ title: 'Envíos', text: 'A todo el país' }, { q: '<b>Seguro</b>', a: 'Sin HTML ejecutable' }] },
    { id: 'countdown-1', type: 'countdown', endAt: 'not-a-date', expiredText: '<script>x</script>' },
    { id: 'marquee-1', type: 'marquee', marqueeSpeed: 'turbo' },
    { id: 'spacer-1', type: 'spacer', spacerSize: 'giant' },
  ] });
  assert.equal(clean.customBlocks[0].afterSection, VISUAL_TOP_ANCHOR);
  assert.deepEqual(clean.customBlocks[0].items, [{ q: 'A', a: 'B' }]);
  assert.equal(clean.customBlocks[1].afterSection, 'hero');
  assert.equal(clean.customBlocks[1].videoUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(clean.customBlocks[2].imageSide, 'left');
  assert.deepEqual(clean.customBlocks[3].items[0], { q: 'Envíos', a: 'A todo el país' });
  assert.equal(clean.customBlocks[4].endAt, '');
  assert.equal(clean.customBlocks[5].marqueeSpeed, 'normal');
  assert.equal(clean.customBlocks[6].spacerSize, 'medium');
});

test('variantes de layout válidas sobreviven y las inválidas vuelven al default', () => {
  const clean = sanitizeVisualConfig('index', { customBlocks: [
    { id: 'gallery-1', type: 'gallery', style: { variant: 'mosaic', imageFit: 'contain', radius: 'pill', shadow: 'floating', animation: 'reveal' } },
    { id: 'gallery-2', type: 'gallery', style: { variant: 'url(evil)', imageFit: 'expression()', radius: '100vw' } },
  ] });
  assert.deepEqual({
    variant: clean.customBlocks[0].style.variant,
    imageFit: clean.customBlocks[0].style.imageFit,
    radius: clean.customBlocks[0].style.radius,
    shadow: clean.customBlocks[0].style.shadow,
    animation: clean.customBlocks[0].style.animation,
  }, { variant: 'mosaic', imageFit: 'contain', radius: 'pill', shadow: 'floating', animation: 'reveal' });
  assert.equal(clean.customBlocks[1].style.variant, 'default');
  assert.equal(clean.customBlocks[1].style.imageFit, 'cover');
  assert.equal(clean.customBlocks[1].style.radius, 'none');
});

test('el orden de secciones se sanea: solo ids reales, sin duplicados, nunca pierde una sección, y el pie de página nunca se reordena', () => {
  const clean = sanitizeVisualConfig('index', { sectionOrder: ['reviews', 'reviews', 'not-a-real-section', 'hero', 'footer'] });
  assert.deepEqual(clean.sectionOrder.slice(0, 2), ['reviews', 'hero']);
  assert.equal(clean.sectionOrder.length, Object.keys(clean.sections).length - 1);
  assert.ok(!clean.sectionOrder.includes('footer'));
  assert.ok(new Set(clean.sectionOrder).size === clean.sectionOrder.length);

  const empty = sanitizeVisualConfig('index', {});
  assert.deepEqual(empty.sectionOrder, ['hero', 'trust', 'editorial_bag', 'collections_header', 'editorial_relojes', 'products_header', 'reviews']);
});

test('draft no puede cambiar de página ni restaurar auditoría no publicada', () => {
  const draft = sanitizeVisualDraft('faq', { pageId: 'checkout' }, { questions: { visible: false } });
  assert.equal(draft.pageId, 'faq');
  assert.equal(draft.config.pageId, 'faq');
  assert.equal(isRestorableVisualHistory({ pageId: 'faq', action: 'save', version: 2, snapshot: {} }, 'faq'), false);
  assert.equal(isRestorableVisualHistory({ pageId: 'faq', action: 'publish', version: 2, snapshot: {} }, 'faq'), true);
  assert.equal(isRestorableVisualHistory({ pageId: 'index', action: 'publish', version: 2, snapshot: {} }, 'faq'), false);
});
