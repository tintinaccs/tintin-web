/* Editor local de fotos para el panel: recorta, encuadra y gira antes de subir. */

const RATIOS = Object.freeze([
  { value: 'original', label: 'Original' },
  { value: '1', label: 'Cuadrada 1:1' },
  { value: '0.8', label: 'Vertical 4:5' },
  { value: String(16 / 9), label: 'Horizontal 16:9' },
]);

function ensureStyles() {
  if (document.getElementById('tt-image-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-image-editor-style';
  style.textContent = `
    .tt-image-editor{width:min(940px,calc(100vw - 24px));max-height:min(900px,calc(100dvh - 24px));padding:0;border:0;border-radius:18px;box-shadow:0 24px 80px rgba(55,25,39,.28);color:#34262c;background:#fff;overflow:hidden}
    .tt-image-editor::backdrop{background:rgba(33,18,25,.66);backdrop-filter:blur(3px)}
    .tt-image-editor-shell{display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-height:min(900px,calc(100dvh - 24px))}
    .tt-image-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 16px;border-bottom:1px solid #eadfe4}
    .tt-image-editor-head h2{margin:0;font:600 clamp(18px,2vw,24px)/1.2 Montserrat,sans-serif;letter-spacing:-.025em;color:#382631}
    .tt-image-editor-head p{margin:6px 0 0;font:400 12px/1.5 Montserrat,sans-serif;color:#7b6d74}
    .tt-image-editor-close{width:44px;height:44px;flex:none;border:1px solid #e4d5db;border-radius:10px;background:#fff;color:#713c53;font-size:25px;line-height:1;cursor:pointer}
    .tt-image-editor-body{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:20px;min-height:0;padding:20px 22px;overflow:auto}
    .tt-image-editor-stage{display:grid;place-items:center;min-width:0;min-height:280px;padding:14px;border-radius:14px;background:#f3edf0;overflow:hidden;touch-action:none;cursor:grab}
    .tt-image-editor-stage:active{cursor:grabbing}
    .tt-image-editor-canvas{display:block;max-width:100%;max-height:min(58dvh,600px);border-radius:6px;box-shadow:0 8px 30px rgba(44,24,33,.18)}
    .tt-image-editor-controls{display:flex;flex-direction:column;gap:18px}
    .tt-image-editor-group{display:grid;gap:9px}
    .tt-image-editor-group>span,.tt-image-editor-group>label{font:600 12px/1.35 Montserrat,sans-serif;color:#5b4650}
    .tt-image-editor-ratios{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .tt-image-editor button,.tt-image-editor select,.tt-image-editor input{font-family:Montserrat,sans-serif}
    .tt-image-editor-option,.tt-image-editor-tool{min-height:44px;border:1px solid #dfcbd4;border-radius:9px;background:#fff;color:#713c53;font-size:11px;font-weight:600;cursor:pointer;padding:8px}
    .tt-image-editor-option[aria-pressed=true]{border-color:#713c53;background:#fff0f6;box-shadow:inset 0 0 0 1px #713c53}
    .tt-image-editor-zoom{width:100%;accent-color:#ad3f67}
    .tt-image-editor-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .tt-image-editor-reset{grid-column:1/-1}
    .tt-image-editor-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px 20px;border-top:1px solid #eadfe4;background:#fff}
    .tt-image-editor-action{min-height:44px;padding:10px 18px;border:1px solid #d9bdc9;border-radius:10px;background:#fff;color:#713c53;font:600 12px Montserrat,sans-serif;cursor:pointer}
    .tt-image-editor-action-primary{background:#f8aaca;border-color:#f8aaca;color:#4d2939;min-width:160px}
    .tt-image-editor-status{min-height:18px;margin:0;font:500 11px/1.4 Montserrat,sans-serif;color:#8c334e}
    @media(max-width:720px){
      .tt-image-editor{width:100vw;max-width:none;height:100dvh;max-height:none;border-radius:0}
      .tt-image-editor-shell{height:100dvh;max-height:none}
      .tt-image-editor-head{padding:14px 16px 12px}
      .tt-image-editor-body{grid-template-columns:minmax(0,1fr);padding:14px 16px;gap:14px}
      .tt-image-editor-stage{min-height:230px;padding:10px}
      .tt-image-editor-canvas{max-height:42dvh}
      .tt-image-editor-controls{gap:12px}
      .tt-image-editor-ratios{grid-template-columns:repeat(2,minmax(0,1fr))}
      .tt-image-editor-foot{padding:12px 16px max(14px,env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr}
      .tt-image-editor-action{width:100%;padding-inline:10px}
      .tt-image-editor-action-primary{min-width:0}
    }
  `;
  document.head.appendChild(style);
}

export function imageEditorGeometry(width, height, rotation, ratioValue, zoom = 1, panX = 0, panY = 0) {
  const sideways = Math.abs(rotation % 180) === 90;
  const rotatedWidth = sideways ? height : width;
  const rotatedHeight = sideways ? width : height;
  const ratio = ratioValue === 'original' ? rotatedWidth / rotatedHeight : Number(ratioValue);
  const previewWidth = ratio >= 1 ? 720 : Math.round(720 * ratio);
  const previewHeight = ratio >= 1 ? Math.round(720 / ratio) : 720;
  const scale = Math.max(previewWidth / rotatedWidth, previewHeight / rotatedHeight) * zoom;
  const maxPanX = Math.max(0, (rotatedWidth * scale - previewWidth) / 2);
  const maxPanY = Math.max(0, (rotatedHeight * scale - previewHeight) / 2);
  return {
    ratio,
    previewWidth,
    previewHeight,
    scale,
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
  };
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la foto editada.')),
    'image/webp',
    0.94,
  ));
}

