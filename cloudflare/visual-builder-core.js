import {
  CONTENT_PAGE_IDS,
  getPageDefaults,
  getPageSchema,
  mergeContent,
  sanitizeSection,
} from '../js/core/store/esquema-contenido.js';

export const VISUAL_BUILDER_LIMITS = Object.freeze({
  bodyBytes: 128_000,
  maxCustomBlocks: 24,
  maxHistory: 100,
  maxText: 4000,
  maxImages: 8,
  maxFaqItems: 8,
});

export const VISUAL_BLOCK_TYPES = Object.freeze([
  'banner', 'text', 'products', 'gallery', 'promotion', 'button', 'section', 'collections',
  'testimonial', 'video', 'faq', 'columns', 'divider',
]);

// Ancla especial: un bloque con esta ubicación se inserta antes de la
// primera sección de la página en vez de después de una sección existente.
export const VISUAL_TOP_ANCHOR = '__top__';

export const VISUAL_STYLE_OPTIONS = Object.freeze({
  spacing: ['compact', 'normal', 'roomy'],
  width: ['contained', 'wide', 'full'],
  align: ['left', 'center', 'right'],
  radius: ['none', 'small', 'medium', 'large'],
  shadow: ['none', 'soft', 'medium', 'large'],
  animation: ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'pop'],
});

const SAFE_PAGE_IDS = new Set(CONTENT_PAGE_IDS);
const SAFE_HREF = /^(?:index|about|nosotros|catalogo|collections|contact|envios|preguntas-frecuentes|cambios-devoluciones)\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i;
const SAFE_ASSET = /^assets-tintin\/[A-Za-z0-9_./-]+$/;
// Embeds de video: solo se acepta un puñado de orígenes de confianza (nunca
// una URL arbitraria) para que el iframe nunca pueda apuntar a un sitio
// ajeno — la misma lógica de "lista blanca, nunca lista negra" que ya usa
// safeVisualHref/safeVisualImage.
const SAFE_YOUTUBE_EMBED = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_VIMEO_EMBED = /^https:\/\/player\.vimeo\.com\/video\/\d{4,12}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_CLOUDINARY_VIDEO = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+\/video\/upload\/[A-Za-z0-9_./,%~-]+$/i;

function text(value, max = VISUAL_BUILDER_LIMITS.maxText) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function requireVisualPageId(value) {
  const pageId = String(value || '').trim().toLowerCase();
  if (!SAFE_PAGE_IDS.has(pageId)) throw new Error('La página no está habilitada para el editor visual.');
  return pageId;
}

export function safeVisualColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

export function safeVisualHref(value) {
  const href = String(value || '').trim();
  if (SAFE_HREF.test(href)) return href;
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9_~:/?#\[\]@!$&'()*+,;=%.-]*)?$/i.test(href)) return href;
  return 'catalogo.html';
}

export function safeVisualImage(value) {
  const src = String(value || '').trim();
  if (SAFE_ASSET.test(src)) return src;
  if (/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+$/i.test(src)) return src;
  return '';
}

export function safeVisualVideoUrl(value) {
  const src = String(value || '').trim();
  if (SAFE_YOUTUBE_EMBED.test(src) || SAFE_VIMEO_EMBED.test(src) || SAFE_CLOUDINARY_VIDEO.test(src)) return src;
  return '';
}

function option(group, value, fallback) {
  return VISUAL_STYLE_OPTIONS[group].includes(value) ? value : fallback;
}

export function sanitizeVisualStyle(raw = {}) {
  return {
    background: safeVisualColor(raw.background),
    textColor: safeVisualColor(raw.textColor),
    accentColor: safeVisualColor(raw.accentColor),
    spacing: option('spacing', raw.spacing, 'normal'),
    width: option('width', raw.width, 'contained'),
    align: option('align', raw.align, 'center'),
    radius: option('radius', raw.radius, 'none'),
    shadow: option('shadow', raw.shadow, 'none'),
    animation: option('animation', raw.animation, 'none'),
  };
}

