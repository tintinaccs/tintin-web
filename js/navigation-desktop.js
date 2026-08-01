/* Desktop-only elastic active navigation. */
(() => {
  const header = document.querySelector('[data-header-device="desktop"]');
  const nav = header?.querySelector('.tt-nav-desktop');
  const pill = nav?.querySelector('.tt-desktop-active-pill');
  if (!nav || !pill || nav.dataset.ttDesktopReady === '1') return;
  nav.dataset.ttDesktopReady = '1';

  const items = [...nav.querySelectorAll('[data-desktop-nav-item]')];
  const activeItem = () => items.find(item => item.classList.contains('active') || item.getAttribute('aria-current') === 'page') || items[0];
  const move = item => {
    if (!item) return;
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
