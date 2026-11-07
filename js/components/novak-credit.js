/* El símbolo original se descarga al acercarse al pie, sin anticipación nativa. */
(() => {
  'use strict';
  // Un solo dueño del año en todos los documentos. Conserva el texto global
  // editable y actualiza únicamente el intervalo que empieza en 2024.
  const updateFooterYear = () => {
    const copyright = document.querySelector('#tt-footer-ending .tt-footer-bottom');
    if (!copyright) return;
    const previous = copyright.textContent;
    const next = previous.replace(/^©\s*2024-\d{4}(?=\s)/u, `© 2024-${new Date().getUTCFullYear()}`);
    if (next !== previous) copyright.textContent = next;
  };
  updateFooterYear();
  ['pageshow', 'tintin:content-phase6-ready', 'tintin:visual-builder-ready']
    .forEach(name => window.addEventListener(name, updateFooterYear));

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
