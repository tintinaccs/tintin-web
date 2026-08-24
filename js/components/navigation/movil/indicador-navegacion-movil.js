/* Mobile-only moving halo calculated from real item geometry. */
(() => {
  const nav = document.getElementById('tt-tabbar');
  if (!nav || nav.dataset.ttMobileReady === '1') return;
  nav.dataset.ttMobileReady = '1';

  const items = [...nav.querySelectorAll('.tt-tabbar-btn')];
  const visible = item => Boolean(
    item && !item.hidden && item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden'
  );
  const locate = item => {
    if (!visible(item)) {
      nav.classList.remove('tt-mobile-nav-ready');
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const width = Math.min(58, Math.max(48, itemRect.width - 8));
    nav.style.setProperty('--tt-mobile-w', `${width}px`);
    nav.style.setProperty('--tt-mobile-x', `${itemRect.left - navRect.left + (itemRect.width - width) / 2}px`);
    nav.classList.add('tt-mobile-nav-ready');
  };

  const current = () =>
    items.find(item => visible(item) && item.getAttribute('aria-expanded') === 'true') ||
    items.find(item => visible(item) && item.classList.contains('active')) ||
    null;
  const sync = () => locate(current());
  const observer = new MutationObserver(sync);
  items.forEach(item => observer.observe(item, {
    attributes: true,
    attributeFilter: ['class', 'aria-expanded', 'aria-current', 'hidden'],
  }));

  const resizeObserver = new ResizeObserver(sync);
  resizeObserver.observe(nav);
  addEventListener('orientationchange', sync, { passive: true });
  addEventListener('tintin:global-layout-ready', sync);
  addEventListener('tintin:auth-session-resolved', sync);
  addEventListener('tintin:auth-nav-updated', sync);
  requestAnimationFrame(sync);
})();
