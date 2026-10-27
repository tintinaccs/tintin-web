// Orden explícito compartido por color y por combinación; teclado y táctil.
export function appendPhotoOrderControls(tile, {url, photos, label, update, draggable=true}) {
  const media=window.TintinProductMedia;
  const index=photos.findIndex(photo=>media.imageKey(photo)===media.imageKey(url));
  if(index<0)return;
  tile.dataset.photoGroup=label;tile.dataset.photoKey=media.imageKey(url);
  const publish=next=>{const root=tile.closest('#prod-color-photos') || tile.parentElement?.parentElement;update(next);if(root?.isConnected){const target=[...root.querySelectorAll('.tt-color-photo-tile')].find(item=>item.dataset.photoGroup===label && item.dataset.photoKey===media.imageKey(url));target?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}};
  const badge=document.createElement('small');badge.className=`tt-photo-order-badge${index===0?' is-primary':''}`;badge.textContent=index===0?'Portada':`Foto ${index+1}`;tile.append(badge);
  const controls=document.createElement('div');controls.className='tt-photo-order-actions';
  const move=to=>{const next=[...photos];next.splice(index,1);next.splice(to,0,url);publish(next);};
  for(const [text,name,to] of [['★',`Usar como primera foto de ${label}`,0],['←',`Mover foto anterior en ${label}`,index-1],['→',`Mover foto siguiente en ${label}`,index+1]]) {
    const button=document.createElement('button');button.type='button';button.className='adm-btn adm-btn-outline';button.textContent=text;button.setAttribute('aria-label',name);button.disabled=to<0 || to>=photos.length || to===index;button.addEventListener('click',()=>move(to));controls.append(button);
  }
  tile.append(controls);if(!draggable)return;tile.draggable=true;
  tile.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-tintin-photo',JSON.stringify({label,url}));event.dataTransfer.effectAllowed='move';});
  tile.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/x-tintin-photo'))event.preventDefault();});
  tile.addEventListener('drop',event=>{event.preventDefault();try {const item=JSON.parse(event.dataTransfer.getData('application/x-tintin-photo'));if(item.label!==label)return;const from=photos.findIndex(photo=>media.imageKey(photo)===media.imageKey(item.url));if(from<0 || from===index)return;const next=[...photos];const [photo]=next.splice(from,1);next.splice(index,0,photo);publish(next);}catch{}});
}

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
  function setPhotos(selected, urls) {
    const key=identity(selected), row=changed.get(key) || initialRows.find(row=>identity(row)===key);
    const next={...row,...selected,imageUrls:media.uniqueImages(urls)};delete next.imageUrl;changed.set(key,next);
  }
  function replacePhoto(from,to) {
    for(const row of serialize(initialRows)) {
      if(attributes(row).length===1 && media.isColorKey(attributes(row)[0]))continue;
      const photos=media.rowImages(row);if(!photos.some(url=>media.imageKey(url)===media.imageKey(from)))continue;
      setPhotos(Object.fromEntries(attributes(row).map(key=>[key,row[key]])),photos.map(url=>media.imageKey(url)===media.imageKey(from)?to:url));
    }
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
    const photoPool = media.uniqueImages([...pool, ...photos]);
    for (const url of media.uniqueImages([...photos, ...pool])) {
      const tile=document.createElement('div');tile.className='tt-color-photo-tile';
      const label = document.createElement('label'); const check = document.createElement('input'); check.type = 'checkbox';
      const photoNumber = photoPool.findIndex(photo => media.imageKey(photo) === media.imageKey(url)) + 1;
      check.setAttribute('aria-label', `Asignar foto ${photoNumber} a variante ${options.map(([name]) => selection[name]).join(' / ')}`);
      check.checked = photos.some(photo => media.imageKey(photo) === media.imageKey(url));
      check.addEventListener('change', () => {save(check.checked ? [...photos, url] : photos.filter(photo => media.imageKey(photo) !== media.imageKey(url)));refresh();});
      const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; label.append(check, image);tile.append(label);appendPhotoOrderControls(tile,{url,photos,label:options.map(([name])=>selection[name]).join(' / '),update:urls=>{save(urls);refresh();}});grid.append(tile);
    }
    container.append(grid);
    const add = value => { const url = sanitizeImageUrl(value); if (url) { if (!pool.some(photo => media.imageKey(photo) === media.imageKey(url))) pool.push(url); save([...photos, url]); refresh(); } };
    const library = document.createElement('button'); library.type = 'button'; library.className = 'adm-btn adm-btn-outline'; library.textContent = 'Elegir foto para esta variante';
    library.addEventListener('click', async () => { try { const url = await openLibrary(); if (url) add(url); } catch { hint.textContent = 'No pudimos abrir la biblioteca. Reintentá.'; } }); container.append(library);
    if (attachUpload) { const upload = document.createElement('div'); container.append(upload); uploads.push(attachUpload(upload, { label: 'Agregar foto a esta variante', hint: 'Subí una foto o pegá su enlace.', onOpenLibrary: openLibrary, onChange: add, cleanupPrevious: false })); }
  }
  return { render, serialize, setPhotos, replacePhoto, removePhoto(url) {for(const row of serialize(initialRows)){if(attributes(row).length===1 && media.isColorKey(attributes(row)[0]))continue;const photos=media.rowImages(row).filter(photo=>media.imageKey(photo)!==media.imageKey(url));if(photos.length===media.rowImages(row).length)continue;const next={...row,imageUrls:photos};delete next.imageUrl;changed.set(identity(row),next);}}, hasPending: () => uploads.some(widget => widget.hasPending?.()),
    pendingSignature:()=>uploads.map(widget=>widget.pendingSignature?.() || []),
    flush: () => Promise.all(uploads.map(widget => widget.flush?.())), destroy: destroyUploads };
}
