(function () {
  'use strict';

  if (window.TintinImagePerformanceBooted) return;
  window.TintinImagePerformanceBooted = true;

  const processed = new WeakSet();
  const pendingRoots = new Set();
  const pendingImages = new Set();
  let scheduled = false;
  let imageFrame = 0;

  function isPriorityImage(image) {
    if (image.matches('[fetchpriority="high"], [loading="eager"]')) return true;
    if (image.getAttribute('loading') === 'lazy') return false;
    if (image.closest('.tt-header, .tt-hero, .tt-page-hero, .ck-header, .login-brand, .adm-sidebar-logo')) return true;
    const rect = image.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.15 && rect.bottom > -80;
  }

  function tuneImage(image, priority) {
    image.decoding = 'async';
    image.loading = priority ? 'eager' : 'lazy';
    // La prioridad alta pertenece al LCP/branding explícitos. Una lista de
    // miniaturas visibles no debe competir en bloque con la portada.
    if ('fetchPriority' in image && !image.hasAttribute('fetchpriority')) image.fetchPriority = priority ? 'auto' : 'low';
    if (!image.hasAttribute('draggable')) image.draggable = false;
  }

  function imagesInside(root) {
    if (!root) return [];
    const images = [];
    if (root instanceof HTMLImageElement) images.push(root);
    if (typeof root.querySelectorAll === 'function') images.push(...root.querySelectorAll('img'));
    return images;
  }

  function processImages() {
    imageFrame = 0;
    const batch = [];
    for (const image of pendingImages) {
      pendingImages.delete(image);
      if (image.isConnected && !processed.has(image)) batch.push(image);
      if (batch.length === 64) break;
    }
    // Primero medir, después escribir; un único lote por frame evita bloquear
    // escritura/scroll al recibir listas grandes o varios snapshots seguidos.
    const priorities = batch.map(isPriorityImage);
    batch.forEach((image, index) => { processed.add(image); tuneImage(image, priorities[index]); });
    if (pendingImages.size) imageFrame = window.requestAnimationFrame(processImages);
  }

  function flush() {
    scheduled = false;
    const roots = pendingRoots.size ? [...pendingRoots].filter(root => {
      for (let parent = root.parentNode; parent; parent = parent.parentNode) {
        if (pendingRoots.has(parent)) return false;
      }
      return true;
    }) : [document];
    pendingRoots.clear();
    for (const root of roots) for (const image of imagesInside(root)) {
      if (image instanceof HTMLImageElement && image.isConnected && !processed.has(image)) pendingImages.add(image);
    }
    if (pendingImages.size && !imageFrame) imageFrame = window.requestAnimationFrame(processImages);
  }

  function schedule(root = document) {
    pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(flush, { timeout: 180 });
    } else {
      window.setTimeout(flush, 40);
    }
  }

  function boot() {
    schedule(document);
    document.addEventListener('tintin:products-loaded', event => schedule(event.target || document), { passive: true });
    document.addEventListener('tintin:page-ready', () => schedule(document), { passive: true });
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) schedule(node);
        }));
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
