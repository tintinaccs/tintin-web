/* Mobile-only moving halo calculated from real item geometry. */
export function initMobileNavigationIndicator() {
  const nav = document.getElementById('tt-tabbar');
  if (!nav) return;
  if (nav.dataset.ttMobileReady === '1') {
    const active = [...nav.querySelectorAll('.tt-tabbar-btn')]
      .find(item => !item.hidden && (
        item.getAttribute('aria-current') === 'page' ||
        item.getAttribute('aria-expanded') === 'true' ||
        item.classList.contains('active')
      ));
    if (active) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      const width = Math.min(58, Math.max(48, itemRect.width - 8));
      nav.style.setProperty('--tt-mobile-w', `${width}px`);
      nav.style.setProperty('--tt-mobile-x', `${itemRect.left - navRect.left + (itemRect.width - width) / 2}px`);
      nav.classList.add('tt-mobile-nav-ready');
    }
    return;
  }
  nav.dataset.ttMobileReady = '1';

  const items = [...nav.querySelectorAll('.tt-tabbar-btn')];
  const locate = item => {
    if (!item) {
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
    items.find(item => !item.hidden && item.getAttribute('aria-current') === 'page') ||
    items.find(item => !item.hidden && item.getAttribute('aria-expanded') === 'true') ||
    items.find(item => !item.hidden && item.classList.contains('active')) ||
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
  requestAnimationFrame(sync);
}

initMobileNavigationIndicator();
