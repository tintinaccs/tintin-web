/* Tablet menu view transitions; modal ownership stays in SurfaceController. */
(() => {
  const header = document.querySelector('[data-header-device="tablet"]');
  const trigger = header?.querySelector('#btn-menu-tablet');
  const menu = document.getElementById('tt-tablet-menu');
  const shopButton = document.getElementById('btn-tablet-tienda');
  const categories = document.getElementById('tablet-cats');
  const backButton = document.getElementById('btn-tablet-cats-back');
  const controller = window.TintinSurfaceController;
  if (!header || !trigger || !menu || !controller || menu.dataset.ttTabletReady === '1') return;
  menu.dataset.ttTabletReady = '1';

  const setOrigin = () => {
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    menu.style.setProperty('--tt-menu-origin-x', `${x}px`);
    menu.style.setProperty('--tt-menu-origin-y', `${y}px`);
    menu.style.setProperty('--tt-menu-radius', `${Math.ceil(radius)}px`);
  };

  const showCategories = () => {
    menu.classList.add('tt-tablet-shop-view');
    categories?.classList.add('open');
    shopButton?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => backButton?.focus({ preventScroll: true }));
  };
  const showMain = ({ focus = true } = {}) => {
    menu.classList.remove('tt-tablet-shop-view');
    categories?.classList.remove('open');
    shopButton?.setAttribute('aria-expanded', 'false');
    if (focus) shopButton?.focus({ preventScroll: true });
  };

  shopButton?.addEventListener('click', showCategories);
  backButton?.addEventListener('click', () => showMain());
  menu.addEventListener('click', event => {
    if (event.target.closest('a[href]')) controller.close('navigate', { restoreFocus: false });
  });
  addEventListener('tintin:surface-change', event => {
    if (event.detail?.surface === 'tablet-menu' && event.detail?.state === 'opening') setOrigin();
    if (event.detail?.surface === 'none') showMain({ focus: false });
  });
  setOrigin();
})();
