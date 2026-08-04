const MAX_RESULTS = 10;
const INPUT_DELAY_MS = 120;

let index = [];
let timer = 0;
let activeIndex = -1;
let loadPromise = null;

function normalize(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

function safeImageUrl(value) {
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

function productSearchText(product) {
  const variants = product?.variants && typeof product.variants === 'object'
    ? JSON.stringify(product.variants)
    : '';
  return normalize([
    product?.name,
    product?.category,
    product?.cat,
    product?.description,
    product?.desc,
    ...(Array.isArray(product?.tags) ? product.tags : []),
    variants,
  ].filter(Boolean).join(' '));
}

function buildIndex(products) {
  index = (Array.isArray(products) ? products : [])
    .filter(product => product && product.active !== false)
    .map(product => ({ product, searchText: productSearchText(product) }));
}

function resultScore(entry, query) {
  const name = normalize(entry.product?.name);
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 60;
  if (entry.searchText.includes(query)) return 30;
  const words = query.split(' ').filter(Boolean);
  return words.length && words.every(word => entry.searchText.includes(word)) ? 20 : 0;
}

function searchProducts(query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  return index
    .map(entry => ({ ...entry, score: resultScore(entry, normalizedQuery) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.product.name).localeCompare(String(b.product.name), 'es'))
    .slice(0, MAX_RESULTS)
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
      void ensureProducts(true);
    });
    wrap.appendChild(button);
  }
  return wrap;
}

function createResult(product, position) {
  const link = document.createElement('a');
  link.className = 'tt-search-result-item';
  link.id = `tt-search-result-${position}`;
  link.href = `product.html?id=${encodeURIComponent(String(product.id || ''))}`;
  link.setAttribute('role', 'option');
  link.setAttribute('aria-selected', 'false');
  link.dataset.searchPosition = String(position);

  const imageUrl = safeImageUrl(product.imageUrl || product.imgUrl || product.image);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'tt-search-result-image';
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    link.appendChild(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'tt-search-result-image tt-search-result-image--empty';
    placeholder.setAttribute('aria-hidden', 'true');
    link.appendChild(placeholder);
  }

  const body = document.createElement('span');
  body.className = 'tt-search-result-copy';
  const name = document.createElement('strong');
  name.textContent = String(product.name || 'Producto');
  const meta = document.createElement('span');
  meta.textContent = [String(product.category || product.cat || '').trim(), formatPrice(product.price)].filter(Boolean).join(' · ');
  body.append(name, meta);
  link.appendChild(body);
  return link;
}

function showResultsContainer(results) {
  results.hidden = false;
  results.style.display = 'block';
}

function renderResults(query) {
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  if (!results || !input) return;

  activeIndex = -1;
  input.removeAttribute('aria-activedescendant');
  results.replaceChildren();

  const cleaned = String(query || '').trim();
  if (!cleaned) {
    results.style.display = 'none';
    return;
  }

  showResultsContainer(results);
  if (!index.length) {
    results.appendChild(stateNode('Cargando catálogo…'));
    void ensureProducts();
    return;
  }

  const matches = searchProducts(cleaned);
  if (!matches.length) {
    results.appendChild(stateNode(`No encontramos resultados para “${cleaned}”.`));
    return;
  }
  const fragment = document.createDocumentFragment();
  matches.forEach((product, position) => fragment.appendChild(createResult(product, position)));
  results.appendChild(fragment);
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
  if (!force && Array.isArray(window.PRODUCTS) && window.PRODUCTS.length) {
    buildIndex(window.PRODUCTS);
    renderResults(document.getElementById('search-input')?.value || '');
    return window.PRODUCTS;
  }
  if (loadPromise && !force) return loadPromise;

  const results = document.getElementById('search-results');
  if (results && document.getElementById('search-input')?.value) {
    showResultsContainer(results);
    results.replaceChildren(stateNode('Cargando catálogo…'));
  }

  loadPromise = import('../../../products-store.js?v=tintin-20260730-stock-visibility-1')
    .then(module => {
      const load = window.TintinProductsStore?.ensureSearch || module.ensureProductsForSearch || module.loadAllProducts;
      return typeof load === 'function' ? load({ force }) : window.PRODUCTS || [];
    })
    .then(products => {
      buildIndex(Array.isArray(products) ? products : window.PRODUCTS || []);
      renderResults(document.getElementById('search-input')?.value || '');
      return products;
    })
    .catch(error => {
      loadPromise = null;
      console.warn('[SearchController] No se pudo cargar el catálogo.', error);
      if (results) {
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
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-results');

  if (Array.isArray(window.PRODUCTS)) buildIndex(window.PRODUCTS);

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => renderResults(input.value), INPUT_DELAY_MS);
  });

  input.addEventListener('keydown', event => {
    const items = [...results.querySelectorAll('.tt-search-result-item')];
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActiveResult(activeIndex + 1);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActiveResult(activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      items[activeIndex].click();
    }
  });

  window.addEventListener('tintin:products-loaded', event => {
    buildIndex(event.detail?.products || window.PRODUCTS || []);
    if (input.value) renderResults(input.value);
  });

  window.addEventListener('tintin:products-error', event => {
    if (!input.value) return;
    console.warn('[SearchController] Catálogo no disponible.', event.detail?.error);
    showResultsContainer(results);
    results.replaceChildren(stateNode('No pudimos cargar el catálogo. Revisá tu conexión y volvé a intentar.', { error: true, retry: true }));
  });
}

initSearchController();
