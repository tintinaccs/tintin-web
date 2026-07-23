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

import { onMediaLibraryUpdate, deleteMediaItem } from './media-library.js?v=tintin-20260716-cloudinary-fix-1';

function ensureStyles() {
  if (document.getElementById('tt-media-library-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-media-library-style';
  style.textContent = `
    .tt-mlib-overlay{position:fixed;inset:0;background:rgba(20,10,15,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
    .tt-mlib-modal{background:#fff;border-radius:14px;max-width:880px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
    .tt-mlib-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid #f0dbe3}
    .tt-mlib-title{font:800 15px Montserrat,sans-serif;color:#2B2B2B}
    .tt-mlib-close{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#8a8a8a;padding:4px 8px}
    .tt-mlib-search{margin:12px 18px 0;padding:9px 12px;border:1px solid #e3c3cf;border-radius:9px;font:500 12.5px Montserrat,sans-serif;width:calc(100% - 36px)}
    .tt-mlib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;padding:14px 18px;overflow-y:auto}
    .tt-mlib-item{border:1px solid #f0dbe3;border-radius:10px;overflow:hidden;background:#fff8fa;cursor:pointer;display:flex;flex-direction:column;text-align:left}
    .tt-mlib-item:hover{border-color:#AD3F67}
    .tt-mlib-thumb{width:100%;aspect-ratio:1;object-fit:cover;background:#f1e3e8;display:block}
    .tt-mlib-meta{padding:6px 8px;font:500 10px Montserrat,sans-serif;color:#8a8a8a;line-height:1.3}
    .tt-mlib-meta strong{display:block;color:#2B2B2B;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt-mlib-empty{padding:30px;text-align:center;color:#9a9a9a;font:500 12px Montserrat,sans-serif}
    .tt-mlib-del{margin:0 8px 8px;border:1px solid #e8c3c3;background:#fff;color:#b23a3a;border-radius:7px;font:600 10.5px Montserrat,sans-serif;padding:4px 0;cursor:pointer}
    .tt-mlib-del:hover{background:#fdf2f2}
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

function matchesQuery(item, needle) {
  if (!needle) return true;
  const haystack = `${item.originalName || ''} ${item.format || ''}`.toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

function renderGrid(grid, items, query, { onSelect, onDelete }) {
  const filtered = items.filter(item => matchesQuery(item, query));
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
    meta.innerHTML = `<strong>${escapeHtml(item.originalName || 'Sin nombre')}</strong>${item.width || 0}×${item.height || 0} · ${formatBytes(item.bytes)}`;

    cell.append(img, meta);
    if (onSelect) cell.addEventListener('click', () => onSelect(item));

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

function mountLibraryUI(host, { title, onSelect, showDelete }) {
  ensureStyles();
  let items = [];
  let query = '';

  const head = document.createElement('div');
  head.className = 'tt-mlib-head';
  const titleEl = document.createElement('div');
  titleEl.className = 'tt-mlib-title';
  titleEl.textContent = title;
  head.appendChild(titleEl);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'tt-mlib-search';
  search.placeholder = 'Buscar por nombre o formato…';

  const grid = document.createElement('div');
  grid.className = 'tt-mlib-grid';

  host.append(head, search, grid);

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
    renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null });
  });

  const unsubscribe = onMediaLibraryUpdate(nextItems => {
    items = nextItems;
    renderGrid(grid, items, query, { onSelect, onDelete: showDelete ? handleDelete : null });
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
    close.textContent = '✕';
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
  const { unsubscribe } = mountLibraryUI(wrap, { title: 'Biblioteca multimedia', showDelete: true, onSelect: null });
  activeSectionUnsubscribe = unsubscribe;
  container.appendChild(wrap);
}
