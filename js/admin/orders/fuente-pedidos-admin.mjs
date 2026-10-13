// Páginas de una única fuente administrativa. Cada consulta está limitada;
// cambios de contenido conservan las otras páginas. Si cambia una frontera,
// se vuelven a enlazar las páginas posteriores antes de publicar el conjunto.
export function reconcileAdminOrderSnapshot(incoming, confirmed) {
  const known = new Map(confirmed.map(order => [order.id, order]));
  return incoming.map(order => {
    const previous = known.get(order.id);
    return previous && Number(previous.inventoryRevision || 0) > Number(order.inventoryRevision || 0) ? previous : order;
  });
}
export function createAdminOrderSource({ subscribePage, onData, onLoading, onError, complete = false }) {
  const pages = new Map();
  let active = true;
  let loading = false;
  const beginLoading = () => { if (!loading) { loading = true; onLoading?.(); } };
  function clearAfter(index) {
    for (const [key, page] of pages) if (key > index) { pages.delete(key); page.stop?.(); }
  }
  function publish() {
    const ordered = [...pages.entries()].sort(([a], [b]) => a - b);
    if (!ordered.length || ordered.some(([, page]) => !page.ready) || ordered.at(-1)[1].more) { beginLoading(); return; }
    const unique = new Map();
    for (const [, page] of ordered) for (const order of page.orders) unique.set(order.id, order);
    loading = false;
    onData([...unique.values()]);
  }
  function open(index, cursor = null) {
    const page = { ready: false, orders: [], more: false, key: '', stop: null };
    pages.set(index, page);
    const stop = subscribePage(cursor, snapshot => {
      if (!active || pages.get(index) !== page) return;
      if (snapshot.authoritative === false) { page.ready = false; beginLoading(); return; }
      const more = complete && snapshot.hasMore;
      const boundaryChanged = page.key !== snapshot.cursorKey || page.more !== more;
      page.orders = snapshot.orders;
      page.key = snapshot.cursorKey;
      page.more = more;
      page.ready = true;
      if (boundaryChanged) clearAfter(index);
      if (more && !pages.has(index + 1)) {
        beginLoading();
        open(index + 1, snapshot.cursor);
      }
      publish();
    }, error => {
      if (!active || pages.get(index) !== page) return;
      page.ready = false;
      loading = true;
      onError(error);
    });
    page.stop = stop;
    if (!active || pages.get(index) !== page) stop?.();
  }
  beginLoading();
  open(0);
  return { stop() { active = false; for (const page of pages.values()) page.stop?.(); pages.clear(); } };
}
