/* Mobile-only moving halo calculated from real item geometry. */
export function initMobileNavigationIndicator() {
  const nav = document.getElementById('tt-tabbar');
  if (!nav) return;
  const locate = item => {
    const halo = nav.querySelector('.tt-mobile-nav-halo');
    const icon = item?.querySelector('svg,.tt-tabbar-avatar');
    if (!item || !halo || !icon || !icon.getClientRects().length) {
      if (nav.classList.contains('tt-mobile-nav-ready')) nav.classList.remove('tt-mobile-nav-ready');
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const iconRect = item.getBoundingClientRect();
    // Finish geometry reads before any style write can invalidate layout.
    const values = {
      '--tt-mobile-w': `${iconRect.width}px`,
      '--tt-mobile-h': `${iconRect.height}px`,
      '--tt-mobile-x': `${iconRect.left + iconRect.width / 2 - navRect.left - nav.clientLeft - halo.offsetWidth / 2}px`,
      '--tt-mobile-y': `${iconRect.top + iconRect.height / 2 - navRect.top - nav.clientTop - halo.offsetHeight / 2}px`,
    };
    for (const [property, value] of Object.entries(values)) {
      if (nav.style.getPropertyValue(property) !== value) nav.style.setProperty(property, value);
    }
    if (!nav.classList.contains('tt-mobile-nav-ready')) nav.classList.add('tt-mobile-nav-ready');
  };
  if (nav.dataset.ttMobileReady === '1') {
    const active = [...nav.querySelectorAll('.tt-tabbar-btn')]
      .find(item => !item.hidden && (
        item.getAttribute('aria-expanded') === 'true' ||
        item.getAttribute('aria-current') === 'page' ||
        item.classList.contains('active')
      ));
    locate(active);
    return;
  }
  nav.dataset.ttMobileReady = '1';

  const items = [...nav.querySelectorAll('.tt-tabbar-btn')];

  const current = () =>
    items.find(item => !item.hidden && item.getAttribute('aria-expanded') === 'true') ||
    items.find(item => !item.hidden && item.getAttribute('aria-current') === 'page') ||
    items.find(item => !item.hidden && item.classList.contains('active')) ||
    null;
  let frame = 0;
  const sync = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; locate(current()); });
  };
  const observer = new MutationObserver(sync);
  items.forEach(item => observer.observe(item, {
    attributes: true,
    attributeFilter: ['class', 'aria-expanded', 'aria-current', 'hidden'],
  }));

  const resizeObserver = new ResizeObserver(sync);
  resizeObserver.observe(nav);
  observer.observe(nav, { attributes: true, attributeFilter: ['class'] });
  addEventListener('orientationchange', sync, { passive: true });
  sync();
}

initMobileNavigationIndicator();
