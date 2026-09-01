/* =============================================================
   TINTIN — UI de la biblioteca multimedia (Super Admin)

   Dos formas de uso:
   - openMediaLibraryPicker(): modal para ELEGIR una imagen ya subida desde
     cualquier widget de carga ("Elegir de la biblioteca"). Devuelve una
     Promise<string|null> con la URL elegida (null si se cerró sin elegir).
   - mountMediaLibrarySection(container): panel persistente de administración
     (buscar, ver metadata, borrar con verificación de uso) para la sección
     "Biblioteca" del panel de Imágenes.
   ============================================================= */

import { onMediaLibraryUpdate, uploadImageToLibrary, deleteMediaItem, updateMediaMetadata, findOrphanedMedia } from '../../components/images/biblioteca-multimedia.js?v=tintin-20260901-media-orphan-log-1';

function ensureStyles() {
  if (document.getElementById('tt-media-library-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-media-library-style';
  style.textContent = `
    .tt-mlib-overlay{position:fixed;inset:0;background:rgba(20,10,15,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
    .tt-mlib-modal{background:#fff;border-radius:14px;max-width:880px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
    .tt-mlib-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #f0dbe3;flex-wrap:wrap}
    .tt-mlib-title{font:800 15px Montserrat,sans-serif;color:#2B2B2B}
    .tt-mlib-close{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#8a8a8a;padding:4px 8px}
    .tt-mlib-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .tt-mlib-btn{min-height:34px;padding:7px 11px;border:1px solid #e3c3cf;border-radius:9px;background:#fff;color:#8b2642;font:700 11px Montserrat,sans-serif;cursor:pointer}
    .tt-mlib-btn.primary{background:#ad3f67;border-color:#ad3f67;color:#fff}
    .tt-mlib-btn:disabled{opacity:.55;cursor:not-allowed}
    .tt-mlib-search{margin:12px 18px 0;padding:9px 12px;border:1px solid #e3c3cf;border-radius:9px;font:500 12.5px Montserrat,sans-serif;width:calc(100% - 36px)}
    .tt-mlib-drop{margin:12px 18px 0;padding:14px;border:1px dashed #d98ca6;border-radius:11px;background:#fff8fb;color:#8a5868;font:600 11px Montserrat,sans-serif;text-align:center;cursor:pointer}
    .tt-mlib-drop.is-drag{background:#fdebf2;border-color:#ad3f67}
    .tt-mlib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;padding:14px 18px;overflow-y:auto}
    .tt-mlib-item{border:1px solid #f0dbe3;border-radius:10px;overflow:hidden;background:#fff8fa;cursor:pointer;display:flex;flex-direction:column;text-align:left}
    .tt-mlib-item:hover{border-color:#AD3F67}
    .tt-mlib-thumb{width:100%;aspect-ratio:1;object-fit:cover;background:#f1e3e8;display:block}
    .tt-mlib-meta{padding:8px;font:500 10px Montserrat,sans-serif;color:#8a8a8a;line-height:1.4}
    .tt-mlib-meta strong{display:block;color:#2B2B2B;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt-mlib-meta small{display:block;margin-top:3px;color:#9b7d89}
    .tt-mlib-meta input{width:100%;margin-top:6px;padding:5px 6px;border:1px solid #ead3dc;border-radius:6px;font:500 10px Montserrat,sans-serif}
    .tt-mlib-meta button{margin-top:6px;border:0;background:transparent;color:#ad3f67;font:700 10px Montserrat,sans-serif;cursor:pointer;padding:0}
    .tt-mlib-empty{padding:30px;text-align:center;color:#9a9a9a;font:500 12px Montserrat,sans-serif}
    .tt-mlib-del{margin:0 8px 8px;border:1px solid #e8c3c3;background:#fff;color:#b23a3a;border-radius:7px;font:600 10.5px Montserrat,sans-serif;padding:4px 0;cursor:pointer}
    .tt-mlib-del:hover{background:#fdf2f2}
    .tt-mlib-orphan-status{width:100%;margin-top:4px;padding:8px 10px;border:1px solid #f2d9a8;background:#fff8e8;color:#8a6a2b;border-radius:8px;font:600 11px Montserrat,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .tt-mlib-orphan-status button{border:0;background:none;color:#ad3f67;font:700 10.5px Montserrat,sans-serif;cursor:pointer;padding:0;white-space:nowrap}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  const ms = typeof value?.toMillis === 'function' ? value.toMillis() : value?.seconds ? value.seconds * 1000 : new Date(value).getTime();
  return Number.isFinite(ms) ? new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ms)) : '—';
}

function matchesQuery(item, needle) {
  if (!needle) return true;
  const haystack = `${item.originalName || ''} ${item.format || ''}`.toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

function renderGrid(grid, items, query, { onSelect, onDelete, onlyIds }) {
  const filtered = items
    .filter(item => matchesQuery(item, query))
    .filter(item => !onlyIds || onlyIds.has(item.id));
  if (!filtered.length) {
    grid.innerHTML = '<div class="tt-mlib-empty">No hay imágenes que coincidan.</div>';
    return;
  }
  grid.replaceChildren(...filtered.map(item => {
    const cell = document.createElement('div');
    cell.className = 'tt-mlib-item';

    const img = document.createElement('img');
    img.className = 'tt-mlib-thumb';
    img.loading = 'lazy';
    img.src = item.thumbUrl || item.url;
    img.alt = item.originalName || '';

    const meta = document.createElement('div');
    meta.className = 'tt-mlib-meta';
    meta.innerHTML = `<strong title="${escapeHtml(item.originalName || 'Sin nombre')}">${escapeHtml(item.originalName || 'Sin nombre')}</strong><small>${item.width || 0}×${item.height || 0} · ${formatBytes(item.bytes)} · ${formatDate(item.uploadedAt)}</small><small>${escapeHtml(item.section || 'biblioteca')}${item.slotKey ? ` · ${escapeHtml(item.slotKey)}` : ''}</small>`;

    cell.append(img, meta);
    if (onSelect) cell.addEventListener('click', () => onSelect(item));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Editar nombre y alt';
    edit.addEventListener('click', async event => {
      event.stopPropagation();
      const name = window.prompt('Nombre del archivo', item.originalName || '');
      if (name === null) return;
      const alt = window.prompt('Texto alternativo', item.alt || item.originalName || '');
      if (alt === null) return;
      try { await updateMediaMetadata(item.id, { originalName: name, alt }); }
      catch (error) { window.alert(error?.message || 'No se pudo actualizar la metadata.'); }
    });
    meta.appendChild(edit);
    if (onDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'tt-mlib-del';
      del.textContent = 'Borrar';
      del.addEventListener('click', event => {
        event.stopPropagation();
        onDelete(item);
      });
      cell.appendChild(del);
    }
    return cell;
  }));
}

function mountLibraryUI(host, { title, onSelect, showDelete, showOrphanScan }) {
  ensureStyles();
  let items = [];
  let query = '';
  let orphanIds = null;

  const head = document.createElement('div');
  head.className = 'tt-mlib-head';
  const titleEl = document.createElement('div');
  titleEl.className = 'tt-mlib-title';
  titleEl.textContent = title;
  head.appendChild(titleEl);

  const actions = document.createElement('div');
  actions.className = 'tt-mlib-actions';
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true; fileInput.hidden = true;
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button'; uploadBtn.className = 'tt-mlib-btn primary'; uploadBtn.textContent = 'Subir imágenes';
  uploadBtn.addEventListener('click', () => fileInput.click());
  actions.append(uploadBtn, fileInput);

  let orphanBtn = null;
  let orphanStatus = null;
  if (showOrphanScan) {
    orphanBtn = document.createElement('button');
    orphanBtn.type = 'button'; orphanBtn.className = 'tt-mlib-btn'; orphanBtn.textContent = 'Buscar huérfanos';
    orphanBtn.title = 'Reconcilia la biblioteca con productos, colecciones y configuración: detecta imágenes sin ninguna referencia real.';
    orphanBtn.addEventListener('click', async () => {
      orphanBtn.disabled = true;
      orphanBtn.textContent = 'Buscando…';
      try {
        const orphans = await findOrphanedMedia();
        orphanIds = new Set(orphans.map(item => item.id));
        orphanStatus.textContent = orphanIds.size
          ? `${orphanIds.size} imagen(es) sin referencias. Mostrando solo huérfanas — podés borrarlas o volver a ver todas.`
          : 'No se encontraron imágenes huérfanas.';
        orphanStatus.hidden = false;
        renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null, onlyIds: orphanIds.size ? orphanIds : null });
      } catch (error) {
        window.alert(error?.message || 'No se pudo completar el reconciliador de huérfanos.');
      } finally {
        orphanBtn.disabled = false;
        orphanBtn.textContent = 'Buscar huérfanos';
      }
    });
    actions.appendChild(orphanBtn);

    orphanStatus = document.createElement('div');
    orphanStatus.className = 'tt-mlib-orphan-status';
    orphanStatus.hidden = true;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Ver todas';
    clearBtn.addEventListener('click', () => {
      orphanIds = null;
      orphanStatus.hidden = true;
      renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null, onlyIds: null });
    });
    orphanStatus.appendChild(clearBtn);
  }
  head.appendChild(actions);
  if (orphanStatus) head.appendChild(orphanStatus);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'tt-mlib-search';
  search.placeholder = 'Buscar por nombre o formato…';

  const grid = document.createElement('div');
  grid.className = 'tt-mlib-grid';

  const drop = document.createElement('div');
  drop.className = 'tt-mlib-drop';
  drop.textContent = 'Arrastrá imágenes aquí o elegí “Subir imágenes” · JPG, PNG, WEBP · se optimizan automáticamente';
  drop.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', event => handleFiles(event.dataTransfer?.files));

  host.append(head, search, drop, grid);

  async function handleFiles(files) {
    const list = [...(files || [])].filter(file => file.type.startsWith('image/'));
    if (!list.length) return;
    uploadBtn.disabled = true;
    let completed = 0;
    for (const file of list) {
      try {
        await uploadImageToLibrary(file, { section: 'biblioteca', alt: file.name, onProgress: stage => { drop.textContent = `Subiendo ${file.name} · ${stage}…`; } });
        completed += 1;
      } catch (error) { window.alert(error?.message || `No se pudo subir ${file.name}.`); }
    }
    drop.textContent = completed ? `${completed} imagen${completed === 1 ? '' : 'es'} subida${completed === 1 ? '' : 's'}. Podés seguir arrastrando más.` : 'No se pudo completar la carga. Revisá el archivo e intentá nuevamente.';
    uploadBtn.disabled = false;
  }
  fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

  async function handleDelete(item) {
    if (!window.confirm(`¿Borrar "${item.originalName || item.id}" de la biblioteca?`)) return;
    try {
      await deleteMediaItem(item.id);
    } catch (error) {
      window.alert(error?.message || 'No se pudo borrar la imagen.');
    }
  }

  search.addEventListener('input', () => {
    query = search.value.trim();
    renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null, onlyIds: orphanIds });
  });

  const unsubscribe = onMediaLibraryUpdate(nextItems => {
    items = nextItems;
    renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null, onlyIds: orphanIds });
  });

  return { head, unsubscribe };
}

/** Modal de selección; devuelve Promise<string|null> con la URL elegida. */
export function openMediaLibraryPicker() {
  ensureStyles();
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'tt-mlib-overlay';
    const modal = document.createElement('div');
    modal.className = 'tt-mlib-modal';
    overlay.appendChild(modal);

    let settled = false;
    function finish(value) {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      overlay.remove();
      resolve(value);
    }

    const { head, unsubscribe } = mountLibraryUI(modal, {
      title: 'Elegir de la biblioteca',
      showDelete: false,
      onSelect: item => finish(item.url),
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tt-mlib-close';
    close.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    close.addEventListener('click', () => finish(null));
    head.appendChild(close);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) finish(null);
    });

    document.body.appendChild(overlay);
  });
}

let activeSectionUnsubscribe = null;

/** Cierra el listener de Firestore del panel de biblioteca, si hay uno activo. */
export function unmountMediaLibrarySection() {
  activeSectionUnsubscribe?.();
  activeSectionUnsubscribe = null;
}

/** Panel persistente de administración (buscar + borrar) para una sección del admin. */
export function mountMediaLibrarySection(container) {
  unmountMediaLibrarySection();
  container.replaceChildren();
  const wrap = document.createElement('div');
  const { unsubscribe } = mountLibraryUI(wrap, { title: 'Biblioteca multimedia', showDelete: true, onSelect: null, showOrphanScan: true });
  activeSectionUnsubscribe = unsubscribe;
  container.appendChild(wrap);
}
