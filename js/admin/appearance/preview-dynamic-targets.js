function cleanId(value) {
  return String(value ?? '').trim();
}

function isVisibleProduct(product) {
  if (!product || product.active === false) return false;
  const id = cleanId(product.id || product._docId);
  const name = String(product.name || product.title || '').trim();
  const price = Number(String(product.price ?? '').replace(/\./g, '').replace(',', '.'));
  return Boolean(id && name && Number.isFinite(price) && price > 0);
}

export function chooseRandomPreviewProduct(products, random = Math.random) {
  const visible = (Array.isArray(products) ? products : []).filter(isVisibleProduct);
  if (!visible.length) return null;
  const inStock = visible.filter(product => product.stock == null || Number(product.stock) > 0);
  const candidates = inStock.length ? inStock : visible;
  const draw = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  return candidates[Math.floor(draw * candidates.length)] || candidates[0];
}

export function productPreviewTarget(basePath, product) {
  const id = cleanId(product?.id || product?._docId);
  if (!id) return basePath;
  const separator = String(basePath).includes('?') ? '&' : '?';
  return `${basePath}${separator}id=${encodeURIComponent(id)}`;
}
