/* TINTIN — prioridad dinámica de stock del catálogo público */
const CATALOG_PATH_RE = /(?:^|\/)catalogo(?:\.html)?\/?$/i;

if (CATALOG_PATH_RE.test(location.pathname || '') && !window.TintinCatalogStockPriorityBooted) {
  window.TintinCatalogStockPriorityBooted = true;

  let hasStockBaseline = false;
  let previousStockById = new Map();
  let restockedPriorityIds = [];

  function isInStock(product) {
    return !(product?.stock != null && Number(product.stock) <= 0);
  }

  function trackStockTransitions(products) {
    const list = Array.isArray(products) ? products : [];
    const nextStockById = new Map();
    const liveIds = new Set();
    const restockedNow = [];

    list.forEach(product => {
      const id = String(product?.id ?? '');
      if (!id) return;
      const inStock = isInStock(product);
      liveIds.add(id);
      nextStockById.set(id, inStock);

      if (hasStockBaseline && previousStockById.get(id) === false && inStock) {
        restockedNow.push(id);
      }
    });

    const promoted = new Set(restockedNow);
    restockedPriorityIds = [
      ...restockedNow,
      ...restockedPriorityIds.filter(id =>
        !promoted.has(id) && liveIds.has(id) && nextStockById.get(id) === true
      ),
    ];

    previousStockById = nextStockById;
    hasStockBaseline = true;
  }

  function orderByStockPriority(products) {
    const list = Array.isArray(products) ? [...products] : [];
    const priorityById = new Map(restockedPriorityIds.map((id, index) => [id, index]));
    const available = list.filter(isInStock);
    const exhausted = list.filter(product => !isInStock(product));

    // Array#sort es estable en los navegadores soportados. Los productos que
    // no fueron repuestos conservan el orden elegido por el catálogo; cada
    // reposición nueva pasa al frente, seguida por las reposiciones anteriores.
    available.sort((a, b) => {
      const aPriority = priorityById.get(String(a?.id ?? ''));
      const bPriority = priorityById.get(String(b?.id ?? ''));
      if (aPriority == null && bPriority == null) return 0;
      if (aPriority == null) return 1;
      if (bPriority == null) return -1;
      return aPriority - bPriority;
    });

    return [...available, ...exhausted];
  }

  function installRenderGuard() {
    const originalRenderGrid = window.renderGrid;
    if (typeof originalRenderGrid !== 'function') return false;
    if (originalRenderGrid.__ttStockPriorityGuard) return true;

    function renderGridWithStockPriority(products) {
      return originalRenderGrid(orderByStockPriority(products));
    }

    renderGridWithStockPriority.__ttStockPriorityGuard = true;
    renderGridWithStockPriority.__ttOriginalRenderGrid = originalRenderGrid;
    window.renderGrid = renderGridWithStockPriority;
    return true;
  }

  // Este listener usa captura para registrar la transición antes del listener
  // normal de catalogo.html, que inmediatamente vuelve a renderizar la grilla.
  window.addEventListener('tintin:products-loaded', event => {
    trackStockTransitions(event.detail?.products);
    installRenderGuard();
  }, true);

  if (!installRenderGuard()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (installRenderGuard() || attempts >= 100) window.clearInterval(timer);
    }, 25);
  }

  window.TintinCatalogStockPriority = {
    order: orderByStockPriority,
    getRestockedPriorityIds: () => [...restockedPriorityIds],
  };
}
