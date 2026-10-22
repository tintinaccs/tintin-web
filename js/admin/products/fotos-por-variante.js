/* Asociaciones explícitas para cualquier atributo y combinación del catálogo. */
export function createVariantPhotoEditor({ variantsInput, media, initialRows, sanitizeImageUrl, openLibrary, attachUpload }) {
  const metadata = new Set(['price', 'sku', 'imageUrl', 'imageUrls', 'stock', 'active', 'colorHex', 'swatch']);
  const attributes = row => Object.keys(row || {}).filter(key => !metadata.has(key));
  const identity = row => JSON.stringify(attributes(row).sort().map(key => [key, String(row[key]).trim()]));
  const changed = new Map();
  const selection = {};
  let uploads = [];
  function groups() {
    const result = new Map();
    for (const line of variantsInput.value.split(/\r?\n/)) {
      const index = line.indexOf(':');
      if (index < 1) continue;
      const key = line.slice(0, index).trim();
      const values = [...new Set([...(result.get(key) || []), ...line.slice(index + 1).split(',').map(value => value.trim()).filter(Boolean)])];
      if (values.length) result.set(key, values);
    }
    return [...result];
  }
  function destroyUploads() { uploads.splice(0).forEach(widget => widget.destroy()); }
  function serialize(rows) {
    const replaced = new Set(changed.keys());
    return [...rows.filter(row => !replaced.has(identity(row))), ...changed.values()];
  }
  function render(container, pool, refresh) {
    destroyUploads();
    const options = groups();
    if (!options.length || (options.length === 1 && /^colou?r$/i.test(options[0][0]))) return;
    for (const [key, values] of options) if (!values.includes(selection[key])) selection[key] = values[0];
    for (const key of Object.keys(selection)) if (!options.some(([name]) => name === key)) delete selection[key];
    const heading = document.createElement('h3'); heading.textContent = 'Fotos por variante y combinación'; container.append(heading);
    const hint = document.createElement('p'); hint.textContent = 'Elegí los atributos y marcá las fotos que corresponden a esa variante. La primera foto marcada será su portada. Estas asociaciones tienen prioridad sobre las fotos generales del color.'; container.append(hint);
    const filters = document.createElement('div'); filters.className = 'adm-color-palette';
    for (const [key, values] of options) {
      const label = document.createElement('label'); label.textContent = key;
      const select = document.createElement('select'); select.setAttribute('aria-label', `Fotos de variante: ${key}`);
      for (const value of values) { const option = document.createElement('option'); option.value = option.textContent = value; select.append(option); }
      select.value = selection[key]; select.addEventListener('change', () => { selection[key] = select.value; refresh(); });
      label.append(select); filters.append(label);
    }
    container.append(filters);
    const selected = { ...selection };
    const key = identity(selected);
    const row = changed.get(key) || initialRows.find(row => identity(row) === key);
    let photos = media.rowImages(row);
    const save = urls => { photos = media.uniqueImages(urls); const next = { ...row, ...selected, imageUrls: photos }; delete next.imageUrl; changed.set(key, next); };
    const grid = document.createElement('div'); grid.className = 'adm-color-photo-grid';
    for (const [index, url] of media.uniqueImages([...pool, ...photos]).entries()) {
      const label = document.createElement('label'); const check = document.createElement('input'); check.type = 'checkbox';
      check.setAttribute('aria-label', `Asignar foto ${index + 1} a variante ${options.map(([name]) => selection[name]).join(' / ')}`);
      check.checked = photos.some(photo => media.imageKey(photo) === media.imageKey(url));
      check.addEventListener('change', () => save(check.checked ? [...photos, url] : photos.filter(photo => media.imageKey(photo) !== media.imageKey(url))));
      const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; label.append(check, image); grid.append(label);
    }
    container.append(grid);
    const add = value => { const url = sanitizeImageUrl(value); if (url) { if (!pool.some(photo => media.imageKey(photo) === media.imageKey(url))) pool.push(url); save([...photos, url]); refresh(); } };
    const library = document.createElement('button'); library.type = 'button'; library.className = 'adm-btn adm-btn-outline'; library.textContent = 'Elegir foto para esta variante';
    library.addEventListener('click', async () => { try { const url = await openLibrary(); if (url) add(url); } catch { hint.textContent = 'No pudimos abrir la biblioteca. Reintentá.'; } }); container.append(library);
    if (attachUpload) { const upload = document.createElement('div'); container.append(upload); uploads.push(attachUpload(upload, { label: 'Agregar foto a esta variante', hint: 'Subí una foto o pegá su enlace.', onOpenLibrary: openLibrary, onChange: add, cleanupPrevious: false })); }
  }
  return { render, serialize, hasPending: () => uploads.some(widget => widget.hasPending?.()),
    flush: () => Promise.all(uploads.map(widget => widget.flush?.())), destroy: destroyUploads };
}
