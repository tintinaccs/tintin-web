/* =============================================================
   TINTIN — Colecciones en menús públicos (Fase 4)

   Firestore es la única fuente de verdad. Los enlaces estáticos que todavía
   existen en algunos HTML se eliminan antes de suscribirse: si Firebase falla,
   se muestra un error explícito y nunca quedan categorías viejas visibles.
   ============================================================= */

const COLL_IMG_BASE = 'assets-tintin/images/collections/';
const COLL_PLACEHOLDER = `${COLL_IMG_BASE}col-placeholder.webp`;
const SLUG_FILE_MAP = { bolsos: 'bags' };
const MOBILE_GRADIENT = 'linear-gradient(135deg,#e8c5d0,#c48a9e)';

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

function catalogHref(slug) {
  return `catalogo.html?cat=${encodeURIComponent(text(slug))}`;
}

function imageCandidates(collection) {
  const slug = text(collection?.slug);
  const staticCover = safeUrl(`${COLL_IMG_BASE}col-${collImgFile(slug)}.webp`);
  const custom = safeUrl(collection?.image);
  const placeholder = safeUrl(COLL_PLACEHOLDER);
  return [...new Set([custom, staticCover, placeholder].filter(Boolean))];
}

function createCollectionImage(collection, className = '') {
  const image = document.createElement('img');
  const candidates = imageCandidates(collection);
  let candidateIndex = 0;

  image.className = className;
  image.alt = `Colección ${text(collection?.name) || text(collection?.slug)}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'contain';
  image.style.display = 'block';
  image.style.background = 'transparent';

  const applyCandidate = () => {
    const next = candidates[candidateIndex++];
    if (next) image.src = next;
    else image.remove();
  };

  image.addEventListener('error', applyCandidate);
  applyCandidate();
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

  if (safeUrl(collection.image)) icon.appendChild(createCollectionImage(collection));
  else icon.appendChild(createGenericIcon());

  link.append(icon, label);
  return link;
}

function buildMobileNode(container, collection) {
  const rich = container.classList.contains('tt-mobile-cats-grid');
  const link = document.createElement('a');
  link.href = catalogHref(collection.slug);
  link.dataset.phase4CollectionNode = '1';

  if (rich) {
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
  wrap.style.cssText =
    'padding:12px 16px;font-size:12px;color:var(--text-muted,#777);text-align:center;width:100%;box-sizing:border-box;';

  const messageNode = document.createElement('div');
  messageNode.textContent = message;
  wrap.appendChild(messageNode);

  if (kind === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reintentar';
    retry.style.cssText =
      'margin-top:8px;border:0;border-radius:999px;padding:7px 14px;background:#b84c72;color:#fff!important;font:700 11px Montserrat;cursor:pointer;';
    retry.addEventListener('click', () => window.location.reload());
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
    container.replaceChildren(
      createStateNode('No pudimos cargar las colecciones.', 'error')
    );
    container.dataset.phase4CollectionsState = 'error';
  });
}

export function initNavCollections() {
  renderLoading();
  import('./collections-store.js?v=tintin-20260716-cloudinary-fix-1')
    .then(({ onCollectionsUpdate }) => {
      onCollectionsUpdate(
        collections => {
          document
            .querySelectorAll('[data-collections-nav="desktop"]')
            .forEach(container => renderInto(container, collections, buildDesktopCard));
          document
            .querySelectorAll('[data-collections-nav="mobile"]')
            .forEach(container =>
              renderInto(container, collections, collection =>
                buildMobileNode(container, collection)
              )
            );
          document
            .querySelectorAll('[data-collections-nav="sheet"]')
            .forEach(container => renderInto(container, collections, buildSheetItem));
        },
        error => {
          console.error('[nav-collections] No se pudieron cargar las colecciones:', error);
          renderError();
        }
      );
    })
    .catch(error => {
      console.error('[nav-collections] No se pudo iniciar la sincronización:', error);
      renderError();
    });
}

initNavCollections();

// Se conservan estos exports para los módulos antiguos que puedan importarlos.
// Ahora devuelven nodos/valores seguros en vez de fragmentos HTML.
function slugFromHref(href) {
  try {
    return new URL(href || '', window.location.href).searchParams.get('cat');
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
