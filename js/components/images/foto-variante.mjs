/* Misma foto por color en producto, carrito, checkout y pedido canónico. */
const metadata = new Set(['price', 'sku', 'imageUrl', 'imageUrls', 'stock', 'active', 'colorHex', 'swatch']);
function safeImage(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  try { return ['https:', 'http:'].includes(new URL(text, 'https://media.invalid/').protocol) ? text : ''; }
  catch { return ''; }
}
function imageKey(value) {
  const url = new URL(value, 'https://media.invalid/');
  if (url.hostname === 'res.cloudinary.com') {
    url.pathname = url.pathname.replace(/(\/upload\/)(?:(?:f_auto,q_auto(?::best)?(?:,c_limit,w_\d+,dpr_auto)?)\/)+/, '$1');
  }
  return url.href;
}
export function productVariantImage(product, selection, fallback = '') {
  const variants = product?.variants || {};
  const keys = Array.isArray(variants)
    ? [...new Set(variants.flatMap(row => row && typeof row === 'object' ? Object.keys(row).filter(key => !metadata.has(key)) : []))]
    : Object.keys(variants).filter(key => !metadata.has(key));
  let rows = Array.isArray(product?.variantMedia) ? product.variantMedia : Array.isArray(variants) ? variants : [];
  if (!rows.length && keys.length === 1) {
    const options = Array.isArray(variants[keys[0]]) ? variants[keys[0]].map(value => String(value).trim()).filter(Boolean) : [];
    const seen = new Set();
    const photos = [product?.imageUrl || product?.image, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : [])].map(safeImage).filter(url => {
      if (!url || seen.has(imageKey(url))) return false;
      seen.add(imageKey(url)); return true;
    });
    if (options.length > 1 && photos.length === options.length) rows = options.map((value, index) => ({[keys[0]]:value,imageUrl:photos[index]}));
  }
  const images = row => [row?.imageUrl, ...(Array.isArray(row?.imageUrls) ? row.imageUrls : [])].map(safeImage).filter(Boolean);
  // Formas, talles y combinaciones usan su asociación explícita. La fila
  // más específica prevalece sobre una foto genérica del mismo color.
  const selected = Object.fromEntries(keys.map((key, index) => [key, String(selection || '').split('/')[index]?.trim() || '']));
  const normalize = value => String(value ?? '').trim().toLocaleLowerCase('es');
  const assigned = rows.filter(row => {
    const attributes = keys.filter(key => row?.[key] != null && String(row[key]).trim());
    return attributes.length && attributes.every(key => normalize(row[key]) === normalize(selected[key])) && images(row).length;
  }).sort((a, b) => keys.filter(key => b[key] != null).length - keys.filter(key => a[key] != null).length);
  if (assigned.length) return images(assigned[0])[0];
  if (keys.some(key => selected[key])) {
    const assigned = new Set(rows.flatMap(images).map(imageKey));
    const general = [product?.imageUrl || product?.image, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : []), fallback].map(safeImage).filter(url => url && !assigned.has(imageKey(url)));
    return general[0] || '';
  }
  return safeImage(product?.imageUrl || product?.image) || safeImage(fallback);
}
