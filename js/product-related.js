const LIMIT = 4;
const AUTO_ROTATE_MS = 7600;
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
    timer: 0,
    pointerPaused: false,
    focusPaused: false,
    replacing: false,
    destroyed: false,
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
    let unused = available.filter(product => !history.has(String(product.id)));
    if (!unused.length) {
      history.clear();
      unused = available;
    }

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
    const visibleIds = excludeVisible
      ? new Set(state.visible.map(product => String(product.id)))
      : new Set();
    const visibleCategories = excludeVisible
      ? new Set(state.visible.map(categoryKey))
      : new Set();

    let categories = categoryOrder(groups, visibleCategories);
    if (categories.length < Math.min(LIMIT, groups.size)) {
      categories = [
        ...categories,
        ...categoryOrder(groups).filter(category => !categories.includes(category)),
      ];
    }

    const result = [];
    for (const category of categories) {
      const selected = chooseFromCategory(category, groups.get(category) || [], visibleIds);
      if (!selected) continue;
      result.push(selected);
      visibleIds.add(String(selected.id));
      if (result.length === Math.min(LIMIT, groups.size)) break;
    }
    const targetCount = Math.min(LIMIT, groups.size);
    if (excludeVisible && result.length < targetCount) {
      const usedCategories = new Set(result.map(categoryKey));
      for (const product of shuffled(state.visible)) {
        const category = categoryKey(product);
        if (usedCategories.has(category)) continue;
        const stillExists = (groups.get(category) || []).some(candidate =>
          String(candidate.id) === String(product.id)
        );
        if (!stillExists) continue;
        result.push(product);
        usedCategories.add(category);
        if (result.length === targetCount) break;
      }
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
      <a class="tt-product-card-fallback" href="product.html?id=${id}">${name}</a>
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
      refreshButton.hidden = state.visible.length < 2;
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

  function clearTimer() {
    if (!state.timer) return;
    window.clearTimeout(state.timer);
    state.timer = 0;
  }

  function shouldPause() {
    return document.hidden
      || motionQuery.matches
      || state.pointerPaused
      || state.focusPaused
      || state.replacing
      || state.visible.length < 2;
  }

  function scheduleRotation() {
    clearTimer();
    if (state.destroyed || shouldPause()) return;
    state.timer = window.setTimeout(async () => {
      await rotateOne();
      scheduleRotation();
    }, AUTO_ROTATE_MS);
  }

  function findReplacement(index) {
    const groups = groupedProducts();
    const otherVisible = state.visible.filter((_, visibleIndex) => visibleIndex !== index);
    const excludedCategories = new Set(otherVisible.map(categoryKey));
    const excludedIds = new Set(state.visible.map(product => String(product.id)));
    const outgoingCategory = categoryKey(state.visible[index]);
    const categories = categoryOrder(groups, excludedCategories);
    const preferred = [
      ...categories.filter(category => category !== outgoingCategory),
      ...categories.filter(category => category === outgoingCategory),
    ];

    for (const category of preferred) {
      const selected = chooseFromCategory(category, groups.get(category) || [], excludedIds);
      if (selected) return selected;
    }
    return null;
  }

  async function replaceSlot(index, replacement, announceChange = false) {
    const slot = grid.querySelector(`[data-related-index="${index}"]`);
    if (!slot || !replacement || state.replacing) return false;

    state.replacing = true;
    clearTimer();
    grid.setAttribute('aria-busy', 'true');
    slot.classList.add('is-leaving');
    if (!motionQuery.matches) {
      await new Promise(resolve => window.setTimeout(resolve, EXIT_MS));
    }

    state.visible[index] = replacement;
    rememberCombination(state.visible);
    slot.outerHTML = renderSlot(replacement, index, true);
    const nextSlot = grid.querySelector(`[data-related-index="${index}"]`);
    window.requestAnimationFrame(() => nextSlot?.classList.remove('is-entering'));
    grid.setAttribute('aria-busy', 'false');
    state.replacing = false;
    if (announceChange) announce('Combinación de productos actualizada.');
    scheduleRotation();
    return true;
  }

  async function rotateOne() {
    if (state.replacing || !state.visible.length) return false;
    const indexes = shuffled(state.visible.map((_, index) => index));
    for (const index of indexes) {
      const replacement = findReplacement(index);
      if (replacement) return replaceSlot(index, replacement);
    }
    return false;
  }

  async function refreshAll() {
    if (state.replacing) return;
    const combination = buildCombination({ excludeVisible: true });
    if (!combination.length) return;
    const previousIds = state.visible.map(product => String(product.id)).sort().join('|');
    const nextIds = combination.map(product => String(product.id)).sort().join('|');
    if (previousIds === nextIds) {
      announce('No hay otra combinación disponible en este momento.');
      scheduleRotation();
      return;
    }

    state.replacing = true;
    clearTimer();
    refreshButton?.classList.add('is-refreshing');
    grid.setAttribute('aria-busy', 'true');
    const slots = [...grid.querySelectorAll('.tt-related-slot')];
    slots.forEach(slot => slot.classList.add('is-leaving'));
    if (!motionQuery.matches) {
      await new Promise(resolve => window.setTimeout(resolve, EXIT_MS));
    }
    renderAll(combination, { announceChange: true });
    refreshButton?.classList.remove('is-refreshing');
    state.replacing = false;
    scheduleRotation();
  }

  function syncWithProducts() {
    const id = new URLSearchParams(window.location.search).get('id');
    state.currentProduct = (window.PRODUCTS || []).find(product => String(product.id) === String(id)) || null;
    if (!state.currentProduct) {
      state.visible = [];
      grid.innerHTML = '';
      grid.setAttribute('aria-busy', 'false');
      updateEmptyState();
      clearTimer();
      return;
    }

    const groups = groupedProducts();
    const stillValid = state.visible.length > 0
      && state.visible.length === Math.min(LIMIT, groups.size)
      && state.visible.every(product => {
        const group = groups.get(categoryKey(product)) || [];
        return group.some(candidate => String(candidate.id) === String(product.id));
      })
      && new Set(state.visible.map(categoryKey)).size === state.visible.length;

    if (!stillValid) renderAll(state.visible.length ? buildCombination() : buildInitialCombination());
    updateEmptyState();
    scheduleRotation();
  }

  refreshButton?.addEventListener('click', refreshAll);
  grid.addEventListener('pointerenter', () => {
    state.pointerPaused = true;
    clearTimer();
  });
  grid.addEventListener('pointerleave', () => {
    state.pointerPaused = false;
    scheduleRotation();
  });
  grid.addEventListener('focusin', () => {
    state.focusPaused = true;
    clearTimer();
  });
  grid.addEventListener('focusout', event => {
    if (grid.contains(event.relatedTarget)) return;
    state.focusPaused = false;
    scheduleRotation();
  });
  document.addEventListener('visibilitychange', scheduleRotation);
  window.addEventListener('tintin:products-loaded', syncWithProducts);
  window.addEventListener('tintin:product-rendered', syncWithProducts);
  window.addEventListener('tintin:product-unavailable', syncWithProducts);
  motionQuery.addEventListener?.('change', scheduleRotation);

  window.TintinRelatedProducts = {
    refresh: refreshAll,
    rotateOne,
    sync: syncWithProducts,
    getVisible: () => state.visible.map(product => ({
      id: String(product.id),
      category: productCategory(product),
    })),
    isPaused: shouldPause,
  };

  syncWithProducts();
}