function sanitizeBlock(raw, index, pageSchema) {
  const type = VISUAL_BLOCK_TYPES.includes(raw?.type) ? raw.type : 'section';
  const sectionIds = Object.keys(pageSchema.sections || {});
  const id = text(raw?.id || `${type}-${index + 1}`, 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || `${type}-${index + 1}`;
  const validAnchor = raw?.afterSection === VISUAL_TOP_ANCHOR || sectionIds.includes(raw?.afterSection);
  const block = {
    id,
    type,
    afterSection: validAnchor ? raw.afterSection : (sectionIds[0] || VISUAL_TOP_ANCHOR),
    eyebrow: text(raw?.eyebrow || 'TINTÍN', 80),
    title: text(raw?.title || 'Nueva sección', 180),
    text: text(raw?.text || '', 1200),
    buttonLabel: text(raw?.buttonLabel || '', 80),
    href: safeVisualHref(raw?.href),
    image: safeVisualImage(raw?.image),
    imageAlt: text(raw?.imageAlt || '', 140),
    count: Math.max(1, Math.min(8, Number(raw?.count) || 4)),
    category: text(raw?.category || '', 120),
    videoUrl: safeVisualVideoUrl(raw?.videoUrl),
    imageSide: raw?.imageSide === 'right' ? 'right' : 'left',
    style: sanitizeVisualStyle(raw?.style),
  };
  if (type === 'gallery') {
    block.images = (Array.isArray(raw?.images) ? raw.images : [])
      .slice(0, VISUAL_BUILDER_LIMITS.maxImages)
      .map(item => ({ src: safeVisualImage(item?.src), alt: text(item?.alt || '', 140) }))
      .filter(item => item.src);
  }
  if (type === 'faq') {
    block.items = (Array.isArray(raw?.items) ? raw.items : [])
      .slice(0, VISUAL_BUILDER_LIMITS.maxFaqItems)
      .map(item => ({ q: text(item?.q || '', 180), a: text(item?.a || '', 1200) }))
      .filter(item => item.q && item.a);
  }
  return block;
}

function reorderableSectionIds(pageSchema) {
  return Object.entries(pageSchema.sections || {}).filter(([, schema]) => !schema.global).map(([id]) => id);
}

// Nunca confía en el orden que manda el cliente a ciegas: descarta ids
// inventados/duplicados y, si falta alguna sección real de la página, la
// agrega al final — así una sección nunca puede "desaparecer" del sitio por
// un sectionOrder incompleto o corrupto. Las secciones "global" (el pie de
// página compartido por todo el sitio) nunca entran acá: siempre quedan
// ancladas al final, reordenarlas rompería la consistencia entre páginas.
function sanitizeSectionOrder(raw, pageSchema) {
  const reorderable = reorderableSectionIds(pageSchema);
  const seen = new Set();
  const order = (Array.isArray(raw) ? raw : [])
    .filter(id => reorderable.includes(id) && !seen.has(id) && seen.add(id));
  reorderable.forEach(id => { if (!seen.has(id)) { order.push(id); seen.add(id); } });
  return order;
}

export function sanitizeVisualConfig(pageIdValue, raw = {}) {
  const pageId = requireVisualPageId(pageIdValue);
  const pageSchema = getPageSchema(pageId);
  const sections = {};
  Object.keys(pageSchema.sections || {}).forEach(sectionId => {
    sections[sectionId] = sanitizeVisualStyle(raw?.sections?.[sectionId]);
  });
  const seen = new Set();
  const customBlocks = (Array.isArray(raw?.customBlocks) ? raw.customBlocks : [])
    .slice(0, VISUAL_BUILDER_LIMITS.maxCustomBlocks)
    .map((block, index) => sanitizeBlock(block, index, pageSchema))
    .filter(block => !seen.has(block.id) && seen.add(block.id));
  return { pageId, sections, sectionOrder: sanitizeSectionOrder(raw?.sectionOrder, pageSchema), customBlocks };
}

export function sanitizeVisualContent(pageIdValue, raw = {}) {
  const pageId = requireVisualPageId(pageIdValue);
  const defaults = getPageDefaults(pageId);
  const merged = mergeContent(defaults, raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  return Object.fromEntries(Object.keys(getPageSchema(pageId).sections || {}).map(sectionId => [
    sectionId,
    sanitizeSection(pageId, sectionId, merged[sectionId]),
  ]));
}

export function sanitizeVisualDraft(pageId, config, content) {
  const cleanPageId = requireVisualPageId(pageId);
  return {
    pageId: cleanPageId,
    config: sanitizeVisualConfig(cleanPageId, config),
    content: sanitizeVisualContent(cleanPageId, content),
  };
}

export function isRestorableVisualHistory(entry, pageId) {
  return Boolean(entry)
    && entry.pageId === pageId
    && ['publish', 'restore'].includes(entry.action)
    && Number(entry.version) > 0
    && entry.snapshot
    && typeof entry.snapshot === 'object';
}
