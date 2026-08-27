/* Desktop-only elastic active navigation. */
export function initDesktopNavigationIndicator() {
  const header = document.querySelector('[data-header-device="desktop"]');
  const nav = header?.querySelector('.tt-nav-desktop');
  const pill = nav?.querySelector('.tt-desktop-active-pill');
  if (!nav || !pill) return;
  if (nav.dataset.ttDesktopReady === '1') {
    // The module is cached across SPA-like viewport/page reloads in the audit
    // context. Re-measure the current DOM instead of skipping initialization.
    const active = [...nav.querySelectorAll('[data-desktop-nav-item]')]
      .find(item => item.classList.contains('active') || item.getAttribute('aria-current') === 'page');
    if (active) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      pill.style.setProperty('--tt-pill-x', `${itemRect.left - navRect.left}px`);
      pill.style.width = `${itemRect.width}px`;
      pill.classList.add('is-ready');
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const current = [...nav.querySelectorAll('[data-desktop-nav-item]')]
        .find(item => item.classList.contains('active') || item.getAttribute('aria-current') === 'page');
      if (!current) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = current.getBoundingClientRect();
      pill.style.setProperty('--tt-pill-x', `${itemRect.left - navRect.left}px`);
      pill.style.width = `${itemRect.width}px`;
      pill.classList.add('is-ready');
    }));
    // Fonts and responsive styles can settle after the shell remount. A
    // delayed final measurement covers that transition without polling.
    setTimeout(() => {
      const current = [...nav.querySelectorAll('[data-desktop-nav-item]')]
        .find(item => item.classList.contains('active') || item.getAttribute('aria-current') === 'page');
      if (!current) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = current.getBoundingClientRect();
      pill.style.setProperty('--tt-pill-x', `${itemRect.left - navRect.left}px`);
      pill.style.width = `${itemRect.width}px`;
      pill.classList.add('is-ready');
    }, 180);
    return;
  }
  nav.dataset.ttDesktopReady = '1';

  const items = [...nav.querySelectorAll('[data-desktop-nav-item]')];
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

  const observer = new ResizeObserver(restore);
  observer.observe(nav);
  const stateObserver = new MutationObserver(restore);
  items.forEach(item => stateObserver.observe(item, { attributes: true, attributeFilter: ['class', 'aria-current', 'hidden'] }));
  requestAnimationFrame(restore);
}

initDesktopNavigationIndicator();
