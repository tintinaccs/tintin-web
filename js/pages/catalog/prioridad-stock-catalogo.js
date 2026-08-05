/* Compatibilidad: la prioridad ya no vive en memoria ni depende de la sesión. */
import { sortCatalogProducts } from './politica-exhibicion-catalogo.js?v=tintin-20260731-unified-store-1';

window.TintinCatalogStockPriority = Object.freeze({
  order: products => sortCatalogProducts(products),
  getRestockedPriorityIds: () => [],
});