function editedName(name, mime) {
  const base = String(name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const extension = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  return `${base || 'foto'}-editada.${extension}`;
}

/** Abre el editor y devuelve un File WebP, o null cuando se cancela. */
export async function openImageEditor(file, { title = 'Recortar o editar foto' } = {}) {
  if (!(file instanceof Blob)) throw new Error('Elegí una foto para editar.');
  ensureStyles();
  const bitmap = await createImageBitmap(file);

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'tt-image-editor';
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = `
      <div class="tt-image-editor-shell">
        <header class="tt-image-editor-head"><div><h2>${title}</h2><p>Arrastrá la foto para encuadrarla y ajustá el zoom.</p></div><button type="button" class="tt-image-editor-close" aria-label="Cerrar editor">×</button></header>
        <div class="tt-image-editor-body">
          <div class="tt-image-editor-stage" aria-label="Vista previa del recorte"><canvas class="tt-image-editor-canvas"></canvas></div>
          <aside class="tt-image-editor-controls">
            <div class="tt-image-editor-group"><span>Formato</span><div class="tt-image-editor-ratios"></div></div>
            <div class="tt-image-editor-group"><label for="tt-image-editor-zoom">Zoom</label><input class="tt-image-editor-zoom" id="tt-image-editor-zoom" type="range" min="1" max="3" value="1" step="0.01"></div>
            <div class="tt-image-editor-group"><span>Orientación</span><div class="tt-image-editor-tools"><button type="button" class="tt-image-editor-tool" data-rotate="-90">Girar izquierda</button><button type="button" class="tt-image-editor-tool" data-rotate="90">Girar derecha</button><button type="button" class="tt-image-editor-tool tt-image-editor-reset">Restablecer</button></div></div>
            <p class="tt-image-editor-status" role="status" aria-live="polite"></p>
          </aside>
        </div>
        <footer class="tt-image-editor-foot"><button type="button" class="tt-image-editor-action tt-image-editor-cancel">Cancelar</button><button type="button" class="tt-image-editor-action tt-image-editor-action-primary tt-image-editor-apply">Aplicar edición</button></footer>
      </div>`;
    document.body.appendChild(dialog);

    const canvas = dialog.querySelector('canvas');
    const context = canvas.getContext('2d');
    const stage = dialog.querySelector('.tt-image-editor-stage');
    const zoomInput = dialog.querySelector('.tt-image-editor-zoom');
    const ratioHost = dialog.querySelector('.tt-image-editor-ratios');
    const status = dialog.querySelector('.tt-image-editor-status');
    const apply = dialog.querySelector('.tt-image-editor-apply');
    let ratioValue = 'original', rotation = 0, zoom = 1, panX = 0, panY = 0, dragging = null, finished = false;

    for (const ratio of RATIOS) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'tt-image-editor-option';
      option.textContent = ratio.label;
      option.dataset.ratio = ratio.value;
      option.setAttribute('aria-pressed', String(ratio.value === ratioValue));
      option.addEventListener('click', () => {
        ratioValue = ratio.value; panX = 0; panY = 0;
        ratioHost.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === option)));
        draw();
      });
      ratioHost.appendChild(option);
    }

    function geometry() {
      return imageEditorGeometry(bitmap.width, bitmap.height, rotation, ratioValue, zoom, panX, panY);
    }

    function draw(target = canvas, outputScale = 1) {
      const geo = geometry();
      panX = geo.panX; panY = geo.panY;
      target.width = Math.max(1, Math.round(geo.previewWidth * outputScale));
      target.height = Math.max(1, Math.round(geo.previewHeight * outputScale));
      const ctx = target === canvas ? context : target.getContext('2d');
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.translate(target.width / 2 + panX * outputScale, target.height / 2 + panY * outputScale);
      ctx.rotate(rotation * Math.PI / 180);
      const scale = geo.scale * outputScale;
      ctx.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale);
      ctx.restore();
    }

    zoomInput.addEventListener('input', () => { zoom = Number(zoomInput.value); draw(); });
    dialog.querySelectorAll('[data-rotate]').forEach(button => button.addEventListener('click', () => {
      rotation = (rotation + Number(button.dataset.rotate) + 360) % 360;
      panX = 0; panY = 0; draw();
    }));
    dialog.querySelector('.tt-image-editor-reset').addEventListener('click', () => {
      ratioValue = 'original'; rotation = 0; zoom = 1; panX = 0; panY = 0; zoomInput.value = '1';
      ratioHost.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ratio === ratioValue)));
      draw();
    });

    stage.addEventListener('pointerdown', event => {
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
      if (!dragging || dragging.id !== event.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      const factor = canvas.width / Math.max(1, rect.width);
      panX += (event.clientX - dragging.x) * factor;
      panY += (event.clientY - dragging.y) * factor;
      dragging.x = event.clientX; dragging.y = event.clientY; draw();
    });
    const stopDrag = () => { dragging = null; };
    stage.addEventListener('pointerup', stopDrag);
    stage.addEventListener('pointercancel', stopDrag);

    function finish(value) {
      if (finished) return;
      finished = true;
      bitmap.close?.();
      dialog.close();
      dialog.remove();
      resolve(value);
    }
    const cancel = () => finish(null);
    dialog.querySelector('.tt-image-editor-close').addEventListener('click', cancel);
    dialog.querySelector('.tt-image-editor-cancel').addEventListener('click', cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) cancel(); });
    apply.addEventListener('click', async () => {
      apply.disabled = true; status.textContent = 'Preparando foto…';
      try {
        const geo = geometry();
        const outputScale = 1800 / Math.max(geo.previewWidth, geo.previewHeight);
        const output = document.createElement('canvas');
        draw(output, outputScale);
        const blob = await canvasBlob(output);
        finish(new File([blob], editedName(file.name, blob.type), { type: blob.type, lastModified: Date.now() }));
      } catch (error) {
        status.textContent = error?.message || 'No se pudo aplicar la edición.';
        apply.disabled = false;
      }
    });

    draw();
    dialog.showModal();
  });
}
