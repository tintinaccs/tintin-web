/* Misma foto por color en producto, carrito, checkout y pedido canónico. */
const metadata = new Set(['price', 'sku', 'imageUrl', 'imageUrls', 'stock', 'active']);
function safeImage(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  try { return ['https:', 'http:'].includes(new URL(text, 'https://media.invalid/').protocol) ? text : ''; }
  catch { return ''; }
}
function imageKey(value) {
  const url = new URL(value, 'https://media.invalid/');
  if (url.hostname === 'res.cloudinary.com') {
    url.pathname = url.pathname.replace(/(\/upload\/)(?:(?:f_auto,q_auto(?:,c_limit,w_\d+,dpr_auto)?)\/)+/, '$1');
  }
  return url.href;
}
export function productVariantImage(product, selection, fallback = '') {
  const variants = product?.variants || {};
  const keys = Array.isArray(variants)
    ? [...new Set(variants.flatMap(row => row && typeof row === 'object' ? Object.keys(row).filter(key => !metadata.has(key)) : []))]
    : Object.keys(variants).filter(key => !metadata.has(key));
  const index = keys.findIndex(key => /^colou?r$/i.test(key.trim()));
  const color = index < 0 ? '' : String(selection || '').split('/').map(value => value.trim())[index] || '';
  const rows = Array.isArray(product?.variantMedia) ? product.variantMedia : Array.isArray(variants) ? variants : [];
  const images = row => [row?.imageUrl, ...(Array.isArray(row?.imageUrls) ? row.imageUrls : [])].map(safeImage).filter(Boolean);
  if (color) {
    const matching = rows.filter(row => String(row?.[keys[index]] || '').trim() === color).flatMap(images);
    if (matching.length) return matching[0];
    const assigned = new Set(rows.flatMap(images).map(imageKey));
    const general = [product?.imageUrl || product?.image, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : []), fallback].map(safeImage).filter(url => url && !assigned.has(imageKey(url)));
    return general[0] || '';
  }
  return safeImage(product?.imageUrl || product?.image) || safeImage(fallback);
}
