let loading = null;

function currentPath() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

function needsImmediateCollections() {
  const path = currentPath();
  return path === '' || path === '/' || /\/(?:index|catalogo|collections)(?:\.html)?$/.test(path);
}

export function ensureNavigationCollections() {
  if (!loading) {
    loading = import('./nav-collections.js?v=tintin-20260720-read-budget-1');
  }
  return loading;
}

function attachLazyTriggers() {
  const ids = ['btn-tienda', 'btn-mobile-tienda', 'tabbar-tienda', 'btn-menu'];
  ids.forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener('pointerenter', ensureNavigationCollections, { once: true, passive: true });
    node.addEventListener('focus', ensureNavigationCollections, { once: true });
    node.addEventListener('click', ensureNavigationCollections, { once: true });
  });
}

if (needsImmediateCollections()) ensureNavigationCollections();
else attachLazyTriggers();

window.TintinNavigationCollections = { ensure: ensureNavigationCollections };
