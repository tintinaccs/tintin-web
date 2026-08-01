/* Mobile-only moving halo calculated from real item geometry. */
(() => {
  const nav = document.getElementById('tt-tabbar');
  if (!nav || nav.dataset.ttMobileReady === '1') return;
  nav.dataset.ttMobileReady = '1';

  const items = [...nav.querySelectorAll('.tt-tabbar-btn')];
  const locate = item => {
    if (!item) return;
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const width = Math.min(58, Math.max(48, itemRect.width - 8));
    nav.style.setProperty('--tt-mobile-w', `${width}px`);
    nav.style.setProperty('--tt-mobile-x', `${itemRect.left - navRect.left + (itemRect.width - width) / 2}px`);
    nav.classList.add('tt-mobile-nav-ready');
  };
  const current = () => items.find(item => item.classList.contains('active')) || items[0];
  const sync = () => locate(current());
  const observer = new MutationObserver(sync);
  items.forEach(item => observer.observe(item, { attributes:true, attributeFilter:['class','aria-expanded','aria-current'] }));
  new ResizeObserver(sync).observe(nav);
  addEventListener('orientationchange', sync, { passive:true });
  requestAnimationFrame(sync);
})();
