/* El símbolo original se descarga al acercarse al pie, sin anticipación nativa. */
(() => {
  'use strict';
  const images = document.querySelectorAll('img[data-novak-src]:not([src])');
  const load = image => {
    image.addEventListener('load', () => image.removeAttribute('data-novak-src'), { once: true });
    image.src = image.dataset.novakSrc;
  };
  if (!('IntersectionObserver' in window)) {
    images.forEach(load);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      load(entry.target);
    }
  }, { rootMargin: '128px' });
  images.forEach(image => observer.observe(image));
})();
