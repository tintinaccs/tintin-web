/**
 * Selector visual de color reutilizable para Super Admin -> Apariencia.
 *
 * La edición se mantiene dentro del selector hasta que el usuario confirma.
 * onPreview permite actualizar la vista previa sin ensuciar el borrador;
 * onConfirm persiste el valor en el estado del módulo; onCancel restaura el
 * valor anterior. Acepta HEX, RGB(A) y HSL(A), e integra EyeDropper cuando el
 * navegador lo ofrece.
 */
import { parseColor, isValidColor } from './color-contrast-utils.js?v=tintin-20260716-diagnostic-fixes-2';

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .tcp-pop{position:fixed;z-index:9000;width:min(344px,calc(100vw - 20px));max-height:calc(100vh - 20px);overflow:auto;background:var(--admin-color-background-surface,#fff);border:1px solid var(--admin-color-border,#F1E4E7);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.2);padding:14px;font-family:"Montserrat"}
    .tcp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .tcp-title{font-size:13px;font-weight:800;color:var(--admin-color-text-title,#2B2B2B)}
    .tcp-subtitle{font-size:10.5px;line-height:1.35;color:var(--admin-color-text-secondary,#7B6F72);margin-top:2px;overflow-wrap:anywhere}
    .tcp-close{width:28px;height:28px;padding:0;border-radius:8px}
    .tcp-sv{position:relative;width:100%;height:142px;border-radius:10px;cursor:crosshair;margin-bottom:12px;overflow:hidden;touch-action:none}
    .tcp-sv-white{position:absolute;inset:0;background:linear-gradient(to right,#fff,transparent)}
    .tcp-sv-black{position:absolute;inset:0;background:linear-gradient(to top,#000,transparent)}
    .tcp-sv-cursor{position:absolute;width:15px;height:15px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);pointer-events:none}
    .tcp-control{display:grid;grid-template-columns:24px minmax(0,1fr) 50px;align-items:center;gap:8px;margin-bottom:8px}
    .tcp-control label{font-size:10.5px;font-weight:800;color:var(--admin-color-text-secondary,#7B6F72);text-align:center}
    .tcp-range{width:100%;accent-color:var(--admin-color-brand,#AD3F67);cursor:pointer}
    .tcp-number{width:50px;padding:5px 4px;border:1px solid var(--admin-color-field-border,#F1E4E7);border-radius:7px;font-size:11px;text-align:center;font-family:"Montserrat";color:var(--admin-color-text-primary,#2B2B2B);background:var(--admin-color-field-background,#fff)}
    .tcp-preview-row{display:flex;gap:8px;align-items:center;margin:11px 0}
    .tcp-preview{flex:1;height:38px;border-radius:9px;border:1px solid var(--admin-color-border,#F1E4E7);position:relative;overflow:hidden;background-image:linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0}
    .tcp-preview-color{position:absolute;inset:0}
    .tcp-preview-label{position:absolute;z-index:1;bottom:3px;left:6px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:rgba(0,0,0,.62);background:rgba(255,255,255,.82);padding:1px 5px;border-radius:4px}
    .tcp-input-row{display:flex;gap:6px;margin-bottom:6px}
    .tcp-input{flex:1;min-width:0;padding:8px 9px;border:1px solid var(--admin-color-field-border,#F1E4E7);border-radius:9px;font-size:12px;font-family:"Montserrat";color:var(--admin-color-text-primary,#2B2B2B);background:var(--admin-color-field-background,#fff)}
    .tcp-input.tcp-invalid{border-color:var(--admin-color-error-text,#b8341f);box-shadow:0 0 0 2px var(--admin-color-error-background,#fde3e1)}
    .tcp-err{font-size:10.5px;color:var(--admin-color-error-text,#b8341f);margin:0 0 8px}
    .tcp-btnrow{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
    .tcp-btn{border:1px solid var(--admin-color-border,#F1E4E7);background:var(--admin-color-background-surface,#fff);color:var(--admin-color-text-primary,#2B2B2B);border-radius:8px;padding:7px 9px;font-size:11px;font-family:"Montserrat";font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
    .tcp-btn:hover{background:var(--admin-color-background-page,#FFF6FA)}
    .tcp-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid var(--admin-color-border,#F1E4E7)}
    .tcp-cancel{background:var(--admin-color-background-surface,#fff);color:var(--admin-color-button-outline-text,#AD3F67);border-color:var(--admin-color-button-outline-text,#AD3F67)}
    .tcp-confirm{background:var(--admin-color-button-primary-background,#AD3F67);color:var(--admin-color-button-primary-text,#fff);border-color:var(--admin-color-button-primary-background,#AD3F67)}
    .tcp-confirm:hover{background:var(--admin-color-button-primary-hover,#8B2642)}
    .tcp-swatch{width:30px;height:30px;border-radius:8px;border:1px solid var(--admin-color-border,#F1E4E7);cursor:pointer;flex-shrink:0;background-size:8px 8px}
    @media (max-width:520px){.tcp-pop{width:calc(100vw - 16px);padding:12px}.tcp-sv{height:128px}}
  `;
  document.head.appendChild(style);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function toHexAlpha({ r, g, b, a }) {
  const hex = value => Math.round(value).toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ''}`;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function normalizedColor(value, fallback = '#AD3F67') {
  const parsed = parseColor(value) || parseColor(fallback);
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  return { h: hsl.h, s: hsl.s, l: hsl.l, a: parsed.a };
}

export function attachColorPicker(triggerEl, opts = {}) {
  injectStyles();
  const initialValue = isValidColor(opts.value) ? opts.value : '#AD3F67';
  const initial = normalizedColor(initialValue);
  const state = {
    committed: initialValue,
    sessionOriginal: initialValue,
    h: initial.h,
    s: initial.s,
    l: initial.l,
    a: initial.a,
    open: false,
  };

  let pop = null;

  function currentRgb() {
    return hslToRgb(state.h, state.s, state.l);
  }

  function currentValue() {
    const { r, g, b } = currentRgb();
    return toHexAlpha({ r, g, b, a: state.a });
  }

  function setInternalValue(value) {
    if (!isValidColor(value)) return false;
    const next = normalizedColor(value);
    state.h = next.h;
    state.s = next.s;
    state.l = next.l;
    state.a = next.a;
    return true;
  }

  function updateTriggerSwatch(value = currentValue()) {
    triggerEl.style.setProperty('--tcp-current', value);
    if (triggerEl.classList.contains('tcp-swatch') || triggerEl.dataset.tcpSwatch) {
      triggerEl.style.background = value;
    }
  }

  updateTriggerSwatch(state.committed);

  function removePopover() {
    if (pop) {
      pop.remove();
      pop = null;
    }
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', positionPop);
    state.open = false;
  }

  function cancel() {
    const previous = state.sessionOriginal;
    setInternalValue(previous);
    updateTriggerSwatch(previous);
    opts.onCancel?.(previous);
    removePopover();
  }

  function confirmSelection() {
    const value = currentValue();
    const previous = state.sessionOriginal;
    state.committed = value;
    updateTriggerSwatch(value);
    opts.onConfirm?.(value, previous);
    if (!opts.onConfirm) opts.onChange?.(value);
    removePopover();
  }

  function onOutside(event) {
    if (pop && !pop.contains(event.target) && event.target !== triggerEl) cancel();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  function preview(value) {
    updateTriggerSwatch(value);
    if (opts.onPreview) opts.onPreview(value);
    else if (!opts.onConfirm) opts.onChange?.(value);
  }

  function open() {
    if (pop) return;
    state.open = true;
    state.sessionOriginal = state.committed;
    setInternalValue(state.committed);

    pop = document.createElement('div');
    pop.className = 'tcp-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-label', `Selector de color: ${opts.label || 'color'}`);
    pop.innerHTML = `
      <div class="tcp-head">
        <div>
          <div class="tcp-title">${opts.label || 'Editar color'}</div>
          ${opts.cssVar ? `<div class="tcp-subtitle">${opts.cssVar}</div>` : ''}
        </div>
        <button type="button" class="tcp-btn tcp-close" data-tcp="close" aria-label="Cancelar y cerrar">×</button>
      </div>
      <div class="tcp-sv" data-tcp="sv" aria-label="Paleta visual de saturación y luminosidad">
        <div class="tcp-sv-white"></div>
        <div class="tcp-sv-black"></div>
        <div class="tcp-sv-cursor" data-tcp="sv-cursor"></div>
      </div>
      <div class="tcp-control">
        <label for="tcp-h-${Date.now()}">H</label>
        <input class="tcp-range" data-tcp="h-range" type="range" min="0" max="360" step="1">
        <input class="tcp-number" data-tcp="h-number" type="number" min="0" max="360" step="1" aria-label="Tono">
      </div>
      <div class="tcp-control">
        <label>S</label>
        <input class="tcp-range" data-tcp="s-range" type="range" min="0" max="100" step="1">
        <input class="tcp-number" data-tcp="s-number" type="number" min="0" max="100" step="1" aria-label="Saturación">
      </div>
      <div class="tcp-control">
        <label>L</label>
        <input class="tcp-range" data-tcp="l-range" type="range" min="0" max="100" step="1">
        <input class="tcp-number" data-tcp="l-number" type="number" min="0" max="100" step="1" aria-label="Luminosidad">
      </div>
      <div class="tcp-control">
        <label>A</label>
        <input class="tcp-range" data-tcp="a-range" type="range" min="0" max="100" step="1">
        <input class="tcp-number" data-tcp="a-number" type="number" min="0" max="100" step="1" aria-label="Opacidad">
      </div>
      <div class="tcp-preview-row">
        <div class="tcp-preview"><div class="tcp-preview-color" data-tcp="preview-old"></div><span class="tcp-preview-label">Anterior</span></div>
        <div class="tcp-preview"><div class="tcp-preview-color" data-tcp="preview-now"></div><span class="tcp-preview-label">Nuevo</span></div>
      </div>
      <div class="tcp-input-row">
        <input type="text" class="tcp-input" data-tcp="text-input" spellcheck="false" aria-label="Color en HEX, RGB o HSL" placeholder="#AD3F67, rgb(...), hsl(...)">
      </div>
      <div class="tcp-err" data-tcp="err" role="alert" style="display:none">Ingresá un valor HEX, RGB o HSL válido.</div>
      <div class="tcp-btnrow">
        <button type="button" class="tcp-btn" data-tcp="copy">Copiar</button>
        <button type="button" class="tcp-btn" data-tcp="paste">Pegar</button>
        ${window.EyeDropper ? '<button type="button" class="tcp-btn" data-tcp="eyedrop">Cuentagotas</button>' : ''}
        <button type="button" class="tcp-btn" data-tcp="reset">Restablecer color</button>
      </div>
      ${opts.impact ? `<div class="tcp-subtitle" style="margin:0 0 10px"><strong>Impacto:</strong> ${opts.impact}</div>` : ''}
      <div class="tcp-actions">
        <button type="button" class="tcp-btn tcp-cancel" data-tcp="cancel">Cancelar</button>
        <button type="button" class="tcp-btn tcp-confirm" data-tcp="confirm">Confirmar cambio</button>
      </div>
    `;
    document.body.appendChild(pop);
    positionPop();

    const svEl = pop.querySelector('[data-tcp="sv"]');
    const svCursor = pop.querySelector('[data-tcp="sv-cursor"]');
    const hRange = pop.querySelector('[data-tcp="h-range"]');
    const sRange = pop.querySelector('[data-tcp="s-range"]');
    const lRange = pop.querySelector('[data-tcp="l-range"]');
    const aRange = pop.querySelector('[data-tcp="a-range"]');
    const hNumber = pop.querySelector('[data-tcp="h-number"]');
    const sNumber = pop.querySelector('[data-tcp="s-number"]');
    const lNumber = pop.querySelector('[data-tcp="l-number"]');
    const aNumber = pop.querySelector('[data-tcp="a-number"]');
    const textInput = pop.querySelector('[data-tcp="text-input"]');
    const errEl = pop.querySelector('[data-tcp="err"]');
    const previewOld = pop.querySelector('[data-tcp="preview-old"]');
    const previewNow = pop.querySelector('[data-tcp="preview-now"]');

    function render({ preserveText = false } = {}) {
      const value = currentValue();
      svEl.style.backgroundColor = `hsl(${state.h} 100% 50%)`;
      svCursor.style.left = `${state.s * 100}%`;
      svCursor.style.top = `${(1 - state.l) * 100}%`;
      hRange.value = String(Math.round(state.h));
      sRange.value = String(Math.round(state.s * 100));
      lRange.value = String(Math.round(state.l * 100));
      aRange.value = String(Math.round(state.a * 100));
      hNumber.value = hRange.value;
      sNumber.value = sRange.value;
      lNumber.value = lRange.value;
      aNumber.value = aRange.value;
      previewOld.style.background = state.sessionOriginal;
      previewNow.style.background = value;
      if (!preserveText) textInput.value = value;
      textInput.classList.remove('tcp-invalid');
      errEl.style.display = 'none';
      preview(value);
    }

    function applyManualValue() {
      const value = textInput.value.trim();
      if (!isValidColor(value)) {
        textInput.classList.add('tcp-invalid');
        errEl.style.display = 'block';
        return false;
      }
      setInternalValue(value);
      render({ preserveText: true });
      return true;
    }

    function bindPair(range, number, setter) {
      range.addEventListener('input', () => {
        setter(Number(range.value));
        render();
      });
      number.addEventListener('input', () => {
        setter(Number(number.value));
        render();
      });
    }

    bindPair(hRange, hNumber, value => { state.h = clamp(value, 0, 360); });
    bindPair(sRange, sNumber, value => { state.s = clamp(value, 0, 100) / 100; });
    bindPair(lRange, lNumber, value => { state.l = clamp(value, 0, 100) / 100; });
    bindPair(aRange, aNumber, value => { state.a = clamp(value, 0, 100) / 100; });

    function startPaletteDrag(startEvent) {
      startEvent.preventDefault();
      const move = event => {
        const point = event.touches ? event.touches[0] : event;
        const rect = svEl.getBoundingClientRect();
        state.s = clamp((point.clientX - rect.left) / rect.width, 0, 1);
        state.l = 1 - clamp((point.clientY - rect.top) / rect.height, 0, 1);
        render();
      };
      const stop = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', stop);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', stop);
      };
      move(startEvent);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', stop);
    }

    svEl.addEventListener('mousedown', startPaletteDrag);
    svEl.addEventListener('touchstart', startPaletteDrag, { passive: false });

    textInput.addEventListener('input', () => {
      const value = textInput.value.trim();
      if (!isValidColor(value)) {
        textInput.classList.add('tcp-invalid');
        errEl.style.display = 'block';
        return;
      }
      applyManualValue();
    });
    textInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && applyManualValue()) confirmSelection();
    });

    pop.querySelector('[data-tcp="copy"]').addEventListener('click', () => {
      navigator.clipboard?.writeText(currentValue()).catch(() => {});
    });
    pop.querySelector('[data-tcp="paste"]').addEventListener('click', async () => {
      try {
        const value = (await navigator.clipboard.readText()).trim();
        if (!setInternalValue(value)) {
          textInput.value = value;
          textInput.classList.add('tcp-invalid');
          errEl.style.display = 'block';
          return;
        }
        render();
      } catch (error) {
        errEl.textContent = 'El navegador no permitió leer el portapapeles.';
        errEl.style.display = 'block';
      }
    });

    const eyedropper = pop.querySelector('[data-tcp="eyedrop"]');
    eyedropper?.addEventListener('click', async () => {
      try {
        const result = await new window.EyeDropper().open();
        if (setInternalValue(result.sRGBHex)) render();
      } catch (error) {
        // Cerrar el cuentagotas sin elegir un color no modifica el borrador.
      }
    });

    pop.querySelector('[data-tcp="reset"]').addEventListener('click', () => {
      let resetValue = opts.defaultValue;
      if (!resetValue && opts.onReset) resetValue = opts.onReset();
      if (setInternalValue(resetValue)) render();
    });
    pop.querySelector('[data-tcp="close"]').addEventListener('click', cancel);
    pop.querySelector('[data-tcp="cancel"]').addEventListener('click', cancel);
    pop.querySelector('[data-tcp="confirm"]').addEventListener('click', () => {
      if (textInput.classList.contains('tcp-invalid') && !applyManualValue()) return;
      confirmSelection();
    });

    render();
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKeydown, true);
    }, 0);
    window.addEventListener('resize', positionPop);
  }

  function positionPop() {
    if (!pop) return;
    const rect = triggerEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const popWidth = popRect.width || 344;
    const popHeight = Math.min(popRect.height || 600, window.innerHeight - 20);
    let top = rect.bottom + 7;
    let left = rect.left;
    if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8;
    if (top + popHeight > window.innerHeight - 8) top = Math.max(8, rect.top - popHeight - 7);
    pop.style.top = `${Math.max(8, top)}px`;
    pop.style.left = `${Math.max(8, left)}px`;
  }

  triggerEl.addEventListener('click', event => {
    event.preventDefault();
    if (state.open) cancel();
    else open();
  });

  return {
    getValue: currentValue,
    open,
    cancel,
    close: cancel,
    setValue(value) {
      if (!setInternalValue(value)) return;
      state.committed = value;
      updateTriggerSwatch(value);
    },
  };
}
