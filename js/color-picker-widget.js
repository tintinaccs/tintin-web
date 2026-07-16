/**
 * TINTIN — Selector visual de color reutilizable (Super Admin → Apariencia).
 * Sin dependencias externas: espectro cromático (saturación/brillo) +
 * control de tono + control de opacidad + entrada manual de código
 * (hex 3/6/8, rgb, rgba, hsl, hsla) + cuentagotas (EyeDropper API cuando el
 * navegador la soporta) + copiar/pegar + restablecer + vista "antes/ahora".
 *
 * Uso: attachColorPicker(triggerEl, { value, onChange, onReset, label })
 * — triggerEl es el botón/swatch que abre el popover; onChange(value) se
 * llama en vivo mientras se edita (para la vista previa); onReset() se
 * llama al presionar "Restablecer".
 */
import { parseColor, isValidColor } from './color-contrast-utils.js';

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .tcp-pop{position:fixed;z-index:9000;width:264px;background:var(--admin-color-background-surface,#fff);border:1px solid var(--admin-color-border,#F1E4E7);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:14px}
    .tcp-sv{position:relative;width:100%;height:130px;border-radius:8px;cursor:crosshair;margin-bottom:10px;overflow:hidden}
    .tcp-sv-white{position:absolute;inset:0;background:linear-gradient(to right,#fff,transparent)}
    .tcp-sv-black{position:absolute;inset:0;background:linear-gradient(to top,#000,transparent)}
    .tcp-sv-cursor{position:absolute;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 1px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);pointer-events:none}
    .tcp-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .tcp-slider{position:relative;flex:1;height:14px;border-radius:7px;cursor:pointer}
    .tcp-hue{background:linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)}
    .tcp-alpha{background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0}
    .tcp-alpha-fill{position:absolute;inset:0;border-radius:7px}
    .tcp-thumb{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.3);transform:translate(-50%,-50%);cursor:grab}
    .tcp-input-row{display:flex;gap:6px;margin-bottom:8px}
    .tcp-input{flex:1;min-width:0;padding:7px 8px;border:1px solid var(--admin-color-field-border,#F1E4E7);border-radius:8px;font-size:12.5px;color:var(--admin-color-text-primary,#2B2B2B);background:var(--admin-color-field-background,#fff)}
    .tcp-input.tcp-invalid{border-color:var(--admin-color-error-text,#b8341f)}
    .tcp-err{font-size:11px;color:var(--admin-color-error-text,#b8341f);margin:-4px 0 8px}
    .tcp-btnrow{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .tcp-btn{border:1px solid var(--admin-color-border,#F1E4E7);background:var(--admin-color-background-surface,#fff);color:var(--admin-color-text-primary,#2B2B2B);border-radius:8px;padding:6px 9px;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
    .tcp-btn:hover{background:var(--admin-color-background-page,#FFF6FA)}
    .tcp-preview-row{display:flex;gap:8px;align-items:center}
    .tcp-preview{flex:1;height:34px;border-radius:8px;border:1px solid var(--admin-color-border,#F1E4E7);position:relative;overflow:hidden}
    .tcp-preview-label{position:absolute;bottom:2px;left:6px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:rgba(0,0,0,.55);background:rgba(255,255,255,.75);padding:0 4px;border-radius:3px}
    .tcp-swatch{width:28px;height:28px;border-radius:7px;border:1px solid var(--admin-color-border,#F1E4E7);cursor:pointer;flex-shrink:0;background-size:8px 8px}
  `;
  document.head.appendChild(style);
}

function toHexAlpha({ r, g, b, a }) {
  const h = v => Math.round(v).toString(16).padStart(2, '0');
  const alphaHex = a < 1 ? h(a * 255) : '';
  return '#' + h(r) + h(g) + h(b) + alphaHex;
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function attachColorPicker(triggerEl, opts) {
  injectStyles();
  const state = {
    original: opts.value,
    h: 0, s: 0, v: 0, a: 1,
    open: false,
  };
  const initial = parseColor(opts.value) || { r: 173, g: 63, b: 103, a: 1 };
  const hsv = rgbToHsv(initial.r, initial.g, initial.b);
  state.h = hsv.h; state.s = hsv.s; state.v = hsv.v; state.a = initial.a;

  function currentRgb() { return hsvToRgb(state.h, state.s, state.v); }
  function currentValue() {
    const { r, g, b } = currentRgb();
    return toHexAlpha({ r, g, b, a: state.a });
  }

  function updateTriggerSwatch() {
    triggerEl.style.setProperty('--tcp-current', currentValue());
    if (triggerEl.classList.contains('tcp-swatch') || triggerEl.dataset.tcpSwatch) {
      triggerEl.style.background = currentValue();
    }
  }
  updateTriggerSwatch();

  let pop = null;
  function close() {
    if (pop) { pop.remove(); pop = null; }
    document.removeEventListener('mousedown', onOutside, true);
    state.open = false;
  }
  function onOutside(e) {
    if (pop && !pop.contains(e.target) && e.target !== triggerEl) close();
  }

  function open() {
    if (pop) return;
    state.open = true;
    pop = document.createElement('div');
    pop.className = 'tcp-pop';
    pop.innerHTML = `
      <div class="tcp-sv" data-tcp="sv">
        <div class="tcp-sv-white"></div>
        <div class="tcp-sv-black"></div>
        <div class="tcp-sv-cursor" data-tcp="sv-cursor"></div>
      </div>
      <div class="tcp-row">
        <div class="tcp-slider tcp-hue" data-tcp="hue"><div class="tcp-thumb" data-tcp="hue-thumb"></div></div>
      </div>
      <div class="tcp-row">
        <div class="tcp-slider tcp-alpha" data-tcp="alpha">
          <div class="tcp-alpha-fill" data-tcp="alpha-fill"></div>
          <div class="tcp-thumb" data-tcp="alpha-thumb"></div>
        </div>
      </div>
      <div class="tcp-preview-row" style="margin-bottom:8px">
        <div class="tcp-preview" style="background:${state.original}"><span class="tcp-preview-label">Antes</span></div>
        <div class="tcp-preview" data-tcp="preview-now" style="background:${currentValue()}"><span class="tcp-preview-label">Ahora</span></div>
      </div>
      <div class="tcp-input-row">
        <input type="text" class="tcp-input" data-tcp="text-input" value="${currentValue()}" spellcheck="false" placeholder="#AD3F67, rgb(...), hsl(...)">
      </div>
      <div class="tcp-err" data-tcp="err" style="display:none">Código de color no válido.</div>
      <div class="tcp-btnrow">
        <button type="button" class="tcp-btn" data-tcp="copy">📋 Copiar</button>
        <button type="button" class="tcp-btn" data-tcp="paste">📥 Pegar</button>
        ${window.EyeDropper ? '<button type="button" class="tcp-btn" data-tcp="eyedrop">🎨 Cuentagotas</button>' : ''}
        <button type="button" class="tcp-btn" data-tcp="reset">↺ Restablecer</button>
      </div>
    `;
    document.body.appendChild(pop);
    positionPop();

    const svEl = pop.querySelector('[data-tcp="sv"]');
    const svCursor = pop.querySelector('[data-tcp="sv-cursor"]');
    const hueEl = pop.querySelector('[data-tcp="hue"]');
    const hueThumb = pop.querySelector('[data-tcp="hue-thumb"]');
    const alphaEl = pop.querySelector('[data-tcp="alpha"]');
    const alphaThumb = pop.querySelector('[data-tcp="alpha-thumb"]');
    const alphaFill = pop.querySelector('[data-tcp="alpha-fill"]');
    const textInput = pop.querySelector('[data-tcp="text-input"]');
    const errEl = pop.querySelector('[data-tcp="err"]');
    const previewNow = pop.querySelector('[data-tcp="preview-now"]');

    function render() {
      const rgb = currentRgb();
      svEl.style.background = `hsl(${state.h},100%,50%)`;
      svCursor.style.left = (state.s * 100) + '%';
      svCursor.style.top = ((1 - state.v) * 100) + '%';
      hueThumb.style.left = (state.h / 360 * 100) + '%';
      alphaThumb.style.left = (state.a * 100) + '%';
      alphaFill.style.background = `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b},0), rgb(${rgb.r},${rgb.g},${rgb.b}))`;
      const val = currentValue();
      previewNow.style.background = val;
      textInput.value = val;
      textInput.classList.remove('tcp-invalid');
      errEl.style.display = 'none';
      updateTriggerSwatch();
      if (opts.onChange) opts.onChange(val);
    }
    render();

    function dragHandler(el, fn) {
      function move(e) {
        const rect = el.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        fn(x, y);
        render();
      }
      function up() {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
      }
      el.addEventListener('mousedown', e => { move(e); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); });
      el.addEventListener('touchstart', e => { move(e); window.addEventListener('touchmove', move); window.addEventListener('touchend', up); });
    }

    dragHandler(svEl, (x, y) => { state.s = x; state.v = 1 - y; });
    dragHandler(hueEl, x => { state.h = x * 360; });
    dragHandler(alphaEl, x => { state.a = Math.round(x * 100) / 100; });

    textInput.addEventListener('input', () => {
      const v = textInput.value.trim();
      if (!isValidColor(v)) {
        textInput.classList.add('tcp-invalid');
        errEl.style.display = 'block';
        return;
      }
      const parsed = parseColor(v);
      const hsvv = rgbToHsv(parsed.r, parsed.g, parsed.b);
      state.h = hsvv.h; state.s = hsvv.s; state.v = hsvv.v; state.a = parsed.a;
      render();
    });

    pop.querySelector('[data-tcp="copy"]').addEventListener('click', () => {
      navigator.clipboard?.writeText(currentValue()).catch(() => {});
    });
    pop.querySelector('[data-tcp="paste"]').addEventListener('click', async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (isValidColor(text)) {
          const parsed = parseColor(text);
          const hsvv = rgbToHsv(parsed.r, parsed.g, parsed.b);
          state.h = hsvv.h; state.s = hsvv.s; state.v = hsvv.v; state.a = parsed.a;
          render();
        }
      } catch (e) { /* portapapeles no disponible/sin permiso */ }
    });
    const eyedrop = pop.querySelector('[data-tcp="eyedrop"]');
    if (eyedrop) {
      eyedrop.addEventListener('click', async () => {
        try {
          const res = await new window.EyeDropper().open();
          const parsed = parseColor(res.sRGBHex);
          if (parsed) {
            const hsvv = rgbToHsv(parsed.r, parsed.g, parsed.b);
            state.h = hsvv.h; state.s = hsvv.s; state.v = hsvv.v; state.a = 1;
            render();
          }
        } catch (e) { /* usuario canceló el cuentagotas */ }
      });
    }
    pop.querySelector('[data-tcp="reset"]').addEventListener('click', () => {
      if (opts.onReset) {
        const resetVal = opts.onReset();
        if (resetVal && isValidColor(resetVal)) {
          const parsed = parseColor(resetVal);
          const hsvv = rgbToHsv(parsed.r, parsed.g, parsed.b);
          state.h = hsvv.h; state.s = hsvv.s; state.v = hsvv.v; state.a = parsed.a;
          render();
        }
      }
    });

    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  }

  function positionPop() {
    if (!pop) return;
    const rect = triggerEl.getBoundingClientRect();
    const popW = 264, popH = 420;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = Math.max(8, rect.top - popH - 6);
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }

  triggerEl.addEventListener('click', () => { if (state.open) close(); else open(); });

  return {
    getValue: currentValue,
    setValue(v) {
      const parsed = parseColor(v);
      if (!parsed) return;
      const hsvv = rgbToHsv(parsed.r, parsed.g, parsed.b);
      state.h = hsvv.h; state.s = hsvv.s; state.v = hsvv.v; state.a = parsed.a;
      updateTriggerSwatch();
    },
    close,
  };
}
