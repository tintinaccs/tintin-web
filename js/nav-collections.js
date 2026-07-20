const COLL_IMG_BASE = 'assets-tintin/images/collections/';
const COLL_PLACEHOLDER = `${COLL_IMG_BASE}col-placeholder.webp`;
const SLUG_FILE_MAP = { bolsos: 'bags' };
const MOBILE_GRADIENT = 'linear-gradient(135deg,#e8c5d0,#c48a9e)';
let started = false;
let unsubscribe = null;

function text(value) {
  return String(value == null ? '' : value).trim();
}

function collImgFile(slug) {
  const normalized = text(slug).replace(/[^a-z0-9_-]/gi, '');
  return SLUG_FILE_MAP[normalized] || normalized;
}

function safeUrl(value, fallback = '') {
  const candidate = text(value);
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate, window.location.href);
    if (!['https:', 'http:'].includes(parsed.protocol)) return fallback;
    if (location.protocol === 'https:' && parsed.protocol === 'http:' && parsed.origin !== location.origin) return fallback;
    return parsed.href;
  } catch {
    return fallback;
  }
}

function catalogHref(slug) {
  return `catalogo.html?cat=${encodeURIComponent(text(slug))}`;
}

function imageCandidates(collection) {
  return [...new Set([
    safeUrl(collection?.image),
    safeUrl(`${COLL_IMG_BASE}col-${collImgFile(collection?.slug)}.webp`),
    safeUrl(COLL_PLACEHOLDER)
  ].filter(Boolean))];
}

