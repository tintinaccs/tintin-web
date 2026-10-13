/* Canonical y Open Graph de cada producto siempre apuntan al dominio público.
 * El observador corrige también cambios posteriores hechos por el render en vivo. */
const TT_PUBLIC_PRODUCT_URL = 'https://tintinaccesorios.pages.dev/product';
const ttCanonicalProduct = document.getElementById('link-canonical');
const ttOpenGraphProductUrl = document.getElementById('meta-og-url');
let ttSyncingProductSeo = false;

function ttProductIdForSeo() {
  for (const candidate of [
    ttCanonicalProduct?.getAttribute('href'),
    ttOpenGraphProductUrl?.getAttribute('content'),
    window.location.href,
  ]) {
    try {
      const id = new URL(candidate || '', window.location.href).searchParams.get('id');
      if (id) return id;
    } catch {}
  }
  return '';
}

function ttSyncPublicProductSeo() {
  if (ttSyncingProductSeo) return;
  ttSyncingProductSeo = true;
  try {
    const url = new URL(TT_PUBLIC_PRODUCT_URL);
    const id = ttProductIdForSeo();
    if (id) url.searchParams.set('id', id);
    const href = url.href;
    if (ttCanonicalProduct?.getAttribute('href') !== href) {
      ttCanonicalProduct?.setAttribute('href', href);
    }
    if (ttOpenGraphProductUrl?.getAttribute('content') !== href) {
      ttOpenGraphProductUrl?.setAttribute('content', href);
    }
  } finally {
    ttSyncingProductSeo = false;
  }
}

ttSyncPublicProductSeo();
const ttProductSeoObserver = new MutationObserver(ttSyncPublicProductSeo);
if (ttCanonicalProduct) ttProductSeoObserver.observe(ttCanonicalProduct, { attributes: true, attributeFilter: ['href'] });
if (ttOpenGraphProductUrl) ttProductSeoObserver.observe(ttOpenGraphProductUrl, { attributes: true, attributeFilter: ['content'] });
window.addEventListener('pagehide', () => ttProductSeoObserver.disconnect(), { once: true });
window.TintinProductSeoCanonical = { sync: ttSyncPublicProductSeo };

const LIMIT = 3;
const EXIT_MS = 220;
const CATEGORY_FALLBACK = 'sin-coleccion';
const LAST_COMBINATION_KEY = 'tt_product_related_last_v1';

const grid = document.getElementById('related-grid');
const section = grid?.closest('.tt-related-section');
const refreshButton = document.getElementById('related-refresh');
const status = document.getElementById('related-status');

