const FEATURED_LIMIT = 5;
const collectionsGrid = document.getElementById('colls-page-grid');
const featuredGrid = document.getElementById('collections-featured-grid');
const collectionsStatus = document.getElementById('collections-grid-status');
const featuredStatus = document.getElementById('collections-featured-status');
const cartSyncPromise = import('./cart-sync.js?v=tintin-20260716-color-scheme-1');
let liveProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
let collectionsReady = false;
let productsReady = false;
const hasInitialProducts = Array.isArray(window.PRODUCTS);

function normalizeCollectionSlug(value) {
  const slug = String(value || '').toLowerCase().trim();
  const aliases = { bags: 'bolsos', bag: 'bolsos', bolso: 'bolsos' };
  return aliases[slug] || slug;
}

function availableProducts(products) {
  return (Array.isArray(products) ? products : []).filter(product =>
    product &&
    product.active !== false &&
    product.name &&
    String(product.name).trim() &&
    !(product.stock != null && Number(product.stock) <= 0)
  );
}

function selectedFeaturedProducts(products) {
  const available = availableProducts(products);
  const explicitlyFeatured = available.filter(product => product.destacado === true);
  const remaining = available.filter(product => product.destacado !== true);
  return [...explicitlyFeatured, ...remaining].slice(0, FEATURED_LIMIT);
}

function enhanceFeaturedCards() {
  if (!featuredGrid) return;
  featuredGrid.querySelectorAll('.tt-product-card:not(.tt-skeleton-card)').forEach((card, index) => {
    const name = card.querySelector('.tt-product-name');
    const image = card.querySelector('.tt-product-img');
    const link = card.querySelector('.tt-product-actions a[href]');
    const label = String(name?.textContent || 'producto').trim();
    const nameId = `collections-featured-title-${index}`;

    card.setAttribute('role', 'article');
    if (name) {
      name.id = nameId;
      name.setAttribute('role', 'heading');
      name.setAttribute('aria-level', '3');
      card.setAttribute('aria-labelledby', nameId);
    }
    if (image && link) {
      image.setAttribute('role', 'link');
      image.setAttribute('tabindex', '0');
      image.setAttribute('aria-label', `Ver ${label}`);
      image.dataset.productHref = link.href;
    }
  });
}

function renderFeaturedProducts(products) {
  liveProducts = Array.isArray(products) ? products : [];
  if (!featuredGrid || typeof window.renderProductsGrid !== 'function') return false;
  const selectedProducts = selectedFeaturedProducts(liveProducts);
  window.renderProductsGrid(featuredGrid.id, selectedProducts);
  featuredGrid.setAttribute('aria-busy', 'false');
  if (featuredStatus) {
    featuredStatus.textContent = `${selectedProducts.length} producto${selectedProducts.length === 1 ? '' : 's'} destacado${selectedProducts.length === 1 ? '' : 's'} cargado${selectedProducts.length === 1 ? '' : 's'}.`;
  }
  productsReady = true;
  enhanceFeaturedCards();
  enhanceCollectionCards();
  return true;
}

function scheduleFeaturedRender(products, attempt = 0) {
  if (renderFeaturedProducts(products)) return;
  if (attempt < 20) {
    window.setTimeout(() => scheduleFeaturedRender(products, attempt + 1), 50);
  } else {
    showFeaturedError();
  }
}

function showFeaturedError() {
  if (!featuredGrid || productsReady) return;
  featuredGrid.setAttribute('aria-busy', 'false');
  if (featuredStatus) featuredStatus.textContent = 'No se pudieron cargar los productos destacados.';
  featuredGrid.innerHTML = `
    <div class="tt-collections-state" role="alert">
      <p>No pudimos cargar los productos destacados. Podés seguir explorando las colecciones o intentarlo nuevamente.</p>
      <button type="button" class="tt-btn" id="collections-products-retry">Reintentar</button>
    </div>`;
  document.getElementById('collections-products-retry')?.addEventListener('click', () => location.reload());
}

function productCountFor(slug) {
  const wanted = normalizeCollectionSlug(slug);
  return liveProducts.filter(product =>
    product &&
    product.active !== false &&
    product.name &&
    normalizeCollectionSlug(product.category || product.cat) === wanted
  ).length;
}

