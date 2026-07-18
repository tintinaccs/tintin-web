/* =============================================================
   TINTIN — Runtime de mantenimiento de la página principal
   ============================================================= */

const HOME_PATH_RE = /(?:^|\/)(?:index\.html)?\/?$/i;
const isHome = HOME_PATH_RE.test(window.location.pathname || '');

if (isHome && !window.TintinHomeMaintenanceBooted) {
  window.TintinHomeMaintenanceBooted = true;

  const body = document.body;
  const PRODUCTS_TIMEOUT_MS = 5000;
  const LOOK_TIMEOUT_MS = 5000;
  let productsResolved = false;
  let lookResolved = false;

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[<>]/g, '');
  }

  function currentBaseUrl() {
    const base = new URL('./', window.location.href);
    return base.href;
  }

  function normalizePublicMetadata() {
    const base = currentBaseUrl();
    const homeUrl = new URL('index.html', base).href;
    const coverUrl = new URL('assets/og-cover.jpg', base).href;
    const logoUrl = new URL('assets-tintin/images/general/logo.png', base).href;

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = homeUrl;

    const selectors = [
      ['meta[property="og:url"]', 'content', homeUrl],
      ['meta[property="og:image"]', 'content', coverUrl],
      ['meta[name="twitter:image"]', 'content', coverUrl],
    ];
    selectors.forEach(([selector, attribute, value]) => {
      document.querySelector(selector)?.setAttribute(attribute, value);
    });

    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const value = JSON.parse(script.textContent || '{}');
        const serialized = JSON.stringify(value);
        if (!serialized.includes('tintinaccs.github.io/tintin-web')) return;
        const normalized = JSON.parse(serialized
          .replaceAll('https://tintinaccs.github.io/tintin-web/', base)
          .replaceAll('https://tintinaccs.github.io/tintin-web', base.replace(/\/$/, '')));
        if (normalized?.['@graph']) {
          normalized['@graph'].forEach(node => {
            if (node?.['@type'] === 'Organization') node.logo = logoUrl;
          });
        }
        script.textContent = JSON.stringify(normalized);
      } catch (error) {
        console.warn('[home-maintenance] JSON-LD inválido:', error);
      }
    });
  }

  function updateThemeColor() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand-primary')
      .trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
    }
  }

  function updateFooterYear() {
    const footer = document.querySelector('.tt-footer-bottom');
    if (!footer) return;
    const currentYear = String(new Date().getFullYear());
    footer.textContent = footer.textContent.replace(/©\s*\d{4}(?:-\d{4})?/i, `© 2024-${currentYear}`);
  }

  function createState(container, state, title, description, link) {
    if (!container || container.children.length) return null;
    const node = document.createElement('div');
    node.className = 'tt-home-runtime-state';
    node.dataset.state = state;
    node.setAttribute('role', state === 'error' ? 'alert' : 'status');
    node.setAttribute('aria-live', 'polite');
    node.innerHTML = `<div class="tt-home-runtime-state-inner"><strong>${escapeText(title)}</strong><span>${escapeText(description)}</span>${link ? `<br><a href="${link.href}">${escapeText(link.label)}</a>` : ''}</div>`;
    container.appendChild(node);
    return node;
  }

  function clearRuntimeState(container) {
    container?.querySelectorAll(':scope > .tt-home-runtime-state').forEach(node => node.remove());
    container?.removeAttribute('aria-busy');
  }

  function markDynamicLoading() {
    const products = document.getElementById('products-grid');
    const look = document.getElementById('look-grid');

    if (products && !products.children.length) {
      products.setAttribute('aria-busy', 'true');
      createState(products, 'loading', 'Cargando productos', 'Estamos sincronizando el catálogo en tiempo real.');
    }
    if (look && !look.children.length) {
      look.setAttribute('aria-busy', 'true');
      createState(look, 'loading', 'Preparando combinaciones', 'Estamos eligiendo accesorios disponibles para vos.');
    }
  }

  function resolveProducts() {
    const products = document.getElementById('products-grid');
    if (!products) return;
    const realCards = products.querySelectorAll(':scope > :not(.tt-home-runtime-state)');
    if (realCards.length) {
      productsResolved = true;
      clearRuntimeState(products);
    }
  }

  function resolveLook() {
    const look = document.getElementById('look-grid');
    if (!look) return;
    const realCards = look.querySelectorAll(':scope > :not(.tt-home-runtime-state)');
    if (realCards.length) {
      lookResolved = true;
      clearRuntimeState(look);
      const actions = document.getElementById('look-actions');
      if (actions) actions.style.display = '';
    }
  }

  function showProductsFallback() {
    if (productsResolved) return;
    const products = document.getElementById('products-grid');
    if (!products) return;
    products.innerHTML = '';
    products.removeAttribute('aria-busy');
    createState(
      products,
      navigator.onLine === false ? 'offline' : 'error',
      navigator.onLine === false ? 'Estás sin conexión' : 'El catálogo está tardando más de lo esperado',
      navigator.onLine === false
        ? 'Cuando vuelva internet, esta sección se actualizará automáticamente.'
        : 'Podés abrir el catálogo completo mientras reintentamos la sincronización.',
      { href: 'catalogo.html', label: 'Ver catálogo' },
    );
  }

  function showLookFallback() {
    if (lookResolved) return;
    const look = document.getElementById('look-grid');
    if (!look) return;
    look.innerHTML = '';
    look.removeAttribute('aria-busy');
    createState(
      look,
      'empty',
      'Combinaciones temporalmente no disponibles',
      'La página sigue funcionando y podés explorar todos los productos desde el catálogo.',
      { href: 'catalogo.html', label: 'Explorar accesorios' },
    );
  }

  function observeDynamicContainers() {
    const products = document.getElementById('products-grid');
    const look = document.getElementById('look-grid');
    const observer = new MutationObserver(() => {
      resolveProducts();
      resolveLook();
    });
    if (products) observer.observe(products, { childList: true });
    if (look) observer.observe(look, { childList: true });
  }

  function ensureImageGeometry() {
    document.querySelectorAll([
      '.tt-editorial-img img',
      '.tt-watch-feature-img img',
      '.tt-coll-card-img img',
      '.tt-product-img img',
      '.tt-look-card-img img',
    ].join(',')).forEach(img => {
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.getAttribute('loading') && img.id !== 'tt-hero-img') img.setAttribute('loading', 'lazy');
    });
  }

  function recoverSurface() {
    if (!body) return;
    body.hidden = false;
    body.inert = false;
    body.removeAttribute('aria-hidden');
    document.querySelectorAll('#hero,.tt-trust-bar,.tt-collections-section,.tt-look-section,.tt-products-section,.tt-reviews-section,.tt-footer')
      .forEach(node => {
        node.hidden = false;
        node.inert = false;
        node.removeAttribute('aria-hidden');
        if (node.style.visibility === 'hidden') node.style.visibility = '';
        if (node.style.opacity === '0') node.style.opacity = '';
      });
  }

  function markReady() {
    recoverSurface();
    body?.classList.add('tt-home-runtime-ready');
    window.ttPageReady?.();
  }

  function retryDynamicContent() {
    if (navigator.onLine === false) return;
    window.dispatchEvent(new CustomEvent('tintin:home-refresh-requested'));
    window.dispatchEvent(new CustomEvent('tintin:products-refresh-requested'));
    resolveProducts();
    resolveLook();
  }

  function boot() {
    normalizePublicMetadata();
    updateThemeColor();
    updateFooterYear();
    ensureImageGeometry();
    markDynamicLoading();
    observeDynamicContainers();
    resolveProducts();
    resolveLook();
    recoverSurface();

    requestAnimationFrame(() => requestAnimationFrame(markReady));
    window.setTimeout(showProductsFallback, PRODUCTS_TIMEOUT_MS);
    window.setTimeout(showLookFallback, LOOK_TIMEOUT_MS);

    ['tintin:products-loaded', 'tt_cart_updated', 'tintin:content-updated', 'tintin:images-updated']
      .forEach(name => window.addEventListener(name, () => {
        resolveProducts();
        resolveLook();
        ensureImageGeometry();
        recoverSurface();
      }));

    window.addEventListener('online', retryDynamicContent);
    window.addEventListener('offline', () => {
      if (!productsResolved) showProductsFallback();
    });
    window.addEventListener('pageshow', () => {
      recoverSurface();
      retryDynamicContent();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) retryDynamicContent();
    });

    const rootObserver = new MutationObserver(() => {
      updateThemeColor();
      recoverSurface();
    });
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });

    window.setTimeout(recoverSurface, 800);
    window.setTimeout(recoverSurface, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
