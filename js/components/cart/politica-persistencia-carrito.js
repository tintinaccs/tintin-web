export const GUEST_CART_TTL_MS = 30 * 60 * 1000;

export function guestCartIsExpired(updatedAt, now = Date.now()) {
  const timestamp = Number(updatedAt);
  const current = Number(now);
  return Number.isFinite(timestamp) && timestamp > 0 &&
    Number.isFinite(current) && current - timestamp >= GUEST_CART_TTL_MS;
}

// La portada y la ficha individual publican subconjuntos del catálogo para
// cargar rápido. Solo catálogo/colecciones poseen una lista completa capaz de
// decidir que un artículo guardado realmente dejó de existir.
export function pageHasCompleteCatalog(pathname) {
  const path = String(pathname || '').toLowerCase();
  return /(^|\/)(catalogo|collections)(?:\.html)?$/.test(path);
}