if (grid && !window.TintinRelatedProducts) {
  const state = {
    currentProduct: null,
    visible: [],
    history: new Map(),
    categoryHistory: new Set(),
    replacing: false,
  };

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function productCategory(product) {
    return String(product?.category || product?.cat || '').trim();
  }

  function escapeAttribute(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function categoryKey(product) {
    return productCategory(product).toLocaleLowerCase('es') || CATEGORY_FALLBACK;
  }

  function randomIndex(length) {
    if (length <= 1) return 0;
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function shuffled(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function validProducts() {
    const currentId = String(state.currentProduct?.id || '');
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    return products.filter(product => {
      if (!product || String(product.id) === currentId) return false;
      if (product.active === false || !String(product.name || '').trim()) return false;
      if (!productCategory(product)) return false;
      return typeof window.isFeaturable === 'function'
        ? window.isFeaturable(product)
        : !(product.stock != null && Number(product.stock) <= 0);
    });
  }

  function groupedProducts() {
    const groups = new Map();
    validProducts().forEach(product => {
      const key = categoryKey(product);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });
    const currentCategory = categoryKey(state.currentProduct);
    if (groups.size > 1) groups.delete(currentCategory);
    return groups;
  }

  function historyFor(category) {
    if (!state.history.has(category)) state.history.set(category, new Set());
    return state.history.get(category);
  }

  function chooseFromCategory(category, products, excludedIds = new Set()) {
    const available = products.filter(product => !excludedIds.has(String(product.id)));
    if (!available.length) return null;

    const history = historyFor(category);
    const unused = available.filter(product => !history.has(String(product.id)));
    if (!unused.length) return null;

    const selected = unused[randomIndex(unused.length)];
    history.add(String(selected.id));
    return selected;
  }

  function categoryOrder(groups, excludedCategories = new Set()) {
    const currentCategory = categoryKey(state.currentProduct);
    const keys = [...groups.keys()].filter(key => !excludedCategories.has(key));
    const preferred = shuffled(keys.filter(key => key !== currentCategory));
    const sameCollection = shuffled(keys.filter(key => key === currentCategory));
    return [...preferred, ...sameCollection];
  }

  function buildCombination({ excludeVisible = false } = {}) {
    const groups = groupedProducts();
    if (!groups.size) return [];
    const hasUnused = category => (groups.get(category) || []).some(product => !historyFor(category).has(String(product.id)));
    if (![...groups.keys()].some(hasUnused)) {
      state.history.clear();
      state.categoryHistory.clear();
    }
    // A product only re-enters after the entire eligible pool is exhausted.
    // With uneven collection sizes the end of a cycle can have fewer cards;
    // duplicating a collection to fill the row would violate the contract.
    const availableCategories = [...groups.keys()].filter(hasUnused);
    const targetCount = Math.min(LIMIT, availableCategories.length);
    const result = [];
    const visibleCategories = new Set(excludeVisible ? state.visible.map(categoryKey) : []);
    while (result.length < targetCount) {
      const used = new Set(result.map(categoryKey));
      const remaining = availableCategories.filter(category => !used.has(category));
      let categories = remaining.filter(category => !state.categoryHistory.has(category));
      if (!categories.length) { state.categoryHistory.clear(); categories = remaining; }
      const preferred = categories.filter(category => !visibleCategories.has(category));
      const choices = preferred.length ? preferred : categories;
      const category = choices[randomIndex(choices.length)];
      const selected = chooseFromCategory(category, groups.get(category) || []);
      if (!selected) break;
      result.push(selected);
      state.categoryHistory.add(category);
    }

    return result;
  }

  function rememberedCombination() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LAST_COMBINATION_KEY) || 'null');
      if (saved?.currentId !== String(state.currentProduct?.id || '') || !Array.isArray(saved.ids)) return [];
      return saved.ids.map(String);
    } catch {
      return [];
    }
  }

  function rememberCombination(products) {
    try {
      sessionStorage.setItem(LAST_COMBINATION_KEY, JSON.stringify({
        currentId: String(state.currentProduct?.id || ''),
        ids: products.map(product => String(product.id)),
      }));
    } catch {}
  }

  function buildInitialCombination() {
    const remembered = rememberedCombination().join('|');
    let combination = buildCombination();
    if (!remembered || combination.length < 2) return combination;
    for (let attempt = 0; attempt < 8 && combination.map(product => String(product.id)).join('|') === remembered; attempt += 1) {
      // A rejected initial draw is not a viewed product and must not consume
      // the browsing cycle.
      state.history.clear();
      state.categoryHistory.clear();
      combination = buildCombination();
    }
    return combination;
  }

  function cardMarkup(product) {
    if (typeof window.renderProductCardMarkup === 'function') {
      return window.renderProductCardMarkup(product, { related: true });
    }
    const id = encodeURIComponent(String(product.id));
    const name = escapeAttribute(product.name || 'Producto');
    return `<article class="tt-product-card" data-product-id="${id}">
      <a class="tt-product-card-fallback" href="/product?id=${id}">${name}</a>
    </article>`;
  }

  function renderSlot(product, index, entering = false) {
    return `<div class="tt-related-slot${entering ? ' is-entering' : ''}" data-related-index="${index}" data-product-id="${escapeAttribute(product.id)}" data-category="${escapeAttribute(categoryKey(product))}">${cardMarkup(product)}</div>`;
  }

  function announce(message) {
    if (!status) return;
    status.textContent = '';
    window.requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  function updateEmptyState() {
    const hasProducts = state.visible.length > 0;
    if (section) section.hidden = !hasProducts;
    if (refreshButton) {
      refreshButton.disabled = !hasProducts;
      refreshButton.hidden = validProducts().length < 2;
    }
  }

  function renderAll(products, { announceChange = false } = {}) {
    state.visible = products.slice(0, LIMIT);
    rememberCombination(state.visible);
    grid.innerHTML = state.visible.map((product, index) => renderSlot(product, index, true)).join('');
    grid.setAttribute('aria-busy', 'false');
    updateEmptyState();
    window.requestAnimationFrame(() => {
      grid.querySelectorAll('.is-entering').forEach(slot => slot.classList.remove('is-entering'));
    });
    if (announceChange && state.visible.length) {
      announce(`Se muestran ${state.visible.length} productos diferentes.`);
    }
  }

  async function refreshAll() {
    if (state.replacing) return;
    const combination = buildCombination({ excludeVisible: true });
    if (!combination.length) return;
    const previousIds = state.visible.map(product => String(product.id)).sort().join('|');
    const nextIds = combination.map(product => String(product.id)).sort().join('|');
    if (previousIds === nextIds) {
      announce('No hay otra combinación disponible en este momento.');
      return;
    }

    state.replacing = true;
    refreshButton?.classList.add('is-refreshing');
    grid.setAttribute('aria-busy', 'true');
    const slots = [...grid.querySelectorAll('.tt-related-slot')];
    slots.forEach(slot => slot.classList.add('is-leaving'));
    if (!motionQuery.matches) {
      await new Promise(resolve => window.setTimeout(resolve, EXIT_MS));
    }
    const eligible = groupedProducts();
    const latest = new Map([...eligible.values()].flat().map(product => [String(product.id), product]));
    const currentCombination = combination.map(product => latest.get(String(product.id))).filter(Boolean);
    renderAll(currentCombination.length ? currentCombination : buildCombination(), { announceChange: true });
    refreshButton?.classList.remove('is-refreshing');
    state.replacing = false;
  }

  function syncWithProducts() {
    const id = new URLSearchParams(window.location.search).get('id');
    state.currentProduct = (window.PRODUCTS || []).find(product => String(product.id) === String(id)) || null;
    if (!state.currentProduct) {
      state.visible = [];
      grid.innerHTML = '';
      grid.setAttribute('aria-busy', 'false');
      updateEmptyState();
      return;
    }

    const groups = groupedProducts();
    const targetCount = Math.min(LIMIT, groups.size);
    const stillValid = state.visible.length > 0
      && state.visible.length <= targetCount
      && state.visible.every(product => {
        const group = groups.get(categoryKey(product)) || [];
        return group.some(candidate => String(candidate.id) === String(product.id));
      })
      && new Set(state.visible.map(categoryKey)).size === Math.min(state.visible.length, groups.size);

    if (!stillValid) renderAll(state.visible.length ? buildCombination() : buildInitialCombination());
    else {
      const latest = new Map(validProducts().map(product => [String(product.id), product]));
      const refreshed = state.visible.map(product => latest.get(String(product.id)));
      const changed = refreshed.some((product, index) => cardMarkup(product) !== cardMarkup(state.visible[index]));
      if (changed) renderAll(refreshed);
      else state.visible = refreshed;
    }
    updateEmptyState();
  }

  refreshButton?.addEventListener('click', refreshAll);
  window.addEventListener('tintin:products-loaded', syncWithProducts);
  window.addEventListener('tintin:product-rendered', syncWithProducts);
  window.addEventListener('tintin:product-unavailable', syncWithProducts);

  window.TintinRelatedProducts = {
    refresh: refreshAll,
    sync: syncWithProducts,
    getVisible: () => state.visible.map(product => ({
      id: String(product.id),
      category: productCategory(product),
    })),
  };

  syncWithProducts();
}
