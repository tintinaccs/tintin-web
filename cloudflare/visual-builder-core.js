import {
  CONTENT_PAGE_IDS,
  getPageDefaults,
  getPageSchema,
  mergeContent,
  sanitizeSection,
} from '../js/core/store/esquema-contenido.js';
import {
  VISUAL_BLOCK_TYPES,
  VISUAL_STYLE_OPTIONS,
} from '../js/core/store/contratos-visual-builder.js';

export { VISUAL_BLOCK_TYPES, VISUAL_STYLE_OPTIONS };

export const VISUAL_BUILDER_LIMITS = Object.freeze({
  bodyBytes: 256_000,
  maxCustomBlocks: 40,
  maxHistory: 100,
  maxText: 4000,
  maxImages: 12,
  maxFaqItems: 16,
  maxFeatureItems: 12,
});

export const VISUAL_TOP_ANCHOR = '__top__';
export const VISUAL_DEVICES = Object.freeze(['desktop', 'tablet', 'mobile']);

const SAFE_PAGE_IDS = new Set(CONTENT_PAGE_IDS);
const CLEAN_INTERNAL_ROUTES = Object.freeze({
  index: '/',
  'index.html': '/',
  about: '/about',
  'about.html': '/about',
  nosotros: '/about',
  'nosotros.html': '/about',
  catalogo: '/catalogo',
  'catalogo.html': '/catalogo',
  collections: '/collections',
  'collections.html': '/collections',
  product: '/product',
  'product.html': '/product',
  checkout: '/checkout',
  'checkout.html': '/checkout',
  login: '/login',
  'login.html': '/login',
  perfil: '/perfil',
  'perfil.html': '/perfil',
  contact: '/contact',
  'contact.html': '/contact',
  envios: '/envios',
  'envios.html': '/envios',
  'preguntas-frecuentes': '/preguntas-frecuentes',
  'preguntas-frecuentes.html': '/preguntas-frecuentes',
  'cambios-devoluciones': '/cambios-devoluciones',
  'cambios-devoluciones.html': '/cambios-devoluciones',
  terminos: '/terminos',
  'terminos.html': '/terminos',
  privacidad: '/privacidad',
  'privacidad.html': '/privacidad',
});
const SAFE_ASSET = /^assets-tintin\/[A-Za-z0-9_./-]+$/;
const SAFE_YOUTUBE_EMBED = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_VIMEO_EMBED = /^https:\/\/player\.vimeo\.com\/video\/\d{4,12}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_CLOUDINARY_VIDEO = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+\/video\/upload\/[A-Za-z0-9_./,%~-]+$/i;

function text(value, max = VISUAL_BUILDER_LIMITS.maxText) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function option(group, value, fallback) {
  return VISUAL_STYLE_OPTIONS[group].includes(value) ? value : fallback;
}

function safeIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString();
}

