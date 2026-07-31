/* =============================================================
   TINTIN — Canonical público estable para fichas de producto
   ============================================================= */

(function () {
  'use strict';

  const PUBLIC_PRODUCT_URL = 'https://tintinaccesorios.pages.dev/product.html';
  const canonical = document.getElementById('link-canonical');
  const openGraphUrl = document.getElementById('meta-og-url');
  let syncing = false;

  function productIdFromCurrentState() {
    const candidates = [
      canonical?.getAttribute('href'),
      openGraphUrl?.getAttribute('content'),
      window.location.href
    ];

    for (const candidate of candidates) {
      try {
        const id = new URL(candidate || '', window.location.href).searchParams.get('id');
        if (id) return id;
      } catch {}
    }
    return '';
  }

  function publicProductHref() {
    const url = new URL(PUBLIC_PRODUCT_URL);
    const id = productIdFromCurrentState();
    if (id) url.searchParams.set('id', id);
    return url.href;
  }

  function syncPublicMetadata() {
    if (syncing) return;
    syncing = true;
    try {
      const href = publicProductHref();
      if (canonical && canonical.getAttribute('href') !== href) {
        canonical.setAttribute('href', href);
      }
      if (openGraphUrl && openGraphUrl.getAttribute('content') !== href) {
        openGraphUrl.setAttribute('content', href);
      }
    } finally {
      syncing = false;
    }
  }

  syncPublicMetadata();

  const observer = new MutationObserver(syncPublicMetadata);
  if (canonical) observer.observe(canonical, { attributes: true, attributeFilter: ['href'] });
  if (openGraphUrl) observer.observe(openGraphUrl, { attributes: true, attributeFilter: ['content'] });

  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  window.TintinProductSeoCanonical = { sync: syncPublicMetadata };
})();
