import { normalizeProductSearch as normalize, productSearchText, productSearchScore } from '../../../core/store/busqueda-productos.mjs?v=tintin-20261021-commerce-review-1';
// Misma URL que carga-navegacion.js: una sola instancia del catálogo aunque
// la búsqueda se abra antes de que termine de cargar.
const PRODUCTS_RUNTIME_URL = '../../../core/store/estado-productos.js?v=tintin-20261027-welcome-receipt-1-nav-20261028-2';

// El área desplazable conserva todas las coincidencias del catálogo público.
import { hasProductStock, firstAvailableVariant, productDefaultPrice } from '../../../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';
import { productVariantImage } from '../../images/foto-variante.mjs?v=tintin-20261023-variant-engine-v2-2';
const INPUT_DELAY_MS = 120;

let index = [];
let timer = 0;
let activeIndex = -1;
let loadPromise = null;
let catalogLoaded = false;
let catalogSignature = '';

function safeImageUrl(value) {
  if (!String(value || '').trim()) return '';
  try {
    const url = new URL(String(value || ''), location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (location.protocol === 'https:' && url.protocol === 'http:' && url.origin !== location.origin) return '';
    return url.href;
  } catch {
    return '';
  }
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `Gs. ${Math.round(amount).toLocaleString('es-PY')}`;
}

function buildIndex(products) {
  index = (Array.isArray(products) ? products : [])
    .filter(product => product && (window.TintinCatalogPolicy?.isCatalogVisible
      ? window.TintinCatalogPolicy.isCatalogVisible(product)
      : product.active !== false && String(product.name || '').trim() && Number(product.price) > 0))
    .map(product => ({ product, searchText: productSearchText(product) }));
}

function resultScore(entry, query) {
  return productSearchScore(entry.product, query, entry.searchText);
}

function searchProducts(query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  return index
    .map(entry => ({ ...entry, score: resultScore(entry, normalizedQuery) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => (b.score === 100) - (a.score === 100) || Number(hasProductStock(b.product)) - Number(hasProductStock(a.product)) || b.score - a.score || String(a.product.name).localeCompare(String(b.product.name), 'es'))
    .map(entry => entry.product);
}

function stateNode(message, { error = false, retry = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `tt-search-state${error ? ' tt-search-state--error' : ''}`;
  wrap.setAttribute('role', error ? 'alert' : 'status');

  const text = document.createElement('p');
  text.textContent = message;
  wrap.appendChild(text);

  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tt-search-retry';
    button.textContent = 'Reintentar';
    button.addEventListener('click', () => {
      loadPromise = null;
      void ensureProducts(true).catch(() => {});
    });
    wrap.appendChild(button);
  }
  return wrap;
}

function imagePlaceholder() {
  const placeholder = document.createElement('span');
  placeholder.className = 'tt-search-result-image tt-search-result-image--empty';
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

function createResult(product, position, query) {
  const link = document.createElement('a');
  link.className = 'tt-search-result-item';
  const inStock = hasProductStock(product);
  link.classList.toggle('tt-stock-unavailable', !inStock);
  link.id = `tt-search-result-${position}`;
  link.href = `/product?id=${encodeURIComponent(String(product.id || ''))}`;
  link.setAttribute('role', 'option');
  link.setAttribute('aria-selected', 'false');
  link.dataset.searchPosition = String(position);

  const media = document.createElement('span');
  media.className = 'tt-search-result-media';
  link.appendChild(media);
  const imageUrl = safeImageUrl(productVariantImage(product, firstAvailableVariant(product), product.imageUrl || product.imgUrl || product.image));
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'tt-search-result-image';
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.replaceWith(imagePlaceholder()), { once: true });
    media.appendChild(image);
  } else {
    media.appendChild(imagePlaceholder());
  }

  if (!inStock) {
    const label = document.createElement('span'); label.className = 'tt-stock-label'; label.textContent = 'AGOTADO'; media.appendChild(label);
  }
  const body = document.createElement('span');
  body.className = 'tt-search-result-copy';
  const name = document.createElement('strong');
  name.textContent = String(product.name || 'Producto');
  const meta = document.createElement('span');
  const money = productDefaultPrice(product);
  meta.textContent = [String(product.category || product.cat || '').trim(), formatPrice(money.price)].filter(Boolean).join(' · ');
  const previous = Number(money.priceBefore);
  const current = Number(money.price);
  if (Number.isFinite(previous) && Number.isFinite(current) && current > 0 && previous > current) {
    const oldPrice = document.createElement('s');
    oldPrice.textContent = formatPrice(previous);
    oldPrice.setAttribute('aria-label', `Precio anterior ${formatPrice(previous)}`);
    const discount = document.createElement('span');
    discount.textContent = ` · −${Math.max(1, Math.round((1 - current / previous) * 100))}%`;
    meta.append(' · ', oldPrice, discount);
  }
  if (!inStock) meta.append(' · Agotado');
  if (productSearchScore(product, query) === 10) meta.append(' · Coincidencia aproximada');
  body.append(name, meta);
  link.appendChild(body);
  return link;
}

function showResultsContainer(results) {
  results.hidden = false;
  results.style.display = 'block';
  document.getElementById('search-panel')?.classList.add('tt-has-results');
  document.getElementById('search-input')?.setAttribute('aria-expanded', 'true');
}

function hideResultsContainer(results) {
  results.hidden = true;
  results.style.display = 'none';
  document.getElementById('search-panel')?.classList.remove('tt-has-results');
  document.getElementById('search-input')?.setAttribute('aria-expanded', 'false');
}

function renderResults(query) {
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  if (!results || !input) return;

  const clear = document.getElementById('btn-search-clear');
  if (clear) clear.hidden = !input.value;
  activeIndex = -1;
  input.removeAttribute('aria-activedescendant');
  results.replaceChildren();

  const cleaned = String(query || '').trim();
  if (!cleaned) {
    hideResultsContainer(results);
    return;
  }

  showResultsContainer(results);
  if (!catalogLoaded) {
    results.appendChild(stateNode('Cargando catálogo…'));
    void ensureProducts().catch(() => {});
    return;
  }

  const matches = searchProducts(cleaned);
  if (!matches.length) {
    results.appendChild(stateNode(`No encontramos resultados para “${cleaned}”.`));
    return;
  }
  const fragment = document.createDocumentFragment();
  matches.forEach((product, position) => fragment.appendChild(createResult(product, position, cleaned)));
  results.appendChild(fragment);
}

export function syncSearchCatalog(products) {
  const catalog = Array.isArray(products) ? products : [];
  // El mismo single-flight puede publicar a varios consumidores. No destruir
  // los resultados ni su scroll cuando vuelve a llegar el mismo snapshot.
  const signature = JSON.stringify(catalog);
  if (catalogLoaded && signature === catalogSignature) return catalog.length;
  window.clearTimeout(timer);
  timer = 0;
  catalogLoaded = true;
  catalogSignature = signature;
  buildIndex(catalog);
  renderResults(document.getElementById('search-input')?.value || '');
  return catalog.length;
}

export function resetSearchState() {
  window.clearTimeout(timer);
  timer = 0;
  activeIndex = -1;

  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (input) {
    input.value = '';
    input.removeAttribute('aria-activedescendant');
    const clear = document.getElementById('btn-search-clear');
    if (clear) clear.hidden = true;
  }
  if (results) {
    results.replaceChildren();
    hideResultsContainer(results);
  }
}

function exposeSearchController() {
  window.TintinSearchController = Object.freeze({
    syncCatalog: syncSearchCatalog,
    reset: resetSearchState,
    renderCurrentQuery: () => renderResults(document.getElementById('search-input')?.value || ''),
    catalogSize: () => index.length,
  });
}

function setActiveResult(nextIndex) {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;
  const items = [...results.querySelectorAll('.tt-search-result-item')];
  if (!items.length) return;

  activeIndex = (nextIndex + items.length) % items.length;
  items.forEach((item, indexValue) => {
    const active = indexValue === activeIndex;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    if (active) {
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

async function ensureProducts(force = false) {
  if (loadPromise && !force) return loadPromise;

  const results = document.getElementById('search-results');
  if (results && document.getElementById('search-input')?.value) {
    showResultsContainer(results);
    results.replaceChildren(stateNode('Cargando catálogo…'));
  }

  loadPromise = import(PRODUCTS_RUNTIME_URL)
    .then(module => {
      const load = window.TintinProductsStore?.ensureSearch || module.ensureProductsForSearch || module.loadAllProducts;
      return typeof load === 'function' ? load({ force }) : window.PRODUCTS || [];
    })
    .then(products => {
      syncSearchCatalog(Array.isArray(products) ? products : window.PRODUCTS || []);
      return products;
    })
    .catch(error => {
      loadPromise = null;
      console.warn('[SearchController] No se pudo cargar el catálogo.', error);
      if (results && document.getElementById('search-input')?.value && document.getElementById('search-panel')?.classList.contains('open')) {
        showResultsContainer(results);
        results.replaceChildren(stateNode('No pudimos cargar el catálogo. Revisá tu conexión y volvé a intentar.', { error: true, retry: true }));
      }
      throw error;
    });
  return loadPromise;
}

export function initSearchController() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results || input.dataset.ttModularSearchReady === '1') return;
  input.dataset.ttModularSearchReady = '1';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-results');

  if (Array.isArray(window.PRODUCTS)) syncSearchCatalog(window.PRODUCTS);

  document.getElementById('btn-search-clear')?.addEventListener('click', () => {
    resetSearchState();
    input.focus({ preventScroll: true });
  });

  input.addEventListener('input', () => {
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    const clear = document.getElementById('btn-search-clear');
    if (clear) clear.hidden = !input.value;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      renderResults(input.value);
    }, INPUT_DELAY_MS);
  });

  input.addEventListener('keydown', event => {
    if (timer && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      window.clearTimeout(timer);
      timer = 0;
      renderResults(input.value);
    }

    const items = [...results.querySelectorAll('.tt-search-result-item')];
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActiveResult(activeIndex + 1);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActiveResult(activeIndex < 0 ? items.length - 1 : activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      items[activeIndex].click();
    }
  });

  window.addEventListener('tintin:products-loaded', event => {
    syncSearchCatalog(event.detail?.products || window.PRODUCTS || []);
  });

  window.addEventListener('tintin:products-error', event => {
    if (!input.value || !document.getElementById('search-panel')?.classList.contains('open')) return;
    console.warn('[SearchController] Catálogo no disponible.', event.detail?.error);
    showResultsContainer(results);
    results.replaceChildren(stateNode('No pudimos cargar el catálogo. Revisá tu conexión y volvé a intentar.', { error: true, retry: true }));
  });
}

exposeSearchController();
initSearchController();
