/* =============================================================
   TINTIN — Widget reutilizable de carga de imágenes

   Reemplaza cualquier <input type="url"> por un componente visual de carga
   directa: clic, arrastrar y soltar, previsualización, progreso, reemplazo,
   borrado y biblioteca. El procesamiento ocurre en el navegador y la subida
   real se realiza con firmas temporales de Cloudinary emitidas por Cloudflare.
   ============================================================= */

import { validateImageFile } from './procesamiento-imagenes.js?v=tintin-20261016-images-fidelity-1';
import {
  deleteMediaByUrlIfUnused,
  deleteMediaItem,
  uploadImageToLibrary
} from './biblioteca-multimedia.js?v=tintin-20261019-variant-links-1';

const STAGE_LABELS = {
  validating: 'Validando archivo…',
  processing: 'Optimizando imagen…',
  uploading: 'Subiendo…',
  saving: 'Guardando…',
};

function debugImageFlow(...args) {
  try {
    if (localStorage.getItem('tt_debug_images') === '1') console.debug(...args);
  } catch {}
}

function ensureStyles() {
  if (document.getElementById('tt-image-upload-widget-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-image-upload-widget-style';
  style.textContent = `
    .tt-iuw{border:1.5px dashed #d9b9c6;border-radius:12px;padding:14px;background:#fff8fa;position:relative}
    .tt-iuw.tt-iuw-drag{border-color:#F8AACA;background:#fdf0f5}
    .tt-iuw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
    .tt-iuw-label{font:700 12px/1.3 Montserrat,sans-serif;color:#713C53}
    .tt-iuw-hint{font:400 11px/1.4 Montserrat,sans-serif;color:#8a8a8a;margin-top:2px}
    .tt-iuw-body{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .tt-iuw-preview{width:96px;height:96px;border-radius:10px;overflow:hidden;background:#f1e3e8;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
    .tt-iuw-preview img{width:100%;height:100%;object-fit:cover;display:block}
    .tt-iuw-preview-empty{font-size:11px;color:#b98a9c;text-align:center;padding:6px}
    .tt-iuw-drop{flex:1 1 180px;min-width:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 10px;border-radius:10px;cursor:pointer;text-align:center;background:rgba(173,63,103,.03)}
    .tt-iuw-drop>svg{box-sizing:content-box;width:22px;height:22px;padding:8px;border-radius:10px;background:#F8AACA;color:#713C53;stroke:currentColor}
    .tt-iuw-drop:hover{background:rgba(173,63,103,.07)}
    .tt-iuw-drop-text{font:600 12px Montserrat,sans-serif;color:#713C53}
    .tt-iuw-drop-sub{font:400 10.5px Montserrat,sans-serif;color:#9a9a9a}
    .tt-iuw-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .tt-iuw-btn{border:1px solid #e3c3cf;background:#fff;border-radius:8px;padding:6px 12px;font:600 11.5px Montserrat,sans-serif;color:#713C53;cursor:pointer}
    .tt-iuw-btn:hover{background:#fdf0f5}
    .tt-iuw-btn:disabled{opacity:.5;cursor:not-allowed}
    .tt-iuw-btn-danger{color:#b23a3a;border-color:#e8c3c3}
    .tt-iuw-btn-primary{background:#F8AACA;border-color:#F8AACA;color:#713C53;flex:1 1 150px;min-width:150px}
    .tt-iuw-upload-action-icon{display:inline-flex;align-items:center;margin-right:6px;color:#fff;vertical-align:middle}
    .tt-iuw-btn-primary:hover{background:#F8AACA}
    .tt-iuw-btn-primary:disabled:hover{background:#F8AACA}
    .tt-iuw-progress{margin-top:8px;height:6px;border-radius:999px;background:#f1e3e8;overflow:hidden;display:none}
    .tt-iuw-progress.show{display:block}
    .tt-iuw-progress-bar{height:100%;width:35%;background:#F8AACA;border-radius:999px;animation:tt-iuw-indeterminate 1.1s ease-in-out infinite}
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
  return `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/><path d="M7 9l5-5 5 5"/><path d="M12 4v13"/></svg>`;
}

/**
 * Monta el widget dentro de `container`.
 * options: value, label, hint, maxWidth, maxHeight, quality, thumbSize,
 * section, slotKey, onChange(url, meta), onOpenLibrary(), confirmRemove,
 * cleanupPrevious (false para un cargador que agrega varias fotos).
 */
export function attachImageUploadWidget(container, options = {}) {
  if (!container) return { setValue() {}, destroy() {} };
  ensureStyles();

  const {
    label = 'Imagen',
    hint = '',
    maxWidth,
    maxHeight,
    quality,
    thumbSize,
    section = 'biblioteca',
    slotKey = null,
    onChange,
    onOpenLibrary,
    confirmRemove = true,
    cleanupPrevious = true,
  } = options;

  let currentUrl = options.value || '';
  let pendingFile = null;
  let pendingPreviewUrl = '';
  let busy = false;
  let validation = Promise.resolve(), operation = null, failure = null, destroyed = false;

  function runOperation(action) {
    if (operation) return operation;
    operation = Promise.resolve().then(action).finally(() => { operation = null; });
    return operation;
  }

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
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
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
    container.dispatchEvent(new CustomEvent('tintin:image-preview', { bubbles: true,
      detail: { url: pendingPreviewUrl, pending: !!pendingFile } }));
  }

  function createButton(text, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    if (className.includes('tt-iuw-btn-primary')) {
      const icon = document.createElement('span');
      icon.className = 'tt-iuw-upload-action-icon';
      icon.innerHTML = iconSvg();
      button.prepend(icon);
    }
    button.addEventListener('click', () => runOperation(handler));
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
    if (!cleanupPrevious || !previousUrl || previousUrl === nextUrl) return;
    try {
      await deleteMediaByUrlIfUnused(previousUrl);
    } catch (error) {
      console.warn('[image-upload-widget] No se pudo limpiar la imagen anterior:', error);
    }
  }

  async function pickFromLibrary() {
    if (busy) return;
    failure = null;
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
      failure = error;
      setStatus(error?.message || 'No se pudo abrir la biblioteca.', 'error');
    }
  }

  function cancelPendingFile() {
    failure = null;
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
    failure = null;
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
      failure = error;
      setStatus(error?.message || 'No se pudo quitar la imagen.', 'error');
    }
  }

  async function handleFile(file) {
    if (!file || busy) return;
    failure = null;
    setBusy(true, 'validating');
    const result = await validateImageFile(file);
    setBusy(false);
    if (destroyed) return;
    if (!result.ok) {
      failure = new Error(result.error);
      setStatus(result.error, 'error');
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingFile = file;
    pendingPreviewUrl = URL.createObjectURL(file);
    renderPreview();
    renderActions();
    setStatus('Vista previa lista. Podés subirla ahora o al guardar el formulario.');
  }

  async function commitPendingFile() {
    debugImageFlow('[image-upload-widget] confirm clicked', { hasPendingFile: Boolean(pendingFile), busy });
    if (!pendingFile) {
      setStatus('Elegí una imagen antes de confirmar.', 'error');
      return;
    }
    if (busy) return;
    const file = pendingFile;
    const previousUrl = currentUrl;
    let result = null;
    setBusy(true, 'processing');
    failure = null;
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
      if (destroyed) throw new Error('El formulario cambió. Volvé a elegir la foto.');
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
      failure = error;
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
    if (file) validation = handleFile(file);
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
    if (file) validation = handleFile(file);
  });

  renderPreview();
  renderActions();

  return {
    hasPending() { return busy || !!pendingFile; },
    pendingSignature() {return pendingFile ? [pendingFile.name,pendingFile.size,pendingFile.lastModified] : busy ? ['processing'] : [];},
    async flush() {
      await validation;
      if (operation) await operation;
      if (failure) throw failure;
      if (pendingFile) await runOperation(commitPendingFile);
      if (failure) throw failure;
      if (destroyed) throw new Error('El formulario cambió. Volvé a abrirlo antes de guardar.');
    },
    setValue(url, {discardPending = false} = {}) {
      if(discardPending) {if(pendingPreviewUrl)URL.revokeObjectURL(pendingPreviewUrl);pendingFile=null;pendingPreviewUrl='';failure=null;}
      currentUrl = url || '';
      renderPreview();
      renderActions();
    },
    destroy() {
      destroyed = true;
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      container.replaceChildren();
    },
  };
}

// Cola visual del mismo transporte y validación que la carga individual.
// Un fallo conserva las fotos pendientes; guardar espera toda la cola.
export function attachMultiImageUploadWidget(container, {onChange, onOpenLibrary, remaining = () => 12} = {}) {
  ensureStyles();
  const root = document.createElement('div');root.className='tt-iuw tt-iuw-multiple';
  const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/jpeg,image/png,image/webp,image/avif';input.className='tt-iuw-input';input.setAttribute('aria-label','Subir varias fotos');
  const drop=document.createElement('button');drop.type='button';drop.className='tt-iuw-drop';drop.textContent='Subir fotos o arrastrarlas aquí';
  const hint=document.createElement('p');hint.className='tt-iuw-hint';hint.textContent='Elegí varias juntas. Se suben al confirmar o guardar el producto.';
  const grid=document.createElement('div');grid.className='tt-editor-upload-queue';
  const actions=document.createElement('div');actions.className='tt-iuw-actions';
  const confirm=document.createElement('button');confirm.type='button';confirm.className='tt-iuw-btn tt-iuw-btn-primary';confirm.textContent='Confirmar y subir fotos';
  const library=document.createElement('button');library.type='button';library.className='tt-iuw-btn';library.textContent='Elegir de la biblioteca';library.hidden=typeof onOpenLibrary!=='function';
  const status=document.createElement('p');status.className='tt-iuw-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  actions.append(confirm,library);root.append(drop,hint,grid,actions,status,input);container.replaceChildren(root);
  let queue=[], destroyed=false, operation=null, validation=Promise.resolve(), validating=0;
  const busy=()=>!!operation;
  function render() {
    grid.replaceChildren();
    for(const item of queue) {
      const tile=document.createElement('div');tile.className='tt-editor-upload-item';
      const image=document.createElement('img');image.src=item.preview;image.alt=item.file.name;
      const remove=document.createElement('button');remove.type='button';remove.className='tt-iuw-btn';remove.textContent='Quitar';remove.setAttribute('aria-label',`Quitar pendiente ${item.file.name}`);remove.disabled=busy();
      remove.addEventListener('click',()=>{queue=queue.filter(other=>other!==item);URL.revokeObjectURL(item.preview);render();});
      tile.append(image,remove);grid.append(tile);
    }
    confirm.hidden=!queue.length && !busy();confirm.disabled=!queue.length || busy();drop.disabled=library.disabled=busy();input.disabled=busy();
    root.setAttribute('aria-busy',String(busy()));
  }
  function addFiles(files) {
    if (destroyed || busy()) return;
    const selected=Array.from(files || []);
    validating++;
    if(selected.length)container.dispatchEvent(new CustomEvent('tintin:image-pending',{bubbles:true,detail:{pending:true}}));
    validation=validation.then(async()=>{
      let rejected=0;
      for(const file of selected) {
        if(destroyed) return;
        if(queue.some(item=>item.file.name===file.name && item.file.size===file.size && item.file.lastModified===file.lastModified)) continue;
        if(queue.length>=Math.max(0,remaining())) {rejected++;continue;}
        const verdict=await validateImageFile(file);
        if(destroyed) return;
        if(!verdict.ok){rejected++;continue;}
        queue.push({file,preview:URL.createObjectURL(file)});
      }
      status.textContent=`${queue.length} foto${queue.length===1?'':'s'} pendiente${queue.length===1?'':'s'}.${rejected ? ` ${rejected} no se agregaron: revisá el formato, tamaño o límite de 12 fotos de galería.` : ''}`;
      render();
    }).catch(error=>{status.textContent=error.message;}).finally(()=>{validating--;});
    return validation;
  }
  async function upload() {
    await validation;
    if(destroyed) throw new Error('El producto cambió. Volvé a abrir su galería.');
    if(operation) return operation;
    if(!queue.length) return;
    operation=(async()=>{
      while(queue.length) {
        if(destroyed) throw new Error('El producto cambió durante la carga.');
        if(remaining()<1) throw new Error('La galería admite hasta 12 fotos. Quitá una antes de continuar.');
        const item=queue[0];
        status.textContent=`Subiendo ${item.file.name} · ${queue.length} pendiente${queue.length===1?'':'s'}…`;
        const result=await uploadImageToLibrary(item.file,{section:'productos'});
        try {
          if(destroyed) throw new Error('El producto cambió durante la carga.');
          await onChange?.(result.url,result);
        } catch(error) {
          if(result.mediaId) {try {await deleteMediaItem(result.mediaId,{force:true});} catch {}}
          throw error;
        }
        queue.shift();URL.revokeObjectURL(item.preview);
      }
      status.textContent='Fotos listas. Guardá el producto para publicar los cambios.';
    })().catch(error=>{status.textContent=error.message || 'No se pudo subir. Las fotos pendientes se conservan.';throw error;}).finally(()=>{operation=null;if(!destroyed)render();});
    render();return operation;
  }
  drop.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{void addFiles(input.files);input.value='';});
  for(const name of ['dragenter','dragover'])root.addEventListener(name,event=>{event.preventDefault();root.classList.add('tt-iuw-drag');});
  for(const name of ['dragleave','drop'])root.addEventListener(name,event=>{event.preventDefault();root.classList.remove('tt-iuw-drag');});
  root.addEventListener('drop',event=>void addFiles(event.dataTransfer.files));
  confirm.addEventListener('click',()=>void upload().catch(()=>{}));
  library.addEventListener('click',async()=>{
    if(busy())return;
    try {const url=await onOpenLibrary();if(!url)return;if(destroyed)throw new Error('El producto cambió. Volvé a elegir la foto.');if(remaining()<1)throw new Error('La galería admite hasta 12 fotos.');await onChange?.(url,{fromLibrary:true});}
    catch(error){status.textContent=error.message || 'No pudimos abrir la biblioteca.';}
  });
  render();
  return {flush:upload,hasPending:()=>!!queue.length || busy() || validating>0,pendingSignature:()=>[validating,...queue.map(item=>[item.file.name,item.file.size,item.file.lastModified])],setValue(){},destroy(){destroyed=true;for(const item of queue)URL.revokeObjectURL(item.preview);container.replaceChildren();}};
}
