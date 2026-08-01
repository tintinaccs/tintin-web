/* Tablet-only circular menu and keyboard focus management. */
(() => {
  const header = document.querySelector('[data-header-device="tablet"]');
  const trigger = header?.querySelector('#btn-menu-tablet');
  const menu = document.getElementById('tt-tablet-menu');
  const closeButton = document.getElementById('btn-tablet-close');
  const shopButton = document.getElementById('btn-tablet-tienda');
  const categories = document.getElementById('tablet-cats');
  if (!header || !trigger || !menu || menu.dataset.ttTabletReady === '1') return;
  menu.dataset.ttTabletReady = '1';
  let previousOverflow = '';

  const setOrigin = () => {
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    menu.style.setProperty('--tt-menu-origin-x', `${x}px`);
    menu.style.setProperty('--tt-menu-origin-y', `${y}px`);
    menu.style.setProperty('--tt-menu-radius', `${Math.ceil(radius)}px`);
  };
  const focusables = () => [...menu.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.offsetParent !== null);
  const open = () => {
    setOrigin();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
  };
  const close = ({ restoreFocus = true } = {}) => {
    if (!menu.classList.contains('open')) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', () => menu.classList.contains('open') ? close() : open());
  closeButton?.addEventListener('click', () => close());
  shopButton?.addEventListener('click', () => {
    const next = !categories?.classList.contains('open');
    categories?.classList.toggle('open', next);
    shopButton.setAttribute('aria-expanded', String(next));
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a[href]')) close({ restoreFocus: false });
  });
  document.addEventListener('keydown', event => {
    if (!menu.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  addEventListener('resize', () => { setOrigin(); if (!matchMedia('(min-width:768px) and (max-width:1023px)').matches) close({ restoreFocus:false }); }, { passive:true });
  setOrigin();
})();
