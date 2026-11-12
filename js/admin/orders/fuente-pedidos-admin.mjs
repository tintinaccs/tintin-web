import { createProgressiveAdminPagedSource } from '../datos/fuente-paginada-progresiva.mjs?v=tintin-20261107-pedidos-progresivo-1';
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
export function createAdminOrderSource(options) {
  return createProgressiveAdminPagedSource({
    ...options,
    subscribePage(cursor, next, fail) {
      return options.subscribePage(cursor, snapshot => next({ ...snapshot, records: snapshot.orders }), fail);
    },
  });
}
