import {
  detectContentPageId, getNested, getPageSchema, normalizeContentValue,
  sanitizeContentHref, sanitizeContentText,
} from './esquema-contenido.js?v=tintin-20260809-visual-builder-1';

const OPTIONS = Object.freeze({
  spacing: new Set(['compact', 'normal', 'roomy']), width: new Set(['contained', 'wide', 'full']),
  align: new Set(['left', 'center', 'right']), radius: new Set(['none', 'small', 'medium', 'large']),
  shadow: new Set(['none', 'soft', 'medium', 'large']),
  animation: new Set(['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'pop']),
});
const BLOCK_TYPES = new Set([
  'banner', 'text', 'products', 'gallery', 'promotion', 'button', 'section', 'collections',
  'testimonial', 'video', 'faq', 'columns', 'divider',
]);
// Debe coincidir con VISUAL_TOP_ANCHOR en cloudflare/visual-builder-core.js —
// un bloque anclado acá se inserta antes de la primera sección de la página.
const TOP_ANCHOR = '__top__';
const SAFE_YOUTUBE_EMBED = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_VIMEO_EMBED = /^https:\/\/player\.vimeo\.com\/video\/\d{4,12}(?:\?[A-Za-z0-9_=&.-]*)?$/i;
const SAFE_CLOUDINARY_VIDEO = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+\/video\/upload\/[A-Za-z0-9_./,%~-]+$/i;
const initializedPages = new Set();

function ensureCss() {
  if (document.getElementById('tt-visual-builder-runtime-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-visual-builder-runtime-css';
  link.rel = 'stylesheet';
  link.href = 'css/components/editor-visual-runtime.css?v=tintin-20260810-visual-blocks-1';
  document.head.appendChild(link);
}

function color(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : ''; }
function option(group, value, fallback) { return OPTIONS[group].has(value) ? value : fallback; }
function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(?:index|about|nosotros|catalogo|collections|contact|envios|preguntas-frecuentes|cambios-devoluciones)\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i.test(href)) return href;
  if (/^https:\/\//i.test(href)) return href;
  return 'catalogo.html';
}
function safeImage(value) {
  const src = String(value || '').trim();
  if (/^assets-tintin\/[A-Za-z0-9_./-]+$/.test(src)) return src;
  if (/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+$/i.test(src)) return src;
  return '';
}
function safeVideoUrl(value) {
  const src = String(value || '').trim();
  if (SAFE_YOUTUBE_EMBED.test(src) || SAFE_VIMEO_EMBED.test(src) || SAFE_CLOUDINARY_VIDEO.test(src)) return src;
  return '';
}
function plain(value, max) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

function cleanStyle(raw = {}) {
  return {
    background: color(raw.background), textColor: color(raw.textColor), accentColor: color(raw.accentColor),
    spacing: option('spacing', raw.spacing, 'normal'), width: option('width', raw.width, 'contained'),
    align: option('align', raw.align, 'center'), radius: option('radius', raw.radius, 'none'),
    shadow: option('shadow', raw.shadow, 'none'), animation: option('animation', raw.animation, 'none'),
  };
}

function sanitizeRuntimeConfig(pageId, raw = {}) {
  const schema = getPageSchema(pageId);
  if (!schema) return { sections: {}, customBlocks: [] };
  const sections = Object.fromEntries(Object.keys(schema.sections).map(id => [id, cleanStyle(raw?.sections?.[id])]));
  const sectionIds = new Set(Object.keys(schema.sections));
  const seen = new Set();
  const customBlocks = (Array.isArray(raw?.customBlocks) ? raw.customBlocks : []).slice(0, 24).map((item, index) => {
    const type = BLOCK_TYPES.has(item?.type) ? item.type : 'section';
    const id = plain(item?.id || `${type}-${index + 1}`, 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    return {
      id, type, afterSection: item?.afterSection === TOP_ANCHOR || sectionIds.has(item?.afterSection) ? item.afterSection : TOP_ANCHOR,
      eyebrow: plain(item?.eyebrow || 'TINTÍN', 80), title: plain(item?.title || 'Nueva sección', 180),
      text: plain(item?.text || '', 1200), buttonLabel: plain(item?.buttonLabel || '', 80), href: safeHref(item?.href),
      image: safeImage(item?.image), imageAlt: plain(item?.imageAlt || '', 140), count: Math.max(1, Math.min(8, Number(item?.count) || 4)),
      category: plain(item?.category || '', 120), style: cleanStyle(item?.style),
      videoUrl: safeVideoUrl(item?.videoUrl), imageSide: item?.imageSide === 'right' ? 'right' : 'left',
      images: (Array.isArray(item?.images) ? item.images : []).slice(0, 8).map(image => ({ src: safeImage(image?.src), alt: plain(image?.alt || '', 140) })).filter(image => image.src),
      items: (Array.isArray(item?.items) ? item.items : []).slice(0, 8).map(pair => ({ q: plain(pair?.q || '', 180), a: plain(pair?.a || '', 1200) })).filter(pair => pair.q && pair.a),
    };
  }).filter(block => block.id && !seen.has(block.id) && seen.add(block.id));
  return { sections, customBlocks };
}

function findRoots(sectionSchema) {
  try { return [...document.querySelectorAll(sectionSchema.root)]; } catch { return []; }
}

function findTarget(root, item) {
  let matches = [];
  try {
    if (root.matches?.(item.selector)) matches.push(root);
    matches.push(...root.querySelectorAll(item.selector));
  } catch { return null; }
  return matches[item.index == null ? 0 : item.index] || null;
}

function previewFields(sectionSchema) {
  const fields = new Map();
  sectionSchema.fields.forEach(item => fields.set(`${item.selector}:${item.index ?? 0}:${item.type === 'href' ? 'href' : 'text'}`, item));
  return [...fields.values()];
}

function setPlainText(element, value) {
  const nodes = [];
  String(value).split('\n').forEach((line, index) => { if (index) nodes.push(document.createElement('br')); nodes.push(document.createTextNode(line)); });
  element.replaceChildren(...nodes);
}

export function applyVisualContentPreview(pageId, rawContent = {}) {
  const schema = getPageSchema(pageId);
  if (!schema) return;
  Object.entries(schema.sections).forEach(([sectionId, sectionSchema]) => {
    const values = rawContent?.[sectionId];
    if (!values || typeof values !== 'object') return;
    const roots = findRoots(sectionSchema);
    if (sectionSchema.allowVisibility && Object.prototype.hasOwnProperty.call(values, 'visible')) roots.forEach(root => { root.hidden = values.visible === false; });
    previewFields(sectionSchema).forEach(item => {
      const raw = getNested(values, item.key);
      if (raw === undefined || raw === null) return;
      roots.forEach(root => {
        const target = findTarget(root, item); if (!target) return;
        if (item.type === 'href' && target instanceof HTMLAnchorElement) {
          const href = sanitizeContentHref(raw, item.default || '');
          if (href) target.setAttribute('href', href); else target.removeAttribute('href');
        } else if (item.type !== 'href') {
          const normalized = normalizeContentValue(pageId, sectionId, item.key, raw);
          setPlainText(target, sanitizeContentText(normalized, item.maxLength));
        }
      });
    });
  });
}

function applyStyle(root, style) {
  root.classList.add('tt-visual-managed');
  Object.entries({ spacing: style.spacing, width: style.width, align: style.align, radius: style.radius, shadow: style.shadow, animation: style.animation })
    .forEach(([key, value]) => { root.dataset[`ttVisual${key[0].toUpperCase()}${key.slice(1)}`] = value; });
  [['--tt-visual-bg', style.background], ['--tt-visual-text', style.textColor], ['--tt-visual-accent', style.accentColor]].forEach(([name, value]) => {
    if (value) root.style.setProperty(name, value); else root.style.removeProperty(name);
  });
  if (style.background) root.style.setProperty('background-color', style.background, 'important'); else root.style.removeProperty('background-color');
  if (style.textColor) root.style.setProperty('color', style.textColor, 'important'); else root.style.removeProperty('color');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderProductCards(root, block) {
  const all = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const products = all.filter(item => item?.active !== false && (!block.category || String(item.category || item.cat || '').toLowerCase() === block.category.toLowerCase())).slice(0, block.count);
  root.replaceChildren();
  if (!products.length) {
    const fallback = el('a', 'tt-visual-product-card tt-visual-product-fallback', 'Explorar productos');
    fallback.href = 'catalogo.html';
    root.appendChild(fallback);
    return;
  }
  products.forEach(product => {
    const link = el('a', 'tt-visual-product-card');
    link.href = `product.html?id=${encodeURIComponent(String(product.id || ''))}`;
    const src = safeImage(product.imageUrl);
    if (src) {
      const image = el('img'); image.src = src; image.alt = plain(product.name || 'Producto TINTÍN', 180); image.loading = 'lazy'; image.decoding = 'async';
      link.appendChild(image);
    } else link.appendChild(el('span', 'tt-visual-product-placeholder'));
    link.appendChild(el('strong', '', plain(product.name || 'Producto TINTÍN', 180)));
    link.appendChild(el('small', '', 'Ver producto'));
    root.appendChild(link);
  });
}

function renderCollectionCards(root, block) {
  const labels = [...new Set((Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [])
    .filter(item => item?.active !== false)
    .map(item => plain(item.category || item.cat || '', 120))
    .filter(Boolean))].slice(0, block.count);
  root.replaceChildren();
  (labels.length ? labels : ['Ver colecciones']).forEach(label => {
    const link = el('a', '', label);
    link.href = label === 'Ver colecciones' ? 'collections.html' : `catalogo.html?cat=${encodeURIComponent(label)}`;
    root.appendChild(link);
  });
}

function buildTestimonialBody(block) {
  const wrap = el('div', 'tt-visual-testimonial-body');
  if (block.image) {
    const avatar = el('img', 'tt-visual-testimonial-avatar'); avatar.src = block.image; avatar.alt = block.imageAlt || block.title; avatar.loading = 'lazy'; avatar.decoding = 'async';
    wrap.appendChild(avatar);
  }
  if (block.text) wrap.appendChild(el('p', 'tt-visual-testimonial-quote', `“${block.text}”`));
  const who = el('div', 'tt-visual-testimonial-who');
  if (block.title) who.appendChild(el('strong', '', block.title));
  if (block.eyebrow) who.appendChild(el('span', '', block.eyebrow));
  if (who.childNodes.length) wrap.appendChild(who);
  return wrap;
}

function buildVideoBody(block) {
  if (!block.videoUrl) return null;
  const wrap = el('div', 'tt-visual-video-wrap');
  const iframe = document.createElement('iframe');
  iframe.src = block.videoUrl;
  iframe.title = block.title || 'Video';
  iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  wrap.appendChild(iframe);
  return wrap;
}

function buildFaqBody(block) {
  if (!block.items.length) return null;
  const wrap = el('div', 'tt-visual-faq');
  block.items.forEach(pair => {
    const item = document.createElement('details'); item.className = 'tt-visual-faq-item';
    const summary = document.createElement('summary'); summary.textContent = pair.q; item.appendChild(summary);
    item.appendChild(el('p', '', pair.a));
    wrap.appendChild(item);
  });
  return wrap;
}

function buildColumnsBody(block) {
  const wrap = el('div', `tt-visual-columns tt-visual-columns-${block.imageSide}`);
  if (block.image) {
    const image = el('img', 'tt-visual-columns-image'); image.src = block.image; image.alt = block.imageAlt || block.title; image.loading = 'lazy'; image.decoding = 'async';
    wrap.appendChild(image);
  }
  const text = el('div', 'tt-visual-columns-text');
  if (block.eyebrow) text.appendChild(el('p', 'tt-section-sub', block.eyebrow));
  if (block.title) text.appendChild(el('h2', 'tt-section-title', block.title));
  if (block.text) text.appendChild(el('p', 'tt-section-desc', block.text));
  if (block.buttonLabel) {
    const button = el('a', 'tt-btn', block.buttonLabel); button.href = block.href;
    if (/^https:\/\//i.test(block.href)) { button.target = '_blank'; button.rel = 'noopener noreferrer'; }
    text.appendChild(button);
  }
  wrap.appendChild(text);
  return wrap;
}

const DIVIDER_TYPES = new Set(['divider']);
const NO_GENERIC_TEXT_TYPES = new Set(['columns', 'divider', 'testimonial']);
const NO_GENERIC_BUTTON_TYPES = new Set(['gallery', 'products', 'collections', 'testimonial', 'video', 'faq', 'columns', 'divider']);
const NO_GENERIC_IMAGE_TYPES = new Set(['gallery', 'products', 'collections', 'testimonial', 'columns', 'divider']);

function buildBlock(block) {
  const section = el('section', `tt-visual-block tt-visual-block-${block.type}`);
  section.dataset.ttVisualBlock = block.id;
  applyStyle(section, block.style);
  if (DIVIDER_TYPES.has(block.type)) { section.appendChild(el('hr', 'tt-visual-divider-rule')); return section; }
  const container = el('div', 'tt-visual-block-inner');
  if (!NO_GENERIC_TEXT_TYPES.has(block.type)) {
    if (block.eyebrow) container.appendChild(el('p', 'tt-section-sub', block.eyebrow));
    if (block.title) container.appendChild(el('h2', 'tt-section-title', block.title));
    if (block.text) container.appendChild(el('p', 'tt-section-desc', block.text));
  }
  if (block.image && !NO_GENERIC_IMAGE_TYPES.has(block.type)) {
    const image = el('img', 'tt-visual-feature-image'); image.src = block.image; image.alt = block.imageAlt || block.title; image.loading = 'lazy'; image.decoding = 'async';
    container.appendChild(image);
  }
  if (block.type === 'gallery') {
    const gallery = el('div', 'tt-visual-gallery');
    block.images.forEach(item => { const image = el('img'); image.src = item.src; image.alt = item.alt; image.loading = 'lazy'; image.decoding = 'async'; gallery.appendChild(image); });
    container.appendChild(gallery);
  }
  if (block.type === 'products') {
    const products = el('div', 'tt-visual-products');
    renderProductCards(products, block);
    window.addEventListener('tintin:products-loaded', () => renderProductCards(products, block), { once: true });
    container.appendChild(products);
  }
  if (block.type === 'collections') {
    const collections = el('div', 'tt-visual-collections');
    renderCollectionCards(collections, block);
    window.addEventListener('tintin:products-loaded', () => renderCollectionCards(collections, block), { once: true });
    container.appendChild(collections);
  }
  if (block.type === 'testimonial') container.appendChild(buildTestimonialBody(block));
  if (block.type === 'video') { const video = buildVideoBody(block); if (video) container.appendChild(video); }
  if (block.type === 'faq') { const faq = buildFaqBody(block); if (faq) container.appendChild(faq); }
  if (block.type === 'columns') container.replaceChildren(buildColumnsBody(block));
  if (block.buttonLabel && !NO_GENERIC_BUTTON_TYPES.has(block.type)) {
    const button = el('a', 'tt-btn', block.buttonLabel); button.href = block.href;
    if (/^https:\/\//i.test(block.href)) { button.target = '_blank'; button.rel = 'noopener noreferrer'; }
    container.appendChild(button);
  }
  section.appendChild(container);
  return section;
}

export function applyVisualBuilderConfig(pageId, rawConfig) {
  ensureCss();
  const schema = getPageSchema(pageId);
  if (!schema) return;
  const config = sanitizeRuntimeConfig(pageId, rawConfig);
  Object.entries(schema.sections).forEach(([sectionId, sectionSchema]) => {
    findRoots(sectionSchema).forEach(root => applyStyle(root, config.sections[sectionId]));
  });
  document.querySelectorAll('[data-tt-visual-block]').forEach(node => node.remove());
  const insertionTails = new Map();
  const firstSectionSchema = Object.values(schema.sections)[0];
  const firstRoot = firstSectionSchema ? findRoots(firstSectionSchema)[0] : null;
  config.customBlocks.forEach(block => {
    const node = buildBlock(block);
    if (block.afterSection === TOP_ANCHOR) {
      const tail = insertionTails.get(TOP_ANCHOR);
      if (tail?.parentNode) tail.after(node);
      else if (firstRoot?.parentNode) firstRoot.before(node);
      else (document.querySelector('main') || document.body).prepend(node);
      insertionTails.set(TOP_ANCHOR, node);
      return;
    }
    const targetSchema = schema.sections[block.afterSection];
    const target = targetSchema ? findRoots(targetSchema).at(-1) : null;
    const tail = insertionTails.get(block.afterSection) || target;
    if (tail?.parentNode) tail.after(node); else (document.querySelector('main') || document.body).appendChild(node);
    insertionTails.set(block.afterSection, node);
  });
  document.documentElement.dataset.ttVisualBuilder = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:visual-builder-ready', { detail: { pageId } }));
}

export async function initVisualBuilderRuntime(pageId) {
  if (initializedPages.has(pageId)) return;
  initializedPages.add(pageId);
  ensureCss();
  const isStaticLocalHost = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  const shouldFetchPublishedConfig = !isStaticLocalHost || window.TT_VISUAL_BUILDER_FETCH_LOCAL === true;
  if (shouldFetchPublishedConfig) {
    try {
      const response = await fetch(`/api/visual-builder-public?page=${encodeURIComponent(pageId)}`, { headers: { accept: 'application/json' } });
      const data = response.ok ? await response.json() : null;
      if (data?.config) applyVisualBuilderConfig(pageId, data.config);
      else document.documentElement.dataset.ttVisualBuilder = 'fallback';
    } catch { document.documentElement.dataset.ttVisualBuilder = 'fallback'; }
  } else {
    document.documentElement.dataset.ttVisualBuilder = 'fallback';
  }

  const preview = new URLSearchParams(location.search).get('ttVisualPreview') === '1' && window.parent !== window;
  if (preview) {
    document.addEventListener('click', event => {
      if (event.target.closest('a,button,input[type="submit"]')) event.preventDefault();
    }, true);
    window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type !== 'tintin:visual-preview' || event.data.pageId !== pageId) return;
    applyVisualBuilderConfig(pageId, event.data.config);
    applyVisualContentPreview(pageId, event.data.content);
    });
  }
}

export function autoInitVisualBuilderRuntime() {
  const pageId = detectContentPageId();
  if (pageId) initVisualBuilderRuntime(pageId);
  return pageId;
}
