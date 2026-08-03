/* Desktop-only elastic active navigation. */
(() => {
  const header = document.querySelector('[data-header-device="desktop"]');
  const nav = header?.querySelector('.tt-nav-desktop');
  const pill = nav?.querySelector('.tt-desktop-active-pill');
  if (!nav || !pill || nav.dataset.ttDesktopReady === '1') return;
  nav.dataset.ttDesktopReady = '1';

  const items = [...nav.querySelectorAll('[data-desktop-nav-item]')];
  // Sin fallback a items[0]: en paginas auxiliares (envios, cambios, FAQ,
  // terminos, privacidad, 404) ningun item es la ruta activa, y la pildora
  // no debe aparecer marcando "Inicio" como si lo fuera.
  const activeItem = () => items.find(item => item.classList.contains('active') || item.getAttribute('aria-current') === 'page') || null;
  const move = item => {
    if (!item) {
      pill.classList.remove('is-ready');
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    pill.style.setProperty('--tt-pill-x', `${itemRect.left - navRect.left}px`);
    pill.style.width = `${itemRect.width}px`;
    pill.classList.add('is-ready');
  };
  const restore = () => move(activeItem());

  items.forEach(item => {
    item.addEventListener('pointerenter', () => move(item));
    item.addEventListener('focus', () => move(item));
  });
  nav.addEventListener('pointerleave', restore);
  nav.addEventListener('focusout', event => {
    if (!nav.contains(event.relatedTarget)) restore();
  });
  new ResizeObserver(restore).observe(nav);
  requestAnimationFrame(restore);
})();
