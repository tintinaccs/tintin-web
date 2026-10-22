/* Compatibilidad: la prioridad ya no vive en memoria ni depende de la sesión. */
import { sortCatalogProducts } from './politica-exhibicion-catalogo.js?v=tintin-20261022-catalog-reconcile-1';

window.TintinCatalogStockPriority = Object.freeze({
  order: products => sortCatalogProducts(products),
  getRestockedPriorityIds: () => [],
});