function createCollectionImage(collection, className = '') {
  const image = document.createElement('img');
  const candidates = imageCandidates(collection);
  let index = 0;
  image.className = className;
  image.alt = `Colección ${text(collection?.name) || text(collection?.slug)}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'contain';
  image.style.display = 'block';
  image.style.background = 'transparent';
  const next = () => {
    const candidate = candidates[index++];
    if (candidate) image.src = candidate;
    else image.remove();
  };
  image.addEventListener('error', next);
  next();
  return image;
}

function createGenericIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '9');
  svg.appendChild(circle);
  return svg;
}

function buildDesktopCard(collection) {
  const link = document.createElement('a');
  const icon = document.createElement('div');
  const label = document.createElement('div');
  link.href = catalogHref(collection.slug);
  link.className = 'tt-dropdown-card';
  link.dataset.phase4CollectionNode = '1';
  icon.className = 'tt-dropdown-icon';
  label.className = 'tt-dropdown-label';
  label.textContent = (text(collection.name) || text(collection.slug)).toUpperCase();
  icon.appendChild(safeUrl(collection.image) ? createCollectionImage(collection) : createGenericIcon());
  link.append(icon, label);
  return link;
}

function buildMobileNode(container, collection) {
  const link = document.createElement('a');
  link.href = catalogHref(collection.slug);
  link.dataset.phase4CollectionNode = '1';
  if (container.classList.contains('tt-mobile-cats-grid')) {
    const imageWrap = document.createElement('div');
    const label = document.createElement('span');
    link.className = 'tt-mobile-cat-card';
    imageWrap.className = 'tt-mobile-cat-img';
    imageWrap.style.background = MOBILE_GRADIENT;
    imageWrap.appendChild(createCollectionImage(collection));
    label.textContent = text(collection.name) || text(collection.slug);
    link.append(imageWrap, label);
  } else {
    link.textContent = (text(collection.name) || text(collection.slug)).toUpperCase();
  }
  return link;
}

function buildSheetItem(collection) {
  const link = document.createElement('a');
  const imageWrap = document.createElement('span');
  const label = document.createElement('span');
  link.href = catalogHref(collection.slug);
  link.className = 'tt-sheet-item';
  link.dataset.phase4CollectionNode = '1';
  imageWrap.className = 'tt-sheet-item-img';
  imageWrap.appendChild(createCollectionImage(collection));
  label.textContent = (text(collection.name) || text(collection.slug)).toUpperCase();
  link.append(imageWrap, label);
  return link;
}

function createStateNode(message, kind = 'info') {
  const wrap = document.createElement('div');
  wrap.className = `tt-collections-nav-state tt-collections-nav-state--${kind}`;
  wrap.dataset.phase4CollectionNode = '1';
  wrap.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  wrap.style.cssText = 'padding:12px 16px;font-size:12px;color:var(--text-muted,#777);text-align:center;width:100%;box-sizing:border-box;';
  const messageNode = document.createElement('div');
  messageNode.textContent = message;
  wrap.appendChild(messageNode);
  if (kind === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reintentar';
    retry.style.cssText = 'margin-top:8px;border:0;border-radius:999px;padding:7px 14px;background:#b84c72;color:#fff!important;font:700 11px Montserrat;cursor:pointer;';
    retry.addEventListener('click', () => {
      started = false;
      initNavCollections(true);
    });
    wrap.appendChild(retry);
  }
  return wrap;
}

function renderInto(container, collections, buildNode) {
  if (!container) return;
  container.replaceChildren();
  container.dataset.phase4CollectionsState = 'ready';
  if (!collections.length) {
    container.appendChild(createStateNode('No hay colecciones disponibles'));
    return;
  }
  collections.forEach(collection => container.appendChild(buildNode(collection)));
}

function renderLoading() {
  document.querySelectorAll('[data-collections-nav]').forEach(container => {
    container.replaceChildren(createStateNode('Cargando colecciones…'));
    container.dataset.phase4CollectionsState = 'loading';
  });
}

function renderError() {
  document.querySelectorAll('[data-collections-nav]').forEach(container => {
    container.replaceChildren(createStateNode('No pudimos cargar las colecciones.', 'error'));
    container.dataset.phase4CollectionsState = 'error';
  });
}

export function initNavCollections(force = false) {
  if (started && !force) return Promise.resolve();
  started = true;
  renderLoading();
  return import('./collections-store.js?v=tintin-20260720-read-budget-1')
    .then(({ onCollectionsUpdate, loadCollections }) => {
      unsubscribe?.();
      unsubscribe = onCollectionsUpdate(collections => {
        document.querySelectorAll('[data-collections-nav="desktop"]').forEach(container => renderInto(container, collections, buildDesktopCard));
        document.querySelectorAll('[data-collections-nav="mobile"]').forEach(container => renderInto(container, collections, collection => buildMobileNode(container, collection)));
        document.querySelectorAll('[data-collections-nav="sheet"]').forEach(container => renderInto(container, collections, buildSheetItem));
      }, renderError);
      if (force) return loadCollections({ force: true });
      return null;
    })
    .catch(error => {
      console.error('[nav-collections] No se pudo iniciar la carga:', error);
      renderError();
    });
}

function isCollectionPage() {
  const path = location.pathname.toLowerCase();
  return /(^|\/)(?:index|catalogo|collections)(?:\.html)?$/.test(path) || path.endsWith('/');
}

function attachDemandLoading() {
  ['btn-tienda', 'btn-mobile-tienda', 'tabbar-tienda', 'btn-menu'].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('pointerenter', () => initNavCollections(), { once: true, passive: true });
    control.addEventListener('focus', () => initNavCollections(), { once: true });
    control.addEventListener('click', () => initNavCollections(), { once: true });
  });
}

if (isCollectionPage()) initNavCollections();
else attachDemandLoading();

function slugFromHref(href) {
  try {
    return new URL(href || '', location.href).searchParams.get('cat');
  } catch {
    return null;
  }
}

function sheetImg(collection) {
  return createCollectionImage(collection);
}

export {
  slugFromHref,
  sheetImg,
  COLL_IMG_BASE,
  COLL_PLACEHOLDER,
  collImgFile,
  catalogHref,
  safeUrl,
  createCollectionImage
};
