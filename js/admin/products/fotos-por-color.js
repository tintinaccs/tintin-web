import '../../components/images/galeria-producto.js?v=tintin-20261019-variant-links-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20261015-images-1';
import { createVariantPhotoEditor, appendPhotoOrderControls } from './fotos-por-variante.js?v=tintin-20261022-color-editor-repair-1';
import { setProductPreviewMedia } from './vista-previa-producto.js?v=tintin-20261024-editor-v2-3';

export function attachColorPhotos({ container, product = {}, variantsInput, imagesInput, mainInput, openLibrary, attachUpload }) {
  const media = window.TintinProductMedia;
  const initialRows = media.mediaRows(product);
  const variantPhotos = createVariantPhotoEditor({ variantsInput, media, initialRows, sanitizeImageUrl, openLibrary, attachUpload });
  const assignments = new Map();
  const appearances = new Map();
  const manuallyAssigned = new Set();
  const analyzed = new Set();
  const suggestions = new Map();
  const controller = new AbortController();
  let destroyed = false, analyzing = false, flushing = false;
  const uploads = [];
  let pool = media.uniqueImages(media.galleryImages(product).map(url => sanitizeImageUrl(url)).filter(Boolean));
  let activeKey = media.colorKey(product);
  let visibleColor = null;
  for (const row of initialRows) {
    if (!activeKey || !row?.[activeKey]) continue;
    if (Object.keys(row).some(key => !['price','sku','imageUrl','imageUrls','stock','active','colorHex','swatch',activeKey].includes(key))) continue;
    const color = String(row[activeKey]).trim();
    const appearance = {};
    const preset = window.TintinProductColors.preset(row.swatch);
    if (preset) appearance.swatch = preset.name;
    if (/^#[\da-f]{6}$/i.test(row.colorHex || '')) appearance.colorHex = row.colorHex;
    appearances.set(color, appearance);
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
  function addColor(name) {
    if (variantsInput.readOnly || colors().includes(name)) return;
    const lines = variantsInput.value.split(/\r?\n/);
    const index = lines.findIndex(line => /^\s*colou?r\s*:/i.test(line));
    if (index >= 0) lines[index] += `${lines[index].trim().endsWith(':') ? '' : ', '}${name}`;
    else lines.push(`Color: ${name}`);
    variantsInput.value = lines.filter(Boolean).join('\n');
    variantsInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function presetSelect(value, label) {
    const select = document.createElement('select'); select.setAttribute('aria-label', label);
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Elegir color'; select.append(blank);
    for (const preset of window.TintinProductColors.palette) {
      const option = document.createElement('option'); option.value = preset.name; option.textContent = preset.name; select.append(option);
    }
    select.value = window.TintinProductColors.preset(value)?.name || ''; return select;
  }
  async function analyzePhotos() {
    if (analyzing || destroyed) return;
    // Una forma, tamaño o sabor no debe convertirse en una variante Color.
    if (!colors().length && variantsInput.value.trim()) return;
    analyzing = true;
    try {
      for (const url of [...pool]) {
        const identity = media.imageKey(url);
        if (destroyed) break;
        if (analyzed.has(identity)) continue;
        analyzed.add(identity);
        // Las asociaciones existentes o elegidas por el administrador prevalecen.
        if ([...assignments.values()].some(urls => urls.some(value => media.imageKey(value) === identity))) continue;
        const suggestion = await window.TintinProductColors.suggestImageColor(url, { signal: controller.signal });
        if (destroyed) break;
        if (suggestion) {
          suggestions.set(identity, suggestion.name);
          if (!manuallyAssigned.has(identity)) {
            let target = colors().find(name => window.TintinProductColors.preset(name)?.name === suggestion.name);
            if (!target && !variantsInput.readOnly) { addColor(suggestion.name); target = suggestion.name; }
            if (target) assignments.set(target, media.uniqueImages([...(assignments.get(target) || []), url]));
          }
        }
        render();
      }
    } finally { analyzing = false; }
  }
  function render() {
    if (destroyed || flushing || uploads.some(widget => widget.hasPending?.()) || variantPhotos.hasPending()) return;
    destroyUploads(); container.replaceChildren();
    const options = colors();
    if(visibleColor===null || (visibleColor && !options.includes(visibleColor)))visibleColor=options[0] || '';
    pool = media.uniqueImages([...pool, mainInput.value, ...imagesInput.value.split(/\r?\n/)].map(url => sanitizeImageUrl(url)).filter(Boolean));
    const heading = document.createElement('h3'); heading.textContent = 'Fotos por color'; container.append(heading);
    const hint = document.createElement('p');
    hint.textContent = 'Sugerimos un color para las fotos sin asignar cuando la imagen permite estimarlo. Revisá la propuesta y cambiá lo que necesites. Las fotos y los círculos se aplican al guardar el producto.';
    container.append(hint);
    const filters=document.createElement('div');filters.className='tt-editor-choices tt-editor-photo-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','Ver fotos por color');
    const applyFilter=()=>{for(const field of container.querySelectorAll(':scope > fieldset[data-media-color]'))field.hidden=Boolean(visibleColor && field.dataset.mediaColor!==visibleColor);for(const button of filters.children)button.setAttribute('aria-pressed',String(button.dataset.photoColor===visibleColor));};
    for(const color of ['',...options]){const button=document.createElement('button');button.type='button';button.className='tt-editor-choice';button.textContent=color || 'Todas';button.dataset.photoColor=color;button.addEventListener('click',()=>{visibleColor=color;applyFilter();});filters.append(button);}
    if(options.length)container.append(filters);
    const paletteRow = document.createElement('div'); paletteRow.className = 'adm-color-palette';
    const palette = presetSelect('', 'Paleta de colores');
    const addButton = document.createElement('button'); addButton.type = 'button'; addButton.className = 'adm-btn adm-btn-outline'; addButton.textContent = 'Agregar color';
    palette.disabled = addButton.disabled = variantsInput.readOnly;
    addButton.addEventListener('click', () => { if (palette.value) addColor(palette.value); });
    paletteRow.append(palette, addButton); container.append(paletteRow);
    if (variantsInput.readOnly) {
      const note = document.createElement('p'); note.textContent = 'Para agregar un color con stock, editá primero las variantes de inventario. Aquí podés asignar sus fotos y cambiar el círculo.'; container.append(note);
    }
    for (const color of options) {
      const field = document.createElement('fieldset'); field.className = 'adm-color-photos';field.dataset.mediaColor=color;
      const legend = document.createElement('legend'); legend.textContent = color; field.append(legend);
      const appearance = appearances.get(color) || {};
      const controls = document.createElement('div'); controls.className = 'adm-color-palette';
      const preset = presetSelect(appearance.swatch || color, `Aspecto del círculo de ${color}`);
      const customLabel = document.createElement('label'); customLabel.textContent = 'Color personalizado';
      const custom = document.createElement('input'); custom.type = 'color'; custom.setAttribute('aria-label', `Color personalizado de ${color}`);
      custom.value = /^#[\da-f]{6}$/i.test(appearance.colorHex || '') ? appearance.colorHex : window.TintinProductColors.preset(appearance.swatch || color)?.hex || '#CFD4DA';
      const preview = document.createElement('span'); preview.className = 'adm-color-circle'; preview.style.background = window.TintinProductColors.swatch(color, appearance);
      preset.addEventListener('change', () => {
        appearances.set(color, { swatch: preset.value }); preview.style.background = window.TintinProductColors.swatch(color, appearances.get(color));
        custom.value = window.TintinProductColors.preset(preset.value)?.hex || '#CFD4DA';
      });
      custom.addEventListener('input', () => { appearances.set(color, { colorHex: custom.value }); preview.style.background = custom.value; });
      customLabel.append(custom); controls.append(preview, preset, customLabel); field.append(controls);
      const grid = document.createElement('div'); grid.className = 'adm-color-photo-grid';
      const ordered=media.uniqueImages([...(assignments.get(color) || []), ...pool]);
      for (const url of ordered) {
        const tile=document.createElement('div');tile.className='tt-color-photo-tile';
        const label = document.createElement('label');
        const check = document.createElement('input'); check.type = 'checkbox';
        check.setAttribute('aria-label', `Asignar foto ${pool.indexOf(url) + 1} a ${color}`);
        check.checked = (assignments.get(color) || []).some(value => media.imageKey(value) === media.imageKey(url));
        const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy';
        check.addEventListener('change', () => {
          manuallyAssigned.add(media.imageKey(url));
          const current = assignments.get(color) || [];
          assignments.set(color, check.checked ? media.uniqueImages([...current, url]) : current.filter(value => media.imageKey(value) !== media.imageKey(url)));
          render();
        });
        label.append(check, image);
        const suggestion = suggestions.get(media.imageKey(url));
        if (suggestion) { const text = document.createElement('small'); text.textContent = `Sugerido: ${suggestion}`; label.append(text); }
        tile.append(label);
        appendPhotoOrderControls(tile,{url,photos:assignments.get(color) || [],label:color,update:urls=>{assignments.set(color,urls);render();}});
        const cover=document.createElement('button');cover.type='button';cover.className='adm-btn adm-btn-outline';cover.textContent=media.imageKey(mainInput.value)===media.imageKey(url)?'Portada del producto':'Usar de portada';cover.setAttribute('aria-label',`Portada del producto: foto ${pool.indexOf(url)+1} de ${color}`);cover.setAttribute('aria-pressed',String(media.imageKey(mainInput.value)===media.imageKey(url)));
        cover.addEventListener('click',()=>{mainInput.value=url;mainInput.dispatchEvent(new Event('input',{bubbles:true}));mainInput.dispatchEvent(new Event('change',{bubbles:true}));});tile.append(cover);grid.append(tile);
      }
      field.append(grid);
      const add = url => {
        const safe = sanitizeImageUrl(url); if (!safe) return;
        pool = media.uniqueImages([...pool, safe]);
        manuallyAssigned.add(media.imageKey(safe));
        assignments.set(color, media.uniqueImages([...(assignments.get(color) || []), safe]));
        render();
      };
      const library = document.createElement('button'); library.type = 'button'; library.className = 'adm-btn adm-btn-outline'; library.textContent = `Elegir foto de biblioteca para ${color}`;
      library.addEventListener('click', async () => { try { const url = await openLibrary(); if (url) add(url); } catch { hint.textContent = 'No pudimos abrir la biblioteca. Reintentá.'; } });
      field.append(library);
      if (attachUpload) {
        const upload = document.createElement('div'); field.append(upload);
        uploads.push(attachUpload(upload, { label: `Agregar foto a ${color}`, hint: 'Podés subir otra foto o pegar su enlace.', onOpenLibrary: openLibrary, onChange: add, cleanupPrevious: false }));
      }
      container.append(field);
    }
    applyFilter();
    variantPhotos.render(container, pool, render);
    notifyPreview();
    void analyzePhotos();
  }
  function serialize() {
    const options = colors();
    // Las asociaciones de otros atributos se conservan; se reemplazan sólo
    // las filas de colores gestionadas en este editor.
    const otherRows = initialRows.filter(row => !row || !Object.keys(row).some(key => /^colou?r$/i.test(key)) || Object.keys(row).some(key => !['price','sku','imageUrl','imageUrls','stock','active','colorHex','swatch',activeKey].includes(key)));
    return variantPhotos.serialize([...otherRows, ...options.map(color => {const row={...initialRows.find(row=>String(row?.[activeKey] || '').trim()===color && !Object.keys(row).some(key=>!['price','sku','imageUrl','imageUrls','stock','active','colorHex','swatch',activeKey].includes(key))),[activeKey]:color,imageUrls:assignments.get(color) || [],...(appearances.get(color) || {})};delete row.imageUrl;delete row.colorHex;delete row.swatch;Object.assign(row,appearances.get(color) || {});return row;})]);
  }
  function notifyPreview() {
    if (!destroyed) setProductPreviewMedia(container.closest('#prod-form-card'), serialize());
  }
  // Dejar que el control actualice la asociación antes de leer su snapshot.
  const onMediaInput = () => queueMicrotask(notifyPreview);
  container.addEventListener('input', onMediaInput);
  container.addEventListener('change', onMediaInput);
  variantsInput.addEventListener('input', render);
  imagesInput.addEventListener('input', render);
  mainInput.addEventListener('change', render);
  async function flush() {
    flushing = true;
    try { await Promise.all([variantPhotos.flush(), ...uploads.map(widget => widget.flush?.())]); }
    finally { flushing = false; }
    render();
  }
  render();
  return { serialize, flush, pendingSignature:()=>[variantPhotos.pendingSignature(),...uploads.map(widget=>widget.pendingSignature?.() || [])], refresh: render, removePhoto(url){const key=media.imageKey(url);pool=pool.filter(photo=>media.imageKey(photo)!==key);for(const [color,photos] of assignments)assignments.set(color,photos.filter(photo=>media.imageKey(photo)!==key));variantPhotos.removePhoto(url);render();}, destroy() { destroyed = true; controller.abort(); destroyUploads(); variantPhotos.destroy(); container.removeEventListener('input', onMediaInput); container.removeEventListener('change', onMediaInput); variantsInput.removeEventListener('input', render); imagesInput.removeEventListener('input', render); mainInput.removeEventListener('change', render); container.replaceChildren(); } };
}
