/* =============================================================
   TINTIN — Fase 4: colecciones públicas sincronizadas

   Refuerza las superficies que históricamente tenían listas estáticas:
   portada, página de colecciones, filtros del catálogo y pie de página.
   Firestore es la única fuente de verdad. Un MutationObserver evita que un
   renderer legado vuelva a dejar categorías antiguas después del snapshot.
   ============================================================= */

import { onCollectionsUpdate } from './estado-colecciones.js?v=tintin-20260901-firestore-budget-1';

if (!window.TintinCollectionsPhase4Booted) {
  window.TintinCollectionsPhase4Booted = true;

  const COLL_IMG_BASE = 'assets-tintin/images/collections/';
  const COLL_PLACEHOLDER = `${COLL_IMG_BASE}col-placeholder.webp`;
  const SLUG_FILE_MAP = { bolsos: 'bags' };

  let collections = null;
  let collectionError = null;
  let products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const ownedTargets = new Map();

  const clean = value => String(value == null ? '' : value).trim();

  const normalizeSlug = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^bags?$/, 'bolsos')
    .replace(/^ear-cuffs?$/, 'earcuff')
    .replace(/^arm-cuffs?$/, 'armcuff')
    .replace(/^jewelry-box$/, 'joyeros');

  function catalogHref(slug) {
    slug = normalizeSlug(slug);
    return `/catalogo?cat=${encodeURIComponent(clean(slug))}`;
  }

  function safeUrl(value, fallback = '') {
    const candidate = clean(value);
    if (!candidate) return fallback;
    try {
      const parsed = new URL(candidate, window.location.href);
      if (!['https:', 'http:'].includes(parsed.protocol)) return fallback;
      if (
        window.location.protocol === 'https:' &&
        parsed.protocol === 'http:' &&
        parsed.origin !== window.location.origin
      ) {
        return fallback;
      }
      return parsed.href;
    } catch {
      return fallback;
    }
  }

  // Las tarjetas de colección se muestran a ~183x244px (2x retina ~370x490).
  // Una foto propia subida por Super Admin puede venir de cdn.shopify.com en
  // su resolución original (llegó a pesar >350 KB por imagen). Shopify sirve
  // cualquier archivo de ese CDN redimensionado on-the-fly agregando
  // ?width=N a la URL — no toca el archivo subido, solo pide una variante
  // más liviana en el momento de mostrarla. Si el host no es de Shopify, o
  // ya trae un parámetro de tamaño, se deja la URL intacta.
  function withShopifyCardWidth(href) {
    if (!href) return href;
    try {
      const url = new URL(href);
      if (!/(^|\.)cdn\.shopify\.com$/.test(url.hostname)) return href;
      if (url.searchParams.has('width')) return href;
      url.searchParams.set('width', '700');
      return url.href;
    } catch {
      return href;
    }
  }

  // Cuando la colección no tiene imagen propia (o fue eliminada), se usa la
  // foto del producto más antiguo de esa categoría como respaldo visual.
  // Es puramente de presentación: no se persiste nada en Firestore.
  function firstProductImage(slug) {
    const normalized = normalizeSlug(slug);
    const matches = products.filter(product =>
      normalizeSlug(product?.category || product?.cat) === normalized &&
      clean(product?.name) &&
      product?.active !== false &&
      clean(product?.imageUrl)
    );
    if (!matches.length) return '';
    matches.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
    return matches[0].imageUrl;
  }

  function imageCandidates(collection) {
    const slug = clean(collection?.slug);
    const file = SLUG_FILE_MAP[slug] || slug;
    return [...new Set([
      withShopifyCardWidth(safeUrl(collection?.image)),
      safeUrl(firstProductImage(slug)),
      safeUrl(`${COLL_IMG_BASE}col-${file}.webp`),
      safeUrl(COLL_PLACEHOLDER)
    ].filter(Boolean))];
  }

  function createImage(collection, fit = 'contain') {
    const image = document.createElement('img');
    const candidates = imageCandidates(collection);
    let index = 0;

    image.alt = `Colección ${clean(collection?.name) || clean(collection?.slug)}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = fit;
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

  function mark(node) {
    node.dataset.phase4CollectionNode = '1';
    return node;
  }

  function stateNode(message, kind = 'info') {
    const wrap = mark(document.createElement('div'));
    wrap.className = `tt-phase4-collections-state tt-phase4-collections-state--${kind}`;
    wrap.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    wrap.style.cssText =
      'grid-column:1/-1;width:100%;box-sizing:border-box;text-align:center;padding:28px 18px;color:var(--text-muted,#777);font-size:13px;';

    const text = document.createElement('div');
    text.textContent = message;
    wrap.appendChild(text);

    if (kind === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'tt-btn';
      retry.textContent = 'Reintentar';
      retry.style.marginTop = '12px';
      retry.addEventListener('click', () => window.location.reload());
      wrap.appendChild(retry);
    }
    return wrap;
  }

  function currentSignature(surface) {
    const data = collections || [];
    return `${surface}:${collectionError ? 'error' : collections ? 'ready' : 'loading'}:` +
      data.map(item => [item.slug, item.name, item.image, item.order].join('|')).join('::') +
      `:products-${products.length}`;
  }

  function replaceOwned(target, nodes, surface) {
    target.replaceChildren(...nodes);
    target.dataset.phase4CollectionsOwner = surface;
    target.dataset.phase4CollectionsSignature = currentSignature(surface);
  }

  function isOwnedRenderValid(target, surface) {
    return (
      target.dataset.phase4CollectionsOwner === surface &&
      target.dataset.phase4CollectionsSignature === currentSignature(surface) &&
      [...target.children].every(child => child.dataset.phase4CollectionNode === '1')
    );
  }

  function ownTarget(target, surface, renderer) {
    if (!target || ownedTargets.has(target)) return;
    const enforce = () => {
      if (!target.isConnected) return;
      if (!isOwnedRenderValid(target, surface)) renderer(target);
    };
    const observer = new MutationObserver(() => window.setTimeout(enforce, 0));
    observer.observe(target, { childList: true });
    ownedTargets.set(target, { observer, enforce });
    enforce();
  }

  function categoryCount(slug) {
    const normalized = normalizeSlug(slug);
    return products.filter(product =>
      normalizeSlug(product?.category || product?.cat) === normalized &&
      clean(product?.name)
    ).length;
  }

  // No hay productos aún cargados: no se puede saber qué colecciones están
  // vacías, así que se muestran todas para no ocultar catálogo real por error.
  function collectionsWithProducts() {
    if (!products.length) return collections || [];
    return (collections || []).filter(item => categoryCount(item.slug) > 0);
  }

  function collectionNodesOrState(buildNode, emptyMessage, hideEmpty = false) {
    if (collectionError) {
      return [stateNode('No pudimos cargar las colecciones.', 'error')];
    }
    if (!collections) return [stateNode('Cargando colecciones…')];
    const list = hideEmpty ? collectionsWithProducts() : collections;
    if (!list.length) return [stateNode(emptyMessage)];
    return list.map(buildNode);
  }

  function buildHomeCard(collection) {
    const link = mark(document.createElement('a'));
    const imageWrap = document.createElement('div');
    const overlay = document.createElement('div');
    const label = document.createElement('span');

    link.href = catalogHref(collection.slug);
    link.className = 'tt-coll-card';
    link.dataset.slug = clean(collection.slug);
    imageWrap.className = 'tt-coll-card-img';
    imageWrap.appendChild(createImage(collection));
    overlay.className = 'tt-coll-card-overlay';
    label.className = 'tt-coll-card-label';
    label.textContent = (clean(collection.name) || clean(collection.slug)).toUpperCase();
    overlay.appendChild(label);
    link.append(imageWrap, overlay);
    return link;
  }

  function renderHomeGrid(target) {
    replaceOwned(
      target,
      // Todas las colecciones publicadas deben poder abrirse, incluso si hoy
      // todavía no tienen productos asignados. El catálogo comunica ese
      // estado; ocultarlas acá las volvía imposibles de visitar.
      collectionNodesOrState(buildHomeCard, 'No hay colecciones disponibles todavía.'),
      'home-grid'
    );
  }

  function buildCollectionsPageCard(collection) {
    const card = mark(document.createElement('div'));
    const imageWrap = document.createElement('div');
    const body = document.createElement('div');
    const initial = document.createElement('div');
    const name = document.createElement('div');
    const description = document.createElement('p');
    const link = document.createElement('a');
    const label = clean(collection.name) || clean(collection.slug);

    card.className = 'tt-coll-page-card';
    card.dataset.slug = clean(collection.slug);
    imageWrap.className = 'tt-coll-page-img';
    imageWrap.appendChild(createImage(collection));
    body.className = 'tt-coll-page-body';
    initial.className = 'tt-coll-page-initial';
    initial.textContent = label.charAt(0).toUpperCase();
    name.className = 'tt-coll-page-name';
    name.textContent = label.toUpperCase();
    description.className = 'tt-coll-page-desc';
    description.textContent = clean(collection.description);
    link.href = catalogHref(collection.slug);
    link.className = 'tt-btn tt-btn-sm';
    link.textContent = 'Ver productos →';

    body.append(initial, name);
    if (description.textContent) body.appendChild(description);
    body.appendChild(link);
    card.append(imageWrap, body);
    return card;
  }

  function preserveCollectionsPageSkeletons(target) {
    if (collections || collectionError) return false;
    const skeletons = [...target.querySelectorAll(
      '.tt-coll-page-card[aria-hidden="true"]'
    )];
    if (!skeletons.length) return false;

    skeletons.forEach(mark);
    target.dataset.phase4CollectionsOwner = 'collections-page';
    target.dataset.phase4CollectionsSignature = currentSignature('collections-page');
    return true;
  }

  function renderCollectionsPage(target) {
    if (preserveCollectionsPageSkeletons(target)) return;
    replaceOwned(
      target,
      collectionNodesOrState(
        buildCollectionsPageCard,
        'No hay colecciones disponibles todavía.',
        true
      ),
      'collections-page'
    );
  }

  function selectedCatalogSlug() {
    const requested = clean(new URLSearchParams(window.location.search).get('cat'));
    const normalized = normalizeSlug(requested);
    if (!normalized || !collections?.some(item => normalizeSlug(item.slug) === normalized)) return 'todos';
    return normalized;
  }

  function navigateCatalog(slug) {
    const normalized = normalizeSlug(slug);
    if (normalized === 'todos') {
      window.location.assign('/catalogo');
      return;
    }
    window.location.assign(catalogHref(normalized));
  }

  function buildCatalogSidebarButton(collection, selected) {
    const button = mark(document.createElement('button'));
    const dot = document.createElement('span');
    const label = document.createElement('span');
    const count = document.createElement('span');

    button.type = 'button';
    button.className = `cat-filter-option${selected ? ' active' : ''}`;
    button.dataset.cat = clean(collection.slug);
    button.setAttribute('aria-pressed', String(selected));
    dot.className = 'cat-filter-dot';
    label.textContent = clean(collection.name) || clean(collection.slug);
    count.className = 'cat-filter-count';
    count.id = `count-${clean(collection.slug)}`;
    count.textContent = String(categoryCount(collection.slug));
    button.append(dot, label, count);
    button.addEventListener('click', () => navigateCatalog(collection.slug));
    return button;
  }

  function renderCatalogSidebar(target) {
    const title = mark(document.createElement('div'));
    const all = mark(document.createElement('button'));
    const dot = document.createElement('span');
    const label = document.createElement('span');
    const count = document.createElement('span');
    const selected = selectedCatalogSlug();

    title.className = 'cat-filter-title';
    title.textContent = 'Categoría';
    all.type = 'button';
    all.className = `cat-filter-option${selected === 'todos' ? ' active' : ''}`;
    all.dataset.cat = 'todos';
    all.setAttribute('aria-pressed', String(selected === 'todos'));
    dot.className = 'cat-filter-dot';
    label.textContent = 'Todas';
    count.className = 'cat-filter-count';
    count.id = 'count-todos';
    count.textContent = String(products.filter(product => clean(product?.name)).length);
    all.append(dot, label, count);
    all.addEventListener('click', () => navigateCatalog('todos'));

    const nodes = [title, all];
    if (collectionError) nodes.push(stateNode('No pudimos cargar las categorías.', 'error'));
    else if (!collections) nodes.push(stateNode('Cargando categorías…'));
    else collections.forEach(collection =>
      nodes.push(buildCatalogSidebarButton(collection, selected === collection.slug))
    );
    replaceOwned(target, nodes, 'catalog-sidebar');
  }

  function buildCatalogMobileButton(collection, selected) {
    const button = mark(document.createElement('button'));
    button.type = 'button';
    button.className = `tt-filtro-btn${selected ? ' activo' : ''}`;
    button.dataset.cat = clean(collection.slug);
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = clean(collection.name) || clean(collection.slug);
    button.addEventListener('click', () => navigateCatalog(collection.slug));
    return button;
  }

  function renderCatalogMobile(target) {
    const selected = selectedCatalogSlug();
    const all = mark(document.createElement('button'));
    all.type = 'button';
    all.className = `tt-filtro-btn${selected === 'todos' ? ' activo' : ''}`;
    all.dataset.cat = 'todos';
    all.setAttribute('aria-pressed', String(selected === 'todos'));
    all.textContent = 'Todos';
    all.addEventListener('click', () => navigateCatalog('todos'));

    const nodes = [all];
    if (collectionError) {
      const error = stateNode('Categorías no disponibles', 'error');
      error.style.padding = '8px 12px';
      nodes.push(error);
    } else if (!collections) {
      const loading = stateNode('Cargando…');
      loading.style.padding = '8px 12px';
      nodes.push(loading);
    } else {
      collections.forEach(collection =>
        nodes.push(buildCatalogMobileButton(collection, selected === collection.slug))
      );
    }
    replaceOwned(target, nodes, 'catalog-mobile');
    requestAnimationFrame(() => {
      const active = target.querySelector('.tt-filtro-btn.activo');
      if (!active) return;
      target.scrollLeft = Math.max(0, active.offsetLeft - ((target.clientWidth - active.offsetWidth) / 2));
    });
  }

  function buildFooterItem(collection) {
    const item = mark(document.createElement('li'));
    const link = document.createElement('a');
    link.href = catalogHref(collection.slug);
    link.textContent = clean(collection.name) || clean(collection.slug);
    item.appendChild(link);
    return item;
  }

  function renderFooterList(target) {
    let nodes;
    if (collectionError) {
      const item = mark(document.createElement('li'));
      item.textContent = 'Colecciones no disponibles';
      nodes = [item];
    } else if (!collections) {
      const item = mark(document.createElement('li'));
      item.textContent = 'Cargando colecciones…';
      nodes = [item];
    } else if (!collections.length) {
      const item = mark(document.createElement('li'));
      const link = document.createElement('a');
      link.href = '/catalogo';
      link.textContent = 'Ver catálogo';
      item.appendChild(link);
      nodes = [item];
    } else {
      nodes = collections.map(buildFooterItem);
    }
    replaceOwned(target, nodes, 'footer');
  }

  function findAndOwnTargets() {
    const homeGrid = document.querySelector('.tt-collections-section .tt-collections-grid');
    ownTarget(homeGrid, 'home-grid', renderHomeGrid);

    const pageGrid = document.querySelector('.tt-colls-page-grid');
    ownTarget(pageGrid, 'collections-page', renderCollectionsPage);

    const sidebar = [...document.querySelectorAll('.cat-filter-group')].find(group =>
      group.querySelector('[data-cat="todos"]')
    );
    ownTarget(sidebar, 'catalog-sidebar', renderCatalogSidebar);
    ownTarget(document.getElementById('cat-tabs-mobile'), 'catalog-mobile', renderCatalogMobile);

    document.querySelectorAll('.tt-footer-col-title').forEach(title => {
      const normalized = clean(title.textContent).toLowerCase();
      if (!['tienda', 'categorías', 'categorias'].includes(normalized)) return;
      ownTarget(title.parentElement?.querySelector('ul'), 'footer', renderFooterList);
    });
  }

  function rerenderOwnedTargets() {
    ownedTargets.forEach(({ enforce }) => enforce());
  }

  function bootDom() {
    findAndOwnTargets();
    const bodyObserver = new MutationObserver(() => {
      findAndOwnTargets();
      rerenderOwnedTargets();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDom, { once: true });
  } else {
    bootDom();
  }

  window.addEventListener('tintin:products-loaded', event => {
    products = Array.isArray(event.detail?.products) ? event.detail.products : [];
    rerenderOwnedTargets();
  });

  onCollectionsUpdate(
    nextCollections => {
      collections = nextCollections;
      collectionError = null;
      rerenderOwnedTargets();
      window.dispatchEvent(new CustomEvent('tintin:collections-phase4-ready', {
        detail: { count: nextCollections.length }
      }));
    },
    error => {
      collectionError = error || new Error('collections_unavailable');
      collections = null;
      rerenderOwnedTargets();
    }
  );
}
