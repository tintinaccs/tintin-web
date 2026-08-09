/* Barra inferior adaptable inspirada en el patrón de navegación de Instagram.
   Se compacta al avanzar por el contenido y vuelve a expandirse al subir. */
(() => {
  const nav = document.getElementById('tt-tabbar');
  if (!nav || nav.dataset.ttCompactScrollReady === '1') return;
  nav.dataset.ttCompactScrollReady = '1';

  const mobile = matchMedia('(max-width: 767px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const OPEN_SURFACE = '.tt-search-panel.open,.tt-cart-drawer.open,.tt-account-drawer.open,.tt-collections-sheet.open';
  const TOP_THRESHOLD = 36;
  const DIRECTION_THRESHOLD = 10;
  let lastY = Math.max(0, scrollY || 0);
  let frame = 0;

  const surfaceIsOpen = () => Boolean(document.querySelector(OPEN_SURFACE));

  function setCompact(compact) {
    const next = Boolean(compact && mobile.matches && !surfaceIsOpen());
    if (nav.classList.toggle('tt-tabbar-compact', next)) {
      nav.dataset.ttCompact = next ? 'true' : 'false';
      nav.dispatchEvent(new CustomEvent('tintin:mobile-nav-size-change', {
        detail: { compact: next },
      }));
    }
  }

  function update() {
    frame = 0;
    const y = Math.max(0, scrollY || document.documentElement.scrollTop || 0);
    const delta = y - lastY;

    if (!mobile.matches || y <= TOP_THRESHOLD || surfaceIsOpen()) {
      setCompact(false);
    } else if (delta > DIRECTION_THRESHOLD) {
      setCompact(true);
    } else if (delta < -DIRECTION_THRESHOLD) {
      setCompact(false);
    }

    if (Math.abs(delta) >= DIRECTION_THRESHOLD || y <= TOP_THRESHOLD) lastY = y;
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(update);
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('orientationchange', schedule, { passive: true });
  mobile.addEventListener?.('change', () => {
    lastY = Math.max(0, scrollY || 0);
    setCompact(false);
  });
  addEventListener('tintin:surface-change', event => {
    if (event.detail?.surface !== 'none') setCompact(false);
    else schedule();
  });

  if (reducedMotion.matches) nav.dataset.ttReducedMotion = 'true';
  nav.dataset.ttCompact = 'false';
  requestAnimationFrame(update);
})();
