/* Una misma foto puede llegar con optimizaciones de entrega distintas.
 * Conservamos recortes y transformaciones artísticas; sólo ignoramos las
 * versiones de formato/calidad/tamaño que genera el sitio. */
(function () {
  'use strict';
  function imageKey(value) {
    try {
      const url = new URL(String(value || '').trim(), window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (url.hostname === 'res.cloudinary.com') {
        url.pathname = url.pathname.replace(/(\/upload\/)(?:(?:f_auto,q_auto(?:,c_limit,w_\d+,dpr_auto)?)\/)+/, '$1');
      }
      return url.href;
    } catch { return ''; }
  }
  function uniqueImages(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter(value => {
      const key = imageKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function mediaRows(product) {
    return Array.isArray(product?.variantMedia) ? product.variantMedia : Array.isArray(product?.variants) ? product.variants : [];
  }
  function rowImages(row) {
    return uniqueImages([row?.imageUrl, ...(Array.isArray(row?.imageUrls) ? row.imageUrls : [])].filter(value => typeof value === 'string' && value.trim()));
  }
  function colorKey(product) {
    const groups = Array.isArray(product?.variants)
      ? Object.fromEntries(product.variants.flatMap(row => row && typeof row === 'object' ? Object.keys(row).map(key => [key, true]) : []))
      : product?.variants || {};
    return Object.keys(groups).find(key => /^colou?r$/i.test(key.trim())) || null;
  }
  function galleryImages(product, selected = {}) {
    const rows = mediaRows(product);
    const key = colorKey(product);
    const color = key && selected[key];
    const assigned = color ? rows.filter(row => row && String(row[key] ?? '').trim() === color).flatMap(rowImages) : [];
    if (assigned.length) return uniqueImages(assigned);
    // Sin fotos asignadas al color no mostramos fotos pertenecientes a otro.
    const assignedKeys = new Set(rows.flatMap(rowImages).map(imageKey));
    const general = uniqueImages([product?.imageUrl || product?.image, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : [])].filter(Boolean));
    if (color) return general.filter(url => !assignedKeys.has(imageKey(url)));
    return uniqueImages([...general, ...rows.flatMap(rowImages)]);
  }
  window.TintinProductMedia = Object.freeze({ imageKey, uniqueImages, mediaRows, rowImages, colorKey, galleryImages });
})();