function enhanceCollectionCards() {
  if (!collectionsGrid) return;
  collectionsGrid.querySelectorAll('.tt-coll-page-card').forEach((card, index) => {
    const name = card.querySelector('.tt-coll-page-name');
    const initial = card.querySelector('.tt-coll-page-initial');
    const image = card.querySelector('.tt-coll-page-img');
    const body = card.querySelector('.tt-coll-page-body');
    const link = card.querySelector('.tt-coll-page-body > .tt-btn');
    const label = String(name?.textContent || card.dataset.slug || 'colección').trim();
    const nameId = `collection-card-title-${index}`;

    card.setAttribute('role', 'article');
    if (name) {
      name.id = nameId;
      name.setAttribute('role', 'heading');
      name.setAttribute('aria-level', '2');
      card.setAttribute('aria-labelledby', nameId);
    }
    initial?.setAttribute('aria-hidden', 'true');

    if (link) link.setAttribute('aria-label', `Ver productos de ${label}`);
    if (image && link) {
      image.setAttribute('role', 'link');
      image.setAttribute('tabindex', '0');
      image.setAttribute('aria-label', `Abrir la colección ${label}`);
      image.dataset.collectionHref = link.href;
    }

    if (body && productsReady) {
      let count = body.querySelector('.tt-coll-page-count');
      if (!count) {
        count = document.createElement('span');
        count.className = 'tt-coll-page-count';
        const description = body.querySelector('.tt-coll-page-desc');
        body.insertBefore(count, description || link || null);
      }
      const amount = productCountFor(card.dataset.slug);
      count.textContent = `${amount} producto${amount === 1 ? '' : 's'}`;
      count.setAttribute('aria-label', `${amount} producto${amount === 1 ? '' : 's'} en esta colección`);
    }
  });
}

function completeCollectionsLoading() {
  if (collectionsReady) return;
  const owner = collectionsGrid?.dataset.phase4CollectionsOwner;
  const signature = collectionsGrid?.dataset.phase4CollectionsSignature || '';
  if (!owner || signature.includes(':loading:')) return;
  collectionsReady = true;
  collectionsGrid.setAttribute('aria-busy', 'false');
  if (collectionsStatus) {
    if (signature.includes(':error:')) {
      collectionsStatus.textContent = 'No se pudieron cargar las colecciones.';
    } else {
      const amount = collectionsGrid.querySelectorAll('.tt-coll-page-card').length;
      collectionsStatus.textContent = `${amount} colección${amount === 1 ? '' : 'es'} cargada${amount === 1 ? '' : 's'}.`;
    }
  }
  enhanceCollectionCards();
  window.ttPageReady && window.ttPageReady();
}

collectionsGrid?.addEventListener('click', event => {
  const image = event.target.closest('.tt-coll-page-img[data-collection-href]');
  if (!image) return;
  location.href = image.dataset.collectionHref;
});

collectionsGrid?.addEventListener('keydown', event => {
  const image = event.target.closest('.tt-coll-page-img[data-collection-href]');
  if (!image || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  location.href = image.dataset.collectionHref;
});

collectionsGrid && new MutationObserver(() => {
  window.setTimeout(() => {
    completeCollectionsLoading();
    enhanceCollectionCards();
  }, 0);
}).observe(collectionsGrid, { childList: true });

window.addEventListener('tintin:collections-phase4-ready', () => {
  window.setTimeout(completeCollectionsLoading, 0);
});

window.addEventListener('tintin:products-loaded', event => {
  window.setTimeout(() => scheduleFeaturedRender(event.detail?.products), 0);
});

window.addEventListener('tintin:products-error', showFeaturedError);

featuredGrid?.addEventListener('click', async event => {
  const productImage = event.target.closest('.tt-product-img[data-product-href]');
  if (productImage) {
    location.href = productImage.dataset.productHref;
    return;
  }

  const button = event.target.closest('.tt-add-to-cart');
  if (!button || button.disabled) return;
  event.preventDefault();
  event.stopPropagation();

  const product = liveProducts.find(item => String(item.id) === String(button.dataset.id));
  if (!product || (product.stock != null && Number(product.stock) <= 0)) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Agregando...';
  try {
    const cartSync = await cartSyncPromise;
    const result = await cartSync.addToCart({
      id: product.id,
      name: product.name,
      cat: product.category || product.cat || '',
      price: product.price,
      qty: 1,
      stock: product.stock,
      imageUrl: product.imageUrl || ''
    });
    button.textContent = result.changed ? '✓ Agregado' : (result.reason === 'already_in_cart' ? 'Ya está en tu carrito' : 'Stock máximo');
  } catch (error) {
    console.error('[collections] No se pudo agregar el producto:', error);
    button.textContent = 'Reintentar';
  } finally {
    button.removeAttribute('aria-busy');
    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1500);
  }
});

featuredGrid?.addEventListener('keydown', event => {
  const productImage = event.target.closest('.tt-product-img[data-product-href]');
  if (!productImage || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  location.href = productImage.dataset.productHref;
});

if (hasInitialProducts) scheduleFeaturedRender(liveProducts);

window.setTimeout(() => {
  completeCollectionsLoading();
  if (!collectionsReady) window.ttPageReady && window.ttPageReady();
  if (!productsReady) showFeaturedError();
}, 5000);
