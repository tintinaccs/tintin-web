// Controlador del carrusel de "Nuestras colecciones" en el Inicio.
//
// El grid (#tt-collections-grid) es propiedad de presentacion-colecciones.js:
// ese script reemplaza sus hijos cada vez que cambian los datos de Firestore
// (MutationObserver sobre childList). Por eso este controlador NUNCA toca los
// hijos del grid ni los envuelve — solo hace scroll nativo sobre el propio
// grid (que ya es un contenedor flex con scroll-snap) y observa sus hijos de
// forma independiente para mantener sincronizados los puntos/flechas.
(function () {
  if (window.TintinCollectionsCarouselBooted) return;
  window.TintinCollectionsCarouselBooted = true;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupCarousel(wrapper) {
    const grid = wrapper.querySelector('#tt-collections-grid') || wrapper.querySelector('.tt-collections-grid');
    const prevBtn = wrapper.querySelector('[data-coll-carousel-prev]');
    const nextBtn = wrapper.querySelector('[data-coll-carousel-next]');
    const dotsBox = wrapper.querySelector('[data-coll-carousel-dots]');
    if (!grid || !prevBtn || !nextBtn || !dotsBox) return;

    let pageCount = 1;
    let activePage = 0;
    let raf = 0;

    function pageWidth() {
      return grid.clientWidth || 1;
    }

    function computePages() {
      const width = pageWidth();
      return Math.max(1, Math.ceil((grid.scrollWidth - 1) / width));
    }

    function renderDots(count) {
      dotsBox.replaceChildren();
      if (count <= 1) return;
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'tt-coll-carousel-dot';
        dot.setAttribute('aria-label', 'Ir a la página ' + (i + 1) + ' de colecciones');
        dot.addEventListener('click', () => goToPage(i));
        dotsBox.appendChild(dot);
      }
    }

    function syncActiveDot() {
      const dots = dotsBox.children;
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('is-active', i === activePage);
        dots[i].setAttribute('aria-current', i === activePage ? 'true' : 'false');
      }
    }

    function updateArrowState() {
      const scrollable = grid.scrollWidth > grid.clientWidth + 1;
      wrapper.classList.toggle('tt-coll-carousel--scrollable', scrollable);
      const maxScroll = grid.scrollWidth - grid.clientWidth;
      prevBtn.disabled = !scrollable || grid.scrollLeft <= 1;
      nextBtn.disabled = !scrollable || grid.scrollLeft >= maxScroll - 1;
    }

    function refreshLayout() {
      pageCount = computePages();
      if (pageCount !== dotsBox.children.length) renderDots(pageCount);
      activePage = Math.min(activePage, pageCount - 1);
      syncActiveDot();
      updateArrowState();
    }

    function goToPage(index) {
      const clamped = Math.max(0, Math.min(index, pageCount - 1));
      grid.scrollTo({ left: clamped * pageWidth(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        activePage = Math.round(grid.scrollLeft / pageWidth());
        syncActiveDot();
        updateArrowState();
      });
    }

    prevBtn.addEventListener('click', () => goToPage(activePage - 1));
    nextBtn.addEventListener('click', () => goToPage(activePage + 1));
    grid.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refreshLayout);

    const gridObserver = new MutationObserver(() => window.setTimeout(refreshLayout, 0));
    gridObserver.observe(grid, { childList: true });

    refreshLayout();
  }

  function init() {
    document.querySelectorAll('.tt-coll-carousel').forEach(setupCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