function normalizeInternalHref(value) {
  const href = String(value || '').trim();
  const match = href.match(/^(?:\.\/|\/)?([^/?#]+)([?#][A-Za-z0-9_=&%+.#:-]*)?$/i);
  if (!match) return '';
  const route = CLEAN_INTERNAL_ROUTES[match[1].toLowerCase()];
  return route ? `${route}${match[2] || ''}` : '';
}

function safeExternalHref(value) {
  const href = String(value || '').trim();
  return /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9_~:/?#\[\]@!$&'()*+,;=%.-]*)?$/i.test(href) ? href : '';
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

export function safeVisualHref(value, fallback = '/catalogo') {
  const href = String(value || '').trim();
  const internal = normalizeInternalHref(href);
  if (internal) return internal;
  const external = safeExternalHref(href);
  if (external) return external;

  const fallbackValue = String(fallback || '').trim();
  if (!fallbackValue) return '';
  return normalizeInternalHref(fallbackValue) || safeExternalHref(fallbackValue) || '/catalogo';
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

function sanitizeResponsiveOverride(raw = {}) {
  return {
    visibility: option('visibility', raw.visibility, 'inherit'),
    spacing: raw.spacing === 'inherit' ? 'inherit' : option('spacing', raw.spacing, 'inherit'),
    width: raw.width === 'inherit' ? 'inherit' : option('width', raw.width, 'inherit'),
    align: raw.align === 'inherit' ? 'inherit' : option('align', raw.align, 'inherit'),
    columns: option('columns', String(raw.columns ?? 'inherit'), 'inherit'),
    imageFit: raw.imageFit === 'inherit' ? 'inherit' : option('imageFit', raw.imageFit, 'inherit'),
  };
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
    variant: option('variant', raw.variant, 'default'),
    imageFit: option('imageFit', raw.imageFit, 'cover'),
    responsive: Object.fromEntries(VISUAL_DEVICES.map(device => [device, sanitizeResponsiveOverride(raw?.responsive?.[device])])),
  };
}

function sanitizeBlockItems(raw, max = VISUAL_BUILDER_LIMITS.maxFeatureItems) {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, max)
    .map(item => ({ q: text(item?.q || item?.title || '', 180), a: text(item?.a || item?.text || '', 1200) }))
    .filter(item => item.q || item.a);
}

function sanitizeBlock(raw, index, pageSchema) {
  const type = VISUAL_BLOCK_TYPES.includes(raw?.type) ? raw.type : 'section';
  const sectionIds = Object.keys(pageSchema.sections || {});
  const id = text(raw?.id || `${type}-${index + 1}`, 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || `${type}-${index + 1}`;
  const validAnchor = raw?.afterSection === VISUAL_TOP_ANCHOR || sectionIds.includes(raw?.afterSection);
  const block = {
    id,
    type,
    label: text(raw?.label || '', 80),
    afterSection: validAnchor ? raw.afterSection : (sectionIds[0] || VISUAL_TOP_ANCHOR),
    eyebrow: text(raw?.eyebrow || 'TINTÍN', 80),
    title: text(raw?.title || 'Nueva sección', 180),
    text: text(raw?.text || '', 1200),
    buttonLabel: text(raw?.buttonLabel || '', 80),
    href: safeVisualHref(raw?.href),
    image: safeVisualImage(raw?.image),
    imageAlt: text(raw?.imageAlt || '', 140),
    count: Math.max(1, Math.min(12, Number(raw?.count) || 4)),
    category: text(raw?.category || '', 120),
    videoUrl: safeVisualVideoUrl(raw?.videoUrl),
    imageSide: raw?.imageSide === 'right' ? 'right' : 'left',
    style: sanitizeVisualStyle(raw?.style),
    endAt: safeIsoDate(raw?.endAt),
    expiredText: text(raw?.expiredText || 'Finalizado', 120),
    marqueeSpeed: ['slow', 'normal', 'fast'].includes(raw?.marqueeSpeed) ? raw.marqueeSpeed : 'normal',
    spacerSize: ['small', 'medium', 'large', 'xlarge'].includes(raw?.spacerSize) ? raw.spacerSize : 'medium',
  };
  if (type === 'gallery') {
    block.images = (Array.isArray(raw?.images) ? raw.images : [])
      .slice(0, VISUAL_BUILDER_LIMITS.maxImages)
      .map(item => ({ src: safeVisualImage(item?.src), alt: text(item?.alt || '', 140) }))
      .filter(item => item.src);
  }
  if (type === 'faq') block.items = sanitizeBlockItems(raw?.items, VISUAL_BUILDER_LIMITS.maxFaqItems).filter(item => item.q && item.a);
  if (type === 'features') block.items = sanitizeBlockItems(raw?.items, VISUAL_BUILDER_LIMITS.maxFeatureItems);
  return block;
}

function reorderableSectionIds(pageSchema) {
  return Object.entries(pageSchema.sections || {}).filter(([, schema]) => !schema.global).map(([id]) => id);
}

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
