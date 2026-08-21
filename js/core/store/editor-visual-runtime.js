import {
  detectContentPageId, getNested, getPageSchema, normalizeContentValue,
  sanitizeContentHref, sanitizeContentText,
} from './esquema-contenido.js?v=tintin-20260820-microcopy-ios-1';
import {
  VISUAL_BLOCK_TYPES, VISUAL_STYLE_OPTIONS,
} from './contratos-visual-builder.js?v=tintin-20260810-visual-studio-v2-1';

const DEVICES = ['desktop', 'tablet', 'mobile'];
const OPTIONS = Object.freeze(
  Object.fromEntries(Object.entries(VISUAL_STYLE_OPTIONS).map(([key, values]) => [key, new Set(values)]))
);
const BLOCK_TYPES = new Set(VISUAL_BLOCK_TYPES);
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
  link.href = 'css/components/editor-visual-runtime.css?v=tintin-20260810-visual-studio-v2-8';
  document.head.appendChild(link);
}

function color(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : ''; }
function option(group, value, fallback) { return OPTIONS[group].has(value) ? value : fallback; }
function plain(value, max) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(?:index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i.test(href)) return href;
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
function safeDate(value) {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function cleanResponsive(raw = {}) {
  return {
    visibility: option('visibility', raw.visibility, 'inherit'),
    spacing: raw.spacing === 'inherit' ? 'inherit' : option('spacing', raw.spacing, 'inherit'),
    width: raw.width === 'inherit' ? 'inherit' : option('width', raw.width, 'inherit'),
    align: raw.align === 'inherit' ? 'inherit' : option('align', raw.align, 'inherit'),
    columns: option('columns', String(raw.columns ?? 'inherit'), 'inherit'),
    imageFit: raw.imageFit === 'inherit' ? 'inherit' : option('imageFit', raw.imageFit, 'inherit'),
  };
}

function cleanStyle(raw = {}) {
  return {
    background: color(raw.background), textColor: color(raw.textColor), accentColor: color(raw.accentColor),
    spacing: option('spacing', raw.spacing, 'normal'), width: option('width', raw.width, 'contained'),
    align: option('align', raw.align, 'center'), radius: option('radius', raw.radius, 'none'),
    shadow: option('shadow', raw.shadow, 'none'), animation: option('animation', raw.animation, 'none'),
    variant: option('variant', raw.variant, 'default'), imageFit: option('imageFit', raw.imageFit, 'cover'),
    responsive: Object.fromEntries(DEVICES.map(device => [device, cleanResponsive(raw?.responsive?.[device])])),
  };
}

function reorderableSectionIds(schema) {
  return Object.entries(schema.sections || {}).filter(([, sectionSchema]) => !sectionSchema.global).map(([id]) => id);
}

function sanitizeSectionOrderClient(raw, schema) {
  const reorderable = reorderableSectionIds(schema);
  const seen = new Set();
  const order = (Array.isArray(raw) ? raw : []).filter(id => reorderable.includes(id) && !seen.has(id) && seen.add(id));
  reorderable.forEach(id => { if (!seen.has(id)) { order.push(id); seen.add(id); } });
  return order;
}

function cleanItems(raw, max = 16) {
  return (Array.isArray(raw) ? raw : []).slice(0, max).map(item => ({
    q: plain(item?.q || item?.title || '', 180), a: plain(item?.a || item?.text || '', 1200),
  })).filter(item => item.q || item.a);
}

function sanitizeRuntimeConfig(pageId, raw = {}) {
  const schema = getPageSchema(pageId);
  if (!schema) return { sections: {}, sectionOrder: [], customBlocks: [] };
  const sections = Object.fromEntries(Object.keys(schema.sections).map(id => [id, cleanStyle(raw?.sections?.[id])]));
  const sectionOrder = sanitizeSectionOrderClient(raw?.sectionOrder, schema);
  const sectionIds = new Set(Object.keys(schema.sections));
  const seen = new Set();
  const customBlocks = (Array.isArray(raw?.customBlocks) ? raw.customBlocks : []).slice(0, 40).map((item, index) => {
    const type = BLOCK_TYPES.has(item?.type) ? item.type : 'section';
    const id = plain(item?.id || `${type}-${index + 1}`, 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    return {
      id, type, label: plain(item?.label || '', 80),
      afterSection: item?.afterSection === TOP_ANCHOR || sectionIds.has(item?.afterSection) ? item.afterSection : TOP_ANCHOR,
      eyebrow: plain(item?.eyebrow || 'TINTÍN', 80), title: plain(item?.title || 'Nueva sección', 180),
      text: plain(item?.text || '', 1200), buttonLabel: plain(item?.buttonLabel || '', 80), href: safeHref(item?.href),
      image: safeImage(item?.image), imageAlt: plain(item?.imageAlt || '', 140), count: Math.max(1, Math.min(12, Number(item?.count) || 4)),
      category: plain(item?.category || '', 120), style: cleanStyle(item?.style), videoUrl: safeVideoUrl(item?.videoUrl),
      imageSide: item?.imageSide === 'right' ? 'right' : 'left',
      images: (Array.isArray(item?.images) ? item.images : []).slice(0, 12).map(image => ({ src: safeImage(image?.src), alt: plain(image?.alt || '', 140) })).filter(image => image.src),
      items: cleanItems(item?.items), endAt: safeDate(item?.endAt), expiredText: plain(item?.expiredText || 'Finalizado', 120),
      marqueeSpeed: ['slow', 'normal', 'fast'].includes(item?.marqueeSpeed) ? item.marqueeSpeed : 'normal',
      spacerSize: ['small', 'medium', 'large', 'xlarge'].includes(item?.spacerSize) ? item.spacerSize : 'medium',
    };
  }).filter(block => block.id && !seen.has(block.id) && seen.add(block.id));
  return { sections, sectionOrder, customBlocks };
}

function findRoots(sectionSchema) {
  try { return [...document.querySelectorAll(sectionSchema.root)]; } catch { return []; }
}

function reorderSections(schema, order) {
  if (!Array.isArray(order) || order.length < 2) return;
  const groups = new Map();
  order.forEach(id => {
    const sectionSchema = schema.sections[id];
    if (!sectionSchema) return;
    const roots = findRoots(sectionSchema);
    if (roots.length) groups.set(id, roots);
  });
  if (groups.size < 2) return;
  const byParent = new Map();
  groups.forEach((roots, id) => {
    const parent = roots[0].parentNode;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(id);
  });
  byParent.forEach((ids, parent) => {
    if (ids.length < 2) return;
    const localOrder = order.filter(id => ids.includes(id));
    const allNodes = ids.flatMap(id => groups.get(id));
    if (!allNodes.every(node => node.parentNode === parent)) return;
    const siblings = [...parent.children];
    let anchor = null;
    for (const child of siblings) { if (allNodes.includes(child)) { anchor = child.previousElementSibling; break; } }
    allNodes.forEach(node => node.remove());
    let cursor = anchor;
    localOrder.forEach(id => {
      groups.get(id).forEach(node => { if (cursor) cursor.after(node); else parent.prepend(node); cursor = node; });
    });
  });
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

function dataKey(device, property) {
  return `ttVisual${device[0].toUpperCase()}${device.slice(1)}${property[0].toUpperCase()}${property.slice(1)}`;
}

function applyStyle(root, style) {
  root.classList.add('tt-visual-managed');
  Object.entries({ spacing: style.spacing, width: style.width, align: style.align, radius: style.radius, shadow: style.shadow, animation: style.animation, variant: style.variant, imageFit: style.imageFit })
    .forEach(([key, value]) => { root.dataset[`ttVisual${key[0].toUpperCase()}${key.slice(1)}`] = value; });
  DEVICES.forEach(device => {
    const override = style.responsive[device];
    Object.entries(override).forEach(([key, value]) => { root.dataset[dataKey(device, key)] = String(value); });
  });
  [['--tt-visual-bg', style.background], ['--tt-visual-text', style.textColor], ['--tt-visual-accent', style.accentColor]].forEach(([name, value]) => {
    if (value) root.style.setProperty(name, value); else root.style.removeProperty(name);
  });
  if (style.background) root.style.setProperty('background-color', style.background, 'important'); else root.style.removeProperty('background-color');
  if (style.textColor) root.style.setProperty('color', style.textColor, 'important'); else root.style.removeProperty('color');
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function renderProductCards(root, block) {
  const all = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const products = all.filter(item => item?.active !== false && (!block.category || String(item.category || item.cat || '').toLowerCase() === block.category.toLowerCase())).slice(0, block.count);
  root.replaceChildren();
  if (!products.length) {
    const fallback = el('a', 'tt-visual-product-card tt-visual-product-fallback', 'Explorar productos');
    fallback.href = '/catalogo'; root.appendChild(fallback); return;
  }
  products.forEach(product => {
    const link = el('a', 'tt-visual-product-card'); link.href = `product.html?id=${encodeURIComponent(String(product.id || ''))}`;
    const src = safeImage(product.imageUrl);
    if (src) { const image = el('img'); image.src = src; image.alt = plain(product.name || 'Producto TINTÍN', 180); image.loading = 'lazy'; image.decoding = 'async'; link.appendChild(image); }
    else link.appendChild(el('span', 'tt-visual-product-placeholder'));
    link.appendChild(el('strong', '', plain(product.name || 'Producto TINTÍN', 180)));
    link.appendChild(el('small', '', 'Ver producto'));
    root.appendChild(link);
  });
}

function renderCollectionCards(root, block) {
  const labels = [...new Set((Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []).filter(item => item?.active !== false).map(item => plain(item.category || item.cat || '', 120)).filter(Boolean))].slice(0, block.count);
  root.replaceChildren();
  (labels.length ? labels : ['Ver colecciones']).forEach(label => {
    const link = el('a', '', label); link.href = label === 'Ver colecciones' ? 'collections.html' : `/catalogo?cat=${encodeURIComponent(label)}`; root.appendChild(link);
  });
}

function buildTestimonialBody(block) {
  const wrap = el('div', 'tt-visual-testimonial-body');
  if (block.image) { const avatar = el('img', 'tt-visual-testimonial-avatar'); avatar.src = block.image; avatar.alt = block.imageAlt || block.title; avatar.loading = 'lazy'; wrap.appendChild(avatar); }
  if (block.text) wrap.appendChild(el('p', 'tt-visual-testimonial-quote', `“${block.text}”`));
  const who = el('div', 'tt-visual-testimonial-who');
  if (block.title) who.appendChild(el('strong', '', block.title));
  if (block.eyebrow) who.appendChild(el('span', '', block.eyebrow));
  if (who.childNodes.length) wrap.appendChild(who);
  return wrap;
}

function buildVideoBody(block) {
  if (!block.videoUrl) return null;
  const wrap = el('div', 'tt-visual-video-wrap'); const iframe = document.createElement('iframe');
  iframe.src = block.videoUrl; iframe.title = block.title || 'Video'; iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture'; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('allowfullscreen', ''); iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups'); wrap.appendChild(iframe); return wrap;
}

function buildFaqBody(block) {
  if (!block.items.length) return null;
  const wrap = el('div', 'tt-visual-faq');
  block.items.filter(pair => pair.q && pair.a).forEach(pair => {
    const item = document.createElement('details'); item.className = 'tt-visual-faq-item';
    const summary = document.createElement('summary'); summary.textContent = pair.q; item.append(summary, el('p', '', pair.a)); wrap.appendChild(item);
  });
  return wrap;
}

function buildColumnsBody(block) {
  const wrap = el('div', `tt-visual-columns tt-visual-columns-${block.imageSide}`);
  if (block.image) { const image = el('img', 'tt-visual-columns-image'); image.src = block.image; image.alt = block.imageAlt || block.title; image.loading = 'lazy'; wrap.appendChild(image); }
  const text = el('div', 'tt-visual-columns-text');
  if (block.eyebrow) text.appendChild(el('p', 'tt-section-sub', block.eyebrow));
  if (block.title) text.appendChild(el('h2', 'tt-section-title', block.title));
  if (block.text) text.appendChild(el('p', 'tt-section-desc', block.text));
  if (block.buttonLabel) { const button = el('a', 'tt-btn', block.buttonLabel); button.href = block.href; if (/^https:\/\//i.test(block.href)) { button.target = '_blank'; button.rel = 'noopener noreferrer'; } text.appendChild(button); }
  wrap.appendChild(text); return wrap;
}

function buildFeaturesBody(block) {
  const grid = el('div', 'tt-visual-features');
  block.items.forEach(item => {
    const card = el('article', 'tt-visual-feature-card');
    if (item.q) card.appendChild(el('strong', '', item.q));
    if (item.a) card.appendChild(el('p', '', item.a));
    grid.appendChild(card);
  });
  return grid;
}

function buildMarqueeBody(block) {
  const wrap = el('div', `tt-visual-marquee tt-visual-marquee-${block.marqueeSpeed}`);
  const track = el('div', 'tt-visual-marquee-track');
  const phrase = block.title || block.text || 'TINTÍN';
  for (let i = 0; i < 8; i += 1) track.appendChild(el('span', '', phrase));
  wrap.appendChild(track); return wrap;
}

function buildCountdownBody(block) {
  const wrap = el('div', 'tt-visual-countdown');
  const value = el('strong', 'tt-visual-countdown-value'); wrap.appendChild(value);
  const render = () => {
    if (!value.isConnected) return false;
    const end = new Date(block.endAt).getTime(); const diff = end - Date.now();
    if (!Number.isFinite(end) || diff <= 0) { value.textContent = block.expiredText || 'Finalizado'; return diff > 0; }
    const days = Math.floor(diff / 86400000); const hours = Math.floor((diff % 86400000) / 3600000); const minutes = Math.floor((diff % 3600000) / 60000); const seconds = Math.floor((diff % 60000) / 1000);
    value.textContent = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`; return true;
  };
  render(); const timer = window.setInterval(() => { if (!render()) window.clearInterval(timer); }, 1000); return wrap;
}

const NO_GENERIC_TEXT_TYPES = new Set(['columns', 'divider', 'spacer', 'testimonial', 'marquee']);
const NO_GENERIC_BUTTON_TYPES = new Set(['gallery', 'products', 'collections', 'testimonial', 'video', 'faq', 'columns', 'divider', 'spacer', 'marquee', 'features', 'countdown']);
const NO_GENERIC_IMAGE_TYPES = new Set(['gallery', 'products', 'collections', 'testimonial', 'columns', 'divider', 'spacer', 'marquee', 'features', 'countdown']);

function buildBlock(block) {
  const section = el('section', `tt-visual-block tt-visual-block-${block.type}`); section.dataset.ttVisualBlock = block.id; applyStyle(section, block.style);
  if (block.type === 'divider') { section.appendChild(el('hr', 'tt-visual-divider-rule')); return section; }
  if (block.type === 'spacer') { section.dataset.ttVisualSpacer = block.spacerSize; return section; }
  const container = el('div', 'tt-visual-block-inner');
  if (!NO_GENERIC_TEXT_TYPES.has(block.type)) {
    if (block.eyebrow) container.appendChild(el('p', 'tt-section-sub', block.eyebrow));
    if (block.title) container.appendChild(el('h2', 'tt-section-title', block.title));
    if (block.text) container.appendChild(el('p', 'tt-section-desc', block.text));
  }
  if (block.image && !NO_GENERIC_IMAGE_TYPES.has(block.type)) { const image = el('img', 'tt-visual-feature-image'); image.src = block.image; image.alt = block.imageAlt || block.title; image.loading = 'lazy'; container.appendChild(image); }
  if (block.type === 'gallery') { const gallery = el('div', 'tt-visual-gallery'); block.images.forEach(item => { const image = el('img'); image.src = item.src; image.alt = item.alt; image.loading = 'lazy'; gallery.appendChild(image); }); container.appendChild(gallery); }
  if (block.type === 'products') { const products = el('div', 'tt-visual-products'); renderProductCards(products, block); window.addEventListener('tintin:products-loaded', () => renderProductCards(products, block), { once: true }); container.appendChild(products); }
  if (block.type === 'collections') { const collections = el('div', 'tt-visual-collections'); renderCollectionCards(collections, block); window.addEventListener('tintin:products-loaded', () => renderCollectionCards(collections, block), { once: true }); container.appendChild(collections); }
  if (block.type === 'testimonial') container.appendChild(buildTestimonialBody(block));
  if (block.type === 'video') { const video = buildVideoBody(block); if (video) container.appendChild(video); }
  if (block.type === 'faq') { const faq = buildFaqBody(block); if (faq) container.appendChild(faq); }
  if (block.type === 'columns') container.replaceChildren(buildColumnsBody(block));
  if (block.type === 'features') container.appendChild(buildFeaturesBody(block));
  if (block.type === 'marquee') container.replaceChildren(buildMarqueeBody(block));
  if (block.type === 'countdown') container.appendChild(buildCountdownBody(block));
  if (block.buttonLabel && !NO_GENERIC_BUTTON_TYPES.has(block.type)) { const button = el('a', 'tt-btn', block.buttonLabel); button.href = block.href; if (/^https:\/\//i.test(block.href)) { button.target = '_blank'; button.rel = 'noopener noreferrer'; } container.appendChild(button); }
  section.appendChild(container); return section;
}

function markSections(schema) {
  Object.entries(schema.sections).forEach(([id, sectionSchema]) => findRoots(sectionSchema).forEach(root => { root.dataset.ttVisualSection = id; }));
}

function applyPreviewSelection(schema, selected) {
  document.querySelectorAll('.tt-visual-editor-selected').forEach(node => node.classList.remove('tt-visual-editor-selected'));
  if (!selected) return;
  if (selected.kind === 'block') document.querySelectorAll(`[data-tt-visual-block="${CSS.escape(String(selected.id || ''))}"]`).forEach(node => node.classList.add('tt-visual-editor-selected'));
  if (selected.kind === 'section' && schema.sections[selected.id]) findRoots(schema.sections[selected.id]).forEach(node => node.classList.add('tt-visual-editor-selected'));
}

export function applyVisualBuilderConfig(pageId, rawConfig, selected = null) {
  ensureCss(); const schema = getPageSchema(pageId); if (!schema) return;
  const config = sanitizeRuntimeConfig(pageId, rawConfig); markSections(schema);
  Object.entries(schema.sections).forEach(([sectionId, sectionSchema]) => findRoots(sectionSchema).forEach(root => applyStyle(root, config.sections[sectionId])));
  reorderSections(schema, config.sectionOrder);
  document.querySelectorAll('[data-tt-visual-block]').forEach(node => node.remove());
  const insertionTails = new Map();
  const firstSectionId = config.sectionOrder[0] || Object.keys(schema.sections)[0]; const firstSectionSchema = schema.sections[firstSectionId]; const firstRoot = firstSectionSchema ? findRoots(firstSectionSchema)[0] : null;
  config.customBlocks.forEach(block => {
    const node = buildBlock(block);
    if (block.afterSection === TOP_ANCHOR) {
      const tail = insertionTails.get(TOP_ANCHOR); if (tail?.parentNode) tail.after(node); else if (firstRoot?.parentNode) firstRoot.before(node); else (document.querySelector('main') || document.body).prepend(node);
      insertionTails.set(TOP_ANCHOR, node); return;
    }
    const targetSchema = schema.sections[block.afterSection]; const target = targetSchema ? findRoots(targetSchema).at(-1) : null; const tail = insertionTails.get(block.afterSection) || target;
    if (tail?.parentNode) tail.after(node); else (document.querySelector('main') || document.body).appendChild(node); insertionTails.set(block.afterSection, node);
  });
  applyPreviewSelection(schema, selected);
  document.documentElement.dataset.ttVisualBuilder = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:visual-builder-ready', { detail: { pageId } }));
}

export async function initVisualBuilderRuntime(pageId) {
  if (initializedPages.has(pageId)) return; initializedPages.add(pageId); ensureCss();
  const isStaticLocalHost = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  const shouldFetchPublishedConfig = !isStaticLocalHost || window.TT_VISUAL_BUILDER_FETCH_LOCAL === true;
  if (shouldFetchPublishedConfig) {
    // El loader no puede revelar la página con el estilo por defecto y luego
    // encimar el layout publicado un instante después: se retiene hasta que
    // la config llegue o venza el techo, igual que el resto del shell.
    window.TintinLoader?.beginWait?.();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const ceiling = window.setTimeout(() => controller?.abort(), 1500);
    try {
      const response = await fetch(`/api/visual-builder-public?page=${encodeURIComponent(pageId)}`, {
        headers: { accept: 'application/json' },
        ...(controller ? { signal: controller.signal } : {}),
      });
      const data = response.ok ? await response.json() : null;
      if (data?.config) applyVisualBuilderConfig(pageId, data.config); else document.documentElement.dataset.ttVisualBuilder = 'fallback';
    } catch { document.documentElement.dataset.ttVisualBuilder = 'fallback'; }
    finally {
      window.clearTimeout(ceiling);
      window.TintinLoader?.endWait?.();
    }
  } else document.documentElement.dataset.ttVisualBuilder = 'fallback';

  const preview = new URLSearchParams(location.search).get('ttVisualPreview') === '1' && window.parent !== window;
  if (preview) {
    document.addEventListener('click', event => {
      const block = event.target.closest('[data-tt-visual-block]');
      const section = event.target.closest('[data-tt-visual-section]');
      if (block || section) {
        event.preventDefault(); event.stopPropagation();
        window.parent.postMessage({ type: 'tintin:visual-select', pageId, kind: block ? 'block' : 'section', id: block?.dataset.ttVisualBlock || section?.dataset.ttVisualSection }, location.origin);
        return;
      }
      if (event.target.closest('a,button,input[type="submit"]')) event.preventDefault();
    }, true);
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'tintin:visual-preview' || event.data.pageId !== pageId) return;
      applyVisualBuilderConfig(pageId, event.data.config, event.data.selected || null);
      applyVisualContentPreview(pageId, event.data.content);
    });
  }
}

export function autoInitVisualBuilderRuntime() {
  const pageId = detectContentPageId(); if (pageId) initVisualBuilderRuntime(pageId); return pageId;
}
