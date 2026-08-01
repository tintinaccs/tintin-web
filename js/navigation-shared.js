/* Shared routing behavior only; no device markup, geometry or breakpoint logic. */
(() => {
  if (window.TintinNavigationSharedBooted) return;
  window.TintinNavigationSharedBooted = true;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let leaving = false;

  addEventListener('pageshow', () => {
    leaving = false;
    document.body?.classList.remove('tt-page-leaving');
  });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== '_self' || link.hasAttribute('download') || link.dataset.noTransition != null) return;
    let target;
    try { target = new URL(link.href,location.href); } catch { return; }
    if (target.origin !== location.origin || target.protocol === 'mailto:' || target.protocol === 'tel:') return;
    if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
    if (reduced.matches) return;
    event.preventDefault();
    leaving = true;
    document.body.classList.add('tt-page-leaving');
    setTimeout(() => location.assign(target.href),130);
  });
})();
