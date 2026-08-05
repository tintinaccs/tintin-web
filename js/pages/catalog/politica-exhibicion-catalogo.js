/* =============================================================
   TINTIN — política única de merchandising del catálogo

   Contrato público:
   1. Los productos disponibles siempre aparecen antes que los agotados.
   2. Dentro de cada grupo, la actividad más reciente aparece primero.
   3. Crear, editar o reponer stock actualiza la actividad del producto.
   4. Un producto se considera "Nuevo" durante cinco días desde su creación.
   5. Los desempates son estables: orden manual de colección, nombre e ID.
   ============================================================= */

export const NEW_PRODUCT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

const nameSorter = new Intl.Collator('es', {
  sensitivity: 'base',
  numeric: true,
});

export function timestampToMillis(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value?.toMillis === 'function') {
    try { return Number(value.toMillis()) || 0; } catch { return 0; }
  }
  if (typeof value?.toDate === 'function') {
    try { return Number(value.toDate()?.getTime()) || 0; } catch { return 0; }
  }
  const seconds = Number(value?.seconds ?? value?._seconds);
  const nanoseconds = Number(value?.nanoseconds ?? value?._nanoseconds ?? 0);
  if (Number.isFinite(seconds)) return seconds * 1000 + Math.floor((Number.isFinite(nanoseconds) ? nanoseconds : 0) / 1e6);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function productCreatedAtMillis(product) {
  return timestampToMillis(
    product?.createdAt ??
    product?.created_at ??
    product?.importedAt ??
    product?.imported_at
  );
}

export function productActivityAtMillis(product) {
  return Math.max(
    timestampToMillis(product?.catalogActivityAt),
    timestampToMillis(product?.restockedAt),
    timestampToMillis(product?.updatedAt),
    timestampToMillis(product?.modifiedAt),
    productCreatedAtMillis(product),
  );
}

export function isProductInStock(product) {
  return !(product?.stock != null && Number(product.stock) <= 0);
}

export function isNewProduct(product, now = Date.now()) {
  const createdAt = productCreatedAtMillis(product);
  if (!createdAt) return false;
  const age = Number(now) - createdAt;
  return age >= 0 && age <= NEW_PRODUCT_WINDOW_MS;
}

function manualOrder(product) {
  const value = Number(product?.collectionOrder);
  return Number.isFinite(value) ? value : 9999;
}

function compareStable(a, b) {
  const orderDifference = manualOrder(a) - manualOrder(b);
  if (orderDifference) return orderDifference;
  const nameDifference = nameSorter.compare(String(a?.name || ''), String(b?.name || ''));
  if (nameDifference) return nameDifference;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function compareActivity(a, b) {
  const activityDifference = productActivityAtMillis(b) - productActivityAtMillis(a);
  return activityDifference || compareStable(a, b);
}

function compareByMode(mode) {
  if (mode === 'precio-asc') {
    return (a, b) => Number(a?.price || 0) - Number(b?.price || 0) || compareActivity(a, b);
  }
  if (mode === 'precio-desc') {
    return (a, b) => Number(b?.price || 0) - Number(a?.price || 0) || compareActivity(a, b);
  }
  if (mode === 'nombre') {
    return (a, b) => nameSorter.compare(String(a?.name || ''), String(b?.name || '')) || compareActivity(a, b);
  }
  if (mode === 'stock') {
    return (a, b) => Number(b?.stock ?? Number.MAX_SAFE_INTEGER) - Number(a?.stock ?? Number.MAX_SAFE_INTEGER) || compareActivity(a, b);
  }
  return compareActivity;
}

export function sortCatalogProducts(products, options = {}) {
  const list = Array.isArray(products) ? [...products] : [];
  const comparator = compareByMode(options.mode || 'default');
  const available = [];
  const exhausted = [];

  list.forEach(product => {
    (isProductInStock(product) ? available : exhausted).push(product);
  });

  available.sort(comparator);
  exhausted.sort(comparator);
  return [...available, ...exhausted];
}

export function productMerchandisingState(product, now = Date.now()) {
  return {
    available: isProductInStock(product),
    new: isNewProduct(product, now),
    createdAt: productCreatedAtMillis(product),
    activityAt: productActivityAtMillis(product),
  };
}

window.TintinCatalogMerchandising = Object.freeze({
  NEW_PRODUCT_WINDOW_MS,
  timestampToMillis,
  productCreatedAtMillis,
  productActivityAtMillis,
  isProductInStock,
  isNewProduct,
  sortCatalogProducts,
  productMerchandisingState,
});
