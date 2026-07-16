/* =============================================================
   TINTIN — Widget reutilizable de carga de imágenes

   Reemplaza cualquier <input type="url"> por un componente visual de carga
   directa: clic, arrastrar y soltar, previsualización, progreso, reemplazo,
   borrado y biblioteca. El procesamiento ocurre en el navegador y la subida
   real se realiza con firmas temporales de Cloudinary emitidas por Cloudflare.
   ============================================================= */

import { validateImageFile } from './image-processing.js?v=tintin-20260716-cloudinary-fix-1';
import {
  deleteMediaByUrlIfUnused,
  deleteMediaItem,
  uploadImageToLibrary
} from './media-library.js?v=tintin-20260716-cloudinary-fix-1';

const STAGE_LABELS = {
  validating: 'Validando archivo…',
  processing: 'Optimizando imagen…',
  uploading: 'Subiendo…',
  saving: 'Guardando…',
};

function ensureStyles() {
  if (document.getElementById('tt-image-upload-widget-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-image-upload-widget-style';
  style.textContent = `
    .tt-iuw{border:1.5px dashed #d9b9c6;border-radius:12px;padding:14px;background:#fff8fa;position:relative}
    .tt-iuw.tt-iuw-drag{border-color:#AD3F67;background:#fdf0f5}
    .tt-iuw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
    .tt-iuw-label{font:700 12px/1.3 Montserrat,sans-serif;color:#2B2B2B}
    .tt-iuw-hint{font:400 11px/1.4 Montserrat,sans-serif;color:#8a8a8a;margin-top:2px}
    .tt-iuw-body{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .tt-iuw-preview{width:96px;height:96px;border-radius:10px;overflow:hidden;background:#f1e3e8;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
    .tt-iuw-preview img{width:100%;height:100%;object-fit:cover;display:block}
    .tt-iuw-preview-empty{font-size:11px;color:#b98a9c;text-align:center;padding:6px}
    .tt-iuw-drop{flex:1 1 180px;min-width:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 10px;border-radius:10px;cursor:pointer;text-align:center;background:rgba(173,63,103,.03)}
    .tt-iuw-drop:hover{background:rgba(173,63,103,.07)}
    .tt-iuw-drop-text{font:600 12px Montserrat,sans-serif;color:#AD3F67}
    .tt-iuw-drop-sub{font:400 10.5px Montserrat,sans-serif;color:#9a9a9a}
    .tt-iuw-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .tt-iuw-btn{border:1px solid #e3c3cf;background:#fff;border-radius:8px;padding:6px 12px;font:600 11.5px Montserrat,sans-serif;color:#7a3a4d;cursor:pointer}
    .tt-iuw-btn:hover{background:#fdf0f5}
    .tt-iuw-btn:disabled{opacity:.5;cursor:not-allowed}
    .tt-iuw-btn-danger{color:#b23a3a;border-color:#e8c3c3}
    .tt-iuw-btn-primary{background:#AD3F67;border-color:#AD3F67;color:#fff;flex:1 1 150px;min-width:150px}
    .tt-iuw-btn-primary:hover{background:#95355a}
    .tt-iuw-btn-primary:disabled:hover{background:#AD3F67}
    .tt-iuw-progress{margin-top:8px;height:6px;border-radius:999px;background:#f1e3e8;overflow:hidden;display:none}
    .tt-iuw-progress.show{display:block}
    .tt-iuw-progress-bar{height:100%;width:35%;background:#AD3F67;border-radius:999px;animation:tt-iuw-indeterminate 1.1s ease-in-out infinite}
    @keyframes tt-iuw-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}
    .tt-iuw-status{margin-top:8px;font:600 11.5px Montserrat,sans-serif;min-height:14px}
    .tt-iuw-status.error{color:#b23a3a}
    .tt-iuw-status.success{color:#2f8f5b}
    .tt-iuw-status.busy{color:#8a8a8a}
    .tt-iuw-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  `;
  document.head.appendChild(style);
}

function iconSvg() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/><path d="M7 9l5-5 5 5"/><path d="M12 4v13"/></svg>`;
}

/**
 * Monta el widget dentro de `container`.
 * options: value, label, hint, maxWidth, maxHeight, quality, thumbSize,
 * section, slotKey, onChange(url, meta), onOpenLibrary(), confirmRemove.
 */
export function attachImageUploadWidget(container, options = {}) {
  if (!container) return { setValue() {}, destroy() {} };
  ensureStyles();

  const {
    label = 'Imagen',
    hint = '',
    maxWidth = 2000,
    maxHeight = 2000,
    quality,
    thumbSize,
    section = 'biblioteca',
    slotKey = null,
    onChange,
    onOpenLibrary,
    confirmRemove = true,
  } = options;

  let currentUrl = options.value || '';
  let pendingFile = null;
  let pendingPreviewUrl = '';
  let busy = false;

  const root = document.createElement('div');
  root.className = 'tt-iuw';

  const head = document.createElement('div');
  head.className = 'tt-iuw-head';
  const labelEl = document.createElement('div');
  labelEl.innerHTML = `<div class="tt-iuw-label">${label}</div>${hint ? `<div class="tt-iuw-hint">${hint}</div>` : ''}`;
  head.appendChild(labelEl);

  const body = document.createElement('div');
  body.className = 'tt-iuw-body';
  const preview = document.createElement('div');
  preview.className = 'tt-iuw-preview';
  const drop = document.createElement('div');
  drop.className = 'tt-iuw-drop';
  drop.tabIndex = 0;
  drop.setAttribute('role', 'button');
  drop.innerHTML = `${iconSvg()}<div class="tt-iuw-drop-text">Clic o arrastrá una imagen</div><div class="tt-iuw-drop-sub">JPG, PNG, WebP o AVIF</div>`;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/avif';
  input.className = 'tt-iuw-input';
  body.append(preview, drop);

  const actions = document.createElement('div');
  actions.className = 'tt-iuw-actions';
  const progress = document.createElement('div');
  progress.className = 'tt-iuw-progress';
  progress.innerHTML = '<div class="tt-iuw-progress-bar"></div>';
  const status = document.createElement('div');
  status.className = 'tt-iuw-status';
  root.append(head, body, actions, progress, status, input);
  container.replaceChildren(root);

  function setStatus(message, kind = '') {
    status.textContent = message || '';
    status.className = `tt-iuw-status${kind ? ` ${kind}` : ''}`;
  }

  function setBusy(isBusy, stage) {
    busy = isBusy;
    progress.classList.toggle('show', isBusy);
    drop.style.pointerEvents = isBusy ? 'none' : '';
    if (isBusy) setStatus(STAGE_LABELS[stage] || 'Procesando…', 'busy');
    renderActions();
  }

  function renderPreview() {
    const src = pendingPreviewUrl || currentUrl;
    if (src) {
      preview.innerHTML = `<img src="${src.replace(/"/g, '&quot;')}" alt="${label.replace(/"/g, '&quot;')}">`;
    } else {
      preview.innerHTML = '<div class="tt-iuw-preview-empty">Sin imagen</div>';
    }
  }

  function createButton(text, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', handler);
    return button;
  }

  function renderActions() {
    actions.replaceChildren();
    if (busy) return;

    const confirmButton = createButton(
      'Confirmar y subir',
      'tt-iuw-btn tt-iuw-btn-primary',
      commitPendingFile
    );
    confirmButton.disabled = !pendingFile;
    confirmButton.setAttribute('aria-disabled', String(!pendingFile));
    actions.append(confirmButton);

    if (pendingFile) {
      actions.append(createButton('Cancelar', 'tt-iuw-btn', cancelPendingFile));
      return;
    }

    if (currentUrl) {
      actions.append(
        createButton('Reemplazar', 'tt-iuw-btn', () => input.click()),
        createButton('Quitar', 'tt-iuw-btn tt-iuw-btn-danger', removeImage)
      );
    }

    if (typeof onOpenLibrary === 'function') {
      actions.append(createButton('Elegir de la biblioteca', 'tt-iuw-btn', pickFromLibrary));
    }
  }

  async function cleanPreviousUrl(previousUrl, nextUrl) {
    if (!previousUrl || previousUrl === nextUrl) return;
    try {
      await deleteMediaByUrlIfUnused(previousUrl);
    } catch (error) {
      console.warn('[image-upload-widget] No se pudo limpiar la imagen anterior:', error);
    }
  }

  async function pickFromLibrary() {
    if (busy) return;
    try {
      const picked = await onOpenLibrary();
      if (!picked || picked === currentUrl) return;
      const previousUrl = currentUrl;
      setBusy(true, 'saving');
      await onChange?.(picked, { fromLibrary: true });
      currentUrl = picked;
      pendingFile = null;
      pendingPreviewUrl = '';
      await cleanPreviousUrl(previousUrl, picked);
      setBusy(false);
      renderPreview();
      renderActions();
      setStatus('Imagen elegida de la biblioteca', 'success');
    } catch (error) {
      setBusy(false);
      renderActions();
      setStatus(error?.message || 'No se pudo abrir la biblioteca.', 'error');
    }
  }

  function cancelPendingFile() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingFile = null;
    pendingPreviewUrl = '';
    renderPreview();
    renderActions();
    setStatus('Carga cancelada.');
  }

  async function removeImage() {
    if (busy || !currentUrl) return;
    if (confirmRemove && !window.confirm('¿Quitar esta imagen?')) return;
    const previousUrl = currentUrl;
    try {
      setBusy(true, 'saving');
      await onChange?.(null, null);
      currentUrl = '';
      await cleanPreviousUrl(previousUrl, '');
      setBusy(false);
      renderPreview();
      renderActions();
      setStatus('Imagen quitada', 'success');
    } catch (error) {
      setBusy(false);
      renderPreview();
      renderActions();
      setStatus(error?.message || 'No se pudo quitar la imagen.', 'error');
    }
  }

  async function handleFile(file) {
    if (!file || busy) return;
    setStatus('Validando archivo…', 'busy');
    const validation = await validateImageFile(file);
    if (!validation.ok) {
      setStatus(validation.error, 'error');
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingFile = file;
    pendingPreviewUrl = URL.createObjectURL(file);
    renderPreview();
    renderActions();
    setStatus('Vista previa lista. Confirmá para subir la imagen.');
  }

  async function commitPendingFile() {
    console.debug('[image-upload-widget] confirm clicked', { hasPendingFile: Boolean(pendingFile), busy });
    if (!pendingFile) {
      setStatus('Elegí una imagen antes de confirmar.', 'error');
      return;
    }
    if (busy) return;
    console.debug('[image-upload-widget] pending file', pendingFile.name, pendingFile.size);
    const file = pendingFile;
    const previousUrl = currentUrl;
    let result = null;
    setBusy(true, 'processing');
    try {
      result = await uploadImageToLibrary(file, {
        maxWidth,
        maxHeight,
        quality,
        thumbSize,
        section,
        slotKey,
        alt: label,
        onProgress: stage => setBusy(true, stage),
      });
      await onChange?.(result.url, result);
      currentUrl = result.url;
      await cleanPreviousUrl(previousUrl, result.url);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      pendingFile = null;
      pendingPreviewUrl = '';
      setBusy(false);
      renderPreview();
      renderActions();
      setStatus('Imagen guardada correctamente', 'success');
    } catch (error) {
      console.error('[image-upload-widget] upload failed:', error);
      if (result?.mediaId) {
        try { await deleteMediaItem(result.mediaId, { force: true }); } catch {}
      }
      setBusy(false);
      renderActions();
      setStatus(error?.message || 'No se pudo subir la imagen. Intentá de nuevo.', 'error');
    }
  }

  drop.addEventListener('click', () => { if (!busy) input.click(); });
  drop.addEventListener('keydown', event => {
    if (!busy && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach(name => {
    drop.addEventListener(name, event => {
      event.preventDefault();
      if (!busy) root.classList.add('tt-iuw-drag');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    drop.addEventListener(name, event => {
      event.preventDefault();
      root.classList.remove('tt-iuw-drag');
    });
  });
  drop.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  renderPreview();
  renderActions();

  return {
    setValue(url) {
      currentUrl = url || '';
      renderPreview();
      renderActions();
    },
    destroy() {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      container.replaceChildren();
    },
  };
}
