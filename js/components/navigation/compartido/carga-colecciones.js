const COLL_IMG_BASE = 'assets-tintin/images/collections/';
const COLL_PLACEHOLDER = `${COLL_IMG_BASE}col-placeholder.webp`;
const SLUG_FILE_MAP = { bolsos: 'bags' };
const MOBILE_GRADIENT = 'linear-gradient(135deg,#e8c5d0,#c48a9e)';
let started = false;
let unsubscribe = null;
let lastCollections = null;
let products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];

function text(value) {
  return String(value == null ? '' : value).trim();
}

// Sin productos cargados todavía no se puede saber qué colecciones están
// vacías, así que se muestran todas para no ocultar catálogo real por error.
function hasProducts(slug) {
  const normalized = text(slug).toLowerCase();
  return products.some(product =>
    text(product?.category || product?.cat).toLowerCase() === normalized &&
    text(product?.name)
  );
}

function visibleCollections(collections) {
  if (!products.length) return collections;
  return collections.filter(item => hasProducts(item.slug));
}

// Cuando la colección no tiene imagen propia (o fue eliminada), se usa la
// foto del producto más antiguo de esa categoría como respaldo visual.
// Es puramente de presentación: no se persiste nada en Firestore.
function firstProductImage(slug) {
  const normalized = text(slug).toLowerCase();
  const matches = products.filter(product =>
    text(product?.category || product?.cat).toLowerCase() === normalized &&
    text(product?.name) &&
    product?.active !== false &&
    text(product?.imageUrl)
  );
  if (!matches.length) return '';
  matches.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
  return matches[0].imageUrl;
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
  return `/catalogo?cat=${encodeURIComponent(text(slug))}`;
}

function imageCandidates(collection) {
  return [...new Set([
    safeUrl(collection?.image),
    safeUrl(firstProductImage(collection?.slug)),
    safeUrl(`${COLL_IMG_BASE}col-${collImgFile(collection?.slug)}.webp`),
    safeUrl(COLL_PLACEHOLDER),
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
  image.style.objectFit = 'cover';
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
  icon.appendChild(createCollectionImage(collection));
  link.append(icon, label);
  return link;
}

function buildTabletCard(collection) {
  const link = document.createElement('a');
  const imageWrap = document.createElement('div');
  const label = document.createElement('span');
  link.href = catalogHref(collection.slug);
  link.className = 'tt-tablet-cat-card';
  link.dataset.phase4CollectionNode = '1';
  imageWrap.className = 'tt-tablet-cat-img';
  imageWrap.appendChild(createCollectionImage(collection));
  label.textContent = text(collection.name) || text(collection.slug);
  link.append(imageWrap, label);
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
  wrap.style.cssText = 'grid-column:1/-1;padding:12px 16px;font-size:12px;color:var(--text-muted,#777);text-align:center;width:100%;box-sizing:border-box;';
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

function hasUsableFallback(container) {
  return Boolean(container?.querySelector('a[href]'));
}

function removeStateNodes(container) {
  container?.querySelectorAll('.tt-collections-nav-state').forEach(node => node.remove());
}

function renderInto(container, collections, buildNode) {
  if (!container) return;
  removeStateNodes(container);
  container.removeAttribute('aria-busy');

  if (!collections.length) {
    container.dataset.phase4CollectionsState = hasUsableFallback(container) ? 'fallback' : 'empty';
    if (!hasUsableFallback(container)) container.appendChild(createStateNode('No hay colecciones disponibles'));
    return;
  }

  container.replaceChildren();
  container.dataset.phase4CollectionsState = 'ready';
  collections.forEach(collection => container.appendChild(buildNode(collection)));
}

function renderLoading() {
  document.querySelectorAll('[data-collections-nav]').forEach(container => {
    removeStateNodes(container);
    container.dataset.phase4CollectionsState = 'loading';
    container.setAttribute('aria-busy', 'true');
    if (!hasUsableFallback(container)) {
      container.appendChild(createStateNode('Cargando colecciones…'));
    }
  });
}

function renderError() {
  document.querySelectorAll('[data-collections-nav]').forEach(container => {
    removeStateNodes(container);
    container.removeAttribute('aria-busy');
    container.dataset.phase4CollectionsState = 'error';
    container.appendChild(createStateNode('No pudimos actualizar las colecciones. Podés seguir usando las opciones disponibles.', 'error'));
  });
}

function renderAll(collections) {
  const visible = visibleCollections(collections);
  document.querySelectorAll('[data-collections-nav="desktop"]').forEach(container => renderInto(container, visible, buildDesktopCard));
  document.querySelectorAll('[data-collections-nav="tablet"]').forEach(container => renderInto(container, visible, buildTabletCard));
  document.querySelectorAll('[data-collections-nav="mobile"]').forEach(container => renderInto(container, visible, collection => buildMobileNode(container, collection)));
  document.querySelectorAll('[data-collections-nav="sheet"]').forEach(container => renderInto(container, visible, buildSheetItem));
}

export function initNavCollections(force = false) {
  if (started && !force) return Promise.resolve();
  started = true;
  renderLoading();

  return import('../../../pages/collections/estado-colecciones.js?v=tintin-20260821-accounts-phase-a-1')
    .then(({ onCollectionsUpdate, loadCollections }) => {
      unsubscribe?.();
      unsubscribe = onCollectionsUpdate(collections => {
        lastCollections = collections;
        renderAll(collections);
      }, renderError);
      if (force) return loadCollections({ force: true });
      return null;
    })
    .catch(error => {
      started = false;
      console.error('[nav-collections] No se pudo iniciar la carga:', error);
      renderError();
    });
}

window.addEventListener('tintin:products-loaded', event => {
  products = Array.isArray(event.detail?.products) ? event.detail.products : [];
  if (lastCollections) renderAll(lastCollections);
});

function isCollectionPage() {
  const path = location.pathname.toLowerCase();
  return /(^|\/)(?:index|catalogo|collections)(?:\.html)?$/.test(path) || path.endsWith('/');
}

function attachDemandLoading() {
  ['btn-tienda', 'btn-tablet-tienda', 'tabbar-tienda', 'btn-menu-tablet'].forEach(id => {
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
  createCollectionImage,
};
