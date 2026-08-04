(function () {
  'use strict';

  if (window.TintinImagePerformanceBooted) return;
  window.TintinImagePerformanceBooted = true;

  const processed = new WeakSet();
  const pendingRoots = new Set();
  let scheduled = false;

  function isPriorityImage(image) {
    if (image.matches('[fetchpriority="high"], [loading="eager"]')) return true;
    if (image.closest('.tt-header, .tt-hero, .tt-page-hero, .ck-header, .login-brand, .adm-sidebar-logo')) return true;
    const rect = image.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.15 && rect.bottom > -80;
  }

  function tuneImage(image) {
    if (!(image instanceof HTMLImageElement) || processed.has(image)) return;
    processed.add(image);
    const priority = isPriorityImage(image);
    image.decoding = 'async';
    image.loading = priority ? 'eager' : 'lazy';
    if ('fetchPriority' in image) image.fetchPriority = priority ? 'high' : 'low';
    if (!image.hasAttribute('draggable')) image.draggable = false;
  }

  function imagesInside(root) {
    if (!root) return [];
    const images = [];
    if (root instanceof HTMLImageElement) images.push(root);
    if (typeof root.querySelectorAll === 'function') images.push(...root.querySelectorAll('img'));
    return images;
  }

  function flush() {
    scheduled = false;
    const roots = pendingRoots.size ? [...pendingRoots] : [document];
    pendingRoots.clear();
    const images = roots.flatMap(imagesInside);
    window.requestAnimationFrame(() => images.forEach(tuneImage));
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
