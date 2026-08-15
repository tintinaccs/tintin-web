/* TINTIN — guard inmutable v1 para canonical limpio de /about.
   Archivo versionado por nombre: si cambia su contenido, crear v2. */
(() => {
  'use strict';

  const expectedUrl = () => new URL('/about', window.location.origin).href;

  function normalizeAboutMetadata() {
    const expected = expectedUrl();
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.getAttribute('href') !== expected) {
      canonical.setAttribute('href', expected);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && ogUrl.getAttribute('content') !== expected) {
      ogUrl.setAttribute('content', expected);
    }
  }

  function start() {
    normalizeAboutMetadata();
    if (!document.head || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(normalizeAboutMetadata);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href', 'content']
    });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  window.addEventListener('pageshow', normalizeAboutMetadata);
})();
