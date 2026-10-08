import '../../components/images/galeria-producto.js?v=tintin-20261008-product-gallery-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';

export function attachColorPhotos({ container, product = {}, variantsInput, imagesInput, mainInput, openLibrary, attachUpload }) {
  const media = window.TintinProductMedia;
  const initialRows = media.mediaRows(product);
  const assignments = new Map();
  const uploads = [];
  let pool = media.uniqueImages(media.galleryImages(product).map(url => sanitizeImageUrl(url)).filter(Boolean));
  let activeKey = media.colorKey(product);
  for (const row of initialRows) {
    if (!activeKey || !row?.[activeKey]) continue;
    const color = String(row[activeKey]).trim();
    assignments.set(color, media.uniqueImages([...(assignments.get(color) || []), ...media.rowImages(row).map(url => sanitizeImageUrl(url)).filter(Boolean)]));
  }
  function colors() {
    const result = [];
    for (const line of variantsInput.value.split(/\r?\n/)) {
      const match = line.match(/^\s*(colou?r)\s*:\s*(.*)$/i);
      if (!match) continue;
      activeKey = match[1];
      for (const color of match[2].split(',').map(value => value.trim()).filter(Boolean)) if (!result.includes(color)) result.push(color);
    }
    return result;
  }
  function destroyUploads() { uploads.splice(0).forEach(widget => widget.destroy()); }
  function render() {
    destroyUploads(); container.replaceChildren();
    const options = colors();
    pool = media.uniqueImages([...pool, mainInput.value, ...imagesInput.value.split(/\r?\n/)].map(url => sanitizeImageUrl(url)).filter(Boolean));
    const heading = document.createElement('h3'); heading.textContent = 'Fotos por color'; container.append(heading);
    const hint = document.createElement('p');
    hint.textContent = options.length ? 'Marcá las fotos que corresponden a cada color. Podés elegir varias. Se aplican al guardar el producto.' : 'Agregá colores en las opciones del producto para asignarles fotos.';
    container.append(hint);
    for (const color of options) {
      const field = document.createElement('fieldset'); field.className = 'adm-color-photos';
      const legend = document.createElement('legend'); legend.textContent = color; field.append(legend);
      const grid = document.createElement('div'); grid.className = 'adm-color-photo-grid';
      for (const url of pool) {
        const label = document.createElement('label');
        const check = document.createElement('input'); check.type = 'checkbox';
        check.setAttribute('aria-label', `Asignar foto ${pool.indexOf(url) + 1} a ${color}`);
        check.checked = (assignments.get(color) || []).some(value => media.imageKey(value) === media.imageKey(url));
        const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy';
        check.addEventListener('change', () => {
          const current = assignments.get(color) || [];
          assignments.set(color, check.checked ? media.uniqueImages([...current, url]) : current.filter(value => media.imageKey(value) !== media.imageKey(url)));
        });
        label.append(check, image); grid.append(label);
      }
      field.append(grid);
      const add = url => {
        const safe = sanitizeImageUrl(url); if (!safe) return;
        pool = media.uniqueImages([...pool, safe]);
        assignments.set(color, media.uniqueImages([...(assignments.get(color) || []), safe]));
        render();
      };
      const library = document.createElement('button'); library.type = 'button'; library.className = 'adm-btn adm-btn-outline'; library.textContent = `Elegir foto de biblioteca para ${color}`;
      library.addEventListener('click', async () => { try { const url = await openLibrary(); if (url) add(url); } catch { hint.textContent = 'No pudimos abrir la biblioteca. Reintentá.'; } });
      field.append(library);
      if (attachUpload) {
        const upload = document.createElement('div'); field.append(upload);
        uploads.push(attachUpload(upload, { label: `Agregar foto a ${color}`, hint: 'Podés subir otra foto o pegar su enlace.', onOpenLibrary: openLibrary, onChange: add }));
      }
      container.append(field);
    }
  }
  function serialize() {
    const options = colors();
    // Las asociaciones de otros atributos se conservan; se reemplazan sólo
    // las filas de colores gestionadas en este editor.
    const otherRows = initialRows.filter(row => !row || !Object.keys(row).some(key => /^colou?r$/i.test(key)));
    return [...otherRows, ...options.map(color => ({ [activeKey]: color, imageUrls: assignments.get(color) || [] }))];
  }
  variantsInput.addEventListener('input', render);
  imagesInput.addEventListener('input', render);
  mainInput.addEventListener('change', render);
  render();
  return { serialize, refresh: render, destroy() { destroyUploads(); variantsInput.removeEventListener('input', render); imagesInput.removeEventListener('input', render); mainInput.removeEventListener('change', render); container.replaceChildren(); } };
}
