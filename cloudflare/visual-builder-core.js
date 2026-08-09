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
});

export const VISUAL_BLOCK_TYPES = Object.freeze([
  'banner', 'text', 'products', 'gallery', 'promotion', 'button', 'section', 'collections',
]);

export const VISUAL_STYLE_OPTIONS = Object.freeze({
  spacing: ['compact', 'normal', 'roomy'],
  width: ['contained', 'wide', 'full'],
  align: ['left', 'center'],
  radius: ['none', 'small', 'medium', 'large'],
  shadow: ['none', 'soft', 'medium'],
  animation: ['none', 'fade', 'slide-up', 'scale'],
});

const SAFE_PAGE_IDS = new Set(CONTENT_PAGE_IDS);
const SAFE_HREF = /^(?:index|about|nosotros|catalogo|collections|contact|envios|preguntas-frecuentes|cambios-devoluciones)\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i;
const SAFE_ASSET = /^assets-tintin\/[A-Za-z0-9_./-]+$/;

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
  const block = {
    id,
    type,
    afterSection: sectionIds.includes(raw?.afterSection) ? raw.afterSection : (sectionIds[0] || ''),
    eyebrow: text(raw?.eyebrow || 'TINTÍN', 80),
    title: text(raw?.title || 'Nueva sección', 180),
    text: text(raw?.text || '', 1200),
    buttonLabel: text(raw?.buttonLabel || '', 80),
    href: safeVisualHref(raw?.href),
    image: safeVisualImage(raw?.image),
    imageAlt: text(raw?.imageAlt || '', 140),
    count: Math.max(1, Math.min(8, Number(raw?.count) || 4)),
    category: text(raw?.category || '', 120),
    style: sanitizeVisualStyle(raw?.style),
  };
  if (type === 'gallery') {
    block.images = (Array.isArray(raw?.images) ? raw.images : [])
      .slice(0, VISUAL_BUILDER_LIMITS.maxImages)
      .map(item => ({ src: safeVisualImage(item?.src), alt: text(item?.alt || '', 140) }))
      .filter(item => item.src);
  }
  return block;
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
  return { pageId, sections, customBlocks };
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
