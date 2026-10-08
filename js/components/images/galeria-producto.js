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

/* Apariencia y sugerencias locales: las fotos nunca se envían a un analizador. */
(function () {
  'use strict';
  const definitions = [
    ['dorado', '#FFD34E', 'gold'], ['plateado', '#CFD4DA', 'silver'],
    ['oro rosa', '#EAB6A2', 'rose gold'], ['fucsia', '#E6008D', 'fuchsia'],
    ['rosa', '#F2A5C6', 'pink'], ['azul', '#2463CF', 'blue'],
    ['celeste', '#76C8EE', 'light blue'], ['azul marino', '#1B2B50', 'navy'],
    ['rojo', '#E53240', 'red'], ['bordó', '#7B2145', 'burgundy'],
    ['verde', '#35A461', 'green'], ['verde oliva', '#86904B', 'olive'],
    ['turquesa', '#27B9BA', 'turquoise'], ['violeta', '#8651C4', 'purple'],
    ['lila', '#C5A8E4', 'lilac'], ['amarillo', '#FFE349', 'yellow'],
    ['naranja', '#F68B39', 'orange'], ['coral', '#F58077', 'coral'],
    ['blanco', '#FFFFFF', 'white'], ['negro', '#202020', 'black'],
    ['gris', '#90969E', 'gray'], ['beige', '#E5D2B4', 'beige'],
    ['marrón', '#8C5C3E', 'brown'], ['crema', '#FFF1D8', 'cream'],
    ['cobre', '#CA8A60', 'copper'], ['transparente', '#F4F6F8', 'clear'],
    ['multicolor', '#E897CB', 'multicolor'],
  ];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const palette = Object.freeze(definitions.map(([name, hex, alias]) => Object.freeze({ name, hex, alias })));
  function preset(value) {
    const key = normalize(value);
    const aliases = { oro:'dorado', plata:'plateado', rosado:'rosa', fuscia:'fucsia', morado:'violeta', silver:'plateado', grey:'gris' };
    return palette.find(row => normalize(row.name) === (aliases[key] || key) || row.alias === key);
  }
  function swatch(value, row = {}) {
    if (/^#[\da-f]{6}$/i.test(row?.colorHex || '')) return row.colorHex;
    const color = preset(row?.swatch) || preset(value);
    if (color?.name === 'dorado') return 'linear-gradient(135deg,#FFF1AA 0%,#FFD34E 38%,#E8B62E 65%,#FFE890 100%)';
    if (color?.name === 'plateado') return 'linear-gradient(135deg,#F8FAFC 0%,#CFD4DA 40%,#AAB3BE 65%,#EEF1F4 100%)';
    if (color?.name === 'multicolor') return 'conic-gradient(#E6008D,#FFE349,#35A461,#2463CF,#E6008D)';
    return color?.hex || '#CFD4DA';
  }
  function guessColor(pixels) {
    const votes = new Map(); let foreground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b, a] = pixels.slice(i, i + 4);
      if (a < 160 || Math.min(r, g, b) > 235) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      // Fondo casi blanco y sombras suaves no describen el producto.
      if (delta < 12 && max > 218) continue;
      let name;
      if (max < 55) name = 'negro';
      else if (delta < 28) name = 'plateado';
      else {
        let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        hue = (hue * 60 + 360) % 360;
        if (hue < 18 || hue >= 345) name = 'rojo';
        else if (hue < 40) name = 'naranja';
        else if (hue < 68) name = 'dorado';
        else if (hue < 165) name = 'verde';
        else if (hue < 195) name = 'turquesa';
        else if (hue < 255) name = 'azul';
        else if (hue < 290) name = 'violeta';
        else name = 'fucsia';
      }
      foreground++; votes.set(name, (votes.get(name) || 0) + 1);
    }
    const winner = [...votes].sort((a, b) => b[1] - a[1])[0];
    // Una propuesta aproximada sólo se ofrece con suficiente señal.
    return foreground >= 12 && winner?.[1] / foreground >= .55 ? preset(winner[0]) : null;
  }
  function suggestImageColor(url, { signal } = {}) {
    return new Promise(resolve => {
      const image = new Image(); let done = false;
      const finish = value => {
        if (done) return; done = true; clearTimeout(timer);
        signal?.removeEventListener('abort', abort); image.onload = image.onerror = null;
        resolve(value);
      };
      const abort = () => { finish(null); image.src = ''; };
      const timer = setTimeout(abort, 7000);
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 64, 64);
          finish(guessColor(context.getImageData(0, 0, 64, 64).data));
        } catch { finish(null); }
      };
      image.onerror = () => finish(null); image.src = url;
    });
  }
  window.TintinProductColors = Object.freeze({ palette, preset, swatch, guessColor, suggestImageColor });
})();
