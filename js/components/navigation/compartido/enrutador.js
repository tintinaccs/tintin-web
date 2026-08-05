/* Shared routing behavior only; progressive transitions never own routing. */
(() => {
  if (window.TintinNavigationSharedBooted) return;
  window.TintinNavigationSharedBooted = true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let leaving = false;

  const navigateSafely = navigate => {
    if (!reduced.matches && typeof document.startViewTransition === 'function') {
      try {
        const transition = document.startViewTransition(() => navigate());
        transition.ready?.catch(() => {});
        transition.finished?.catch(() => {});
        transition.updateCallbackDone?.catch(() => {});
        return;
      } catch {}
    }
    navigate();
  };

  window.TintinNavigateSafely = navigateSafely;
  addEventListener('pageshow', () => { leaving = false; });

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download') || link.dataset.noTransition != null) return;

    let target;
    try {
      target = new URL(link.href, location.href);
    } catch {
      return;
    }

    if (target.origin !== location.origin || target.protocol === 'mailto:' || target.protocol === 'tel:') return;
    if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
    if (reduced.matches) return;

    event.preventDefault();
    leaving = true;
    navigateSafely(() => location.assign(target.href));
  });
})();
