// App móvil, Fase 25 · Maestro y Mensaje de bienvenida. Ambos módulos se montan por JS con sesión de Super Admin,
// así que la prueba inyecta el CSS real (extraído del código fuente) y HTML equivalente al que generan.
// En ≤768 todo cabe sin cortes, con toques de 44 px y campos de 16 px; tablet/escritorio sin cambios.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const root = path.join(__dirname, '..', '..');
const cssOf = (file, re) => (fs.readFileSync(path.join(root, file), 'utf8').match(re) || [, ''])[1];
const MAESTRO_CSS = cssOf('js/admin/maestro/panel-maestro.js', /style\.textContent = `([\s\S]*?)`;/);
const WELCOME_CSS = cssOf('js/admin/content/control-bienvenida-admin.js', /st\.textContent = `([\s\S]*?)`;/);

const caps = ['C', 'R', 'U', 'D'].map(c => `<td><span class="tt-maestro-cap">Completo</span></td>`).join('');
const rows = Array.from({ length: 6 }, (_, i) => `<tr><td><div class="tt-maestro-module-name">Módulo ${i}</div><div class="tt-maestro-module-policy">Política larga de ejemplo · descripción del módulo de prueba</div></td>${caps}<td><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="adm-btn adm-btn-sm tt-maestro-open">Abrir</button><button type="button" class="adm-btn adm-btn-sm adm-btn-primary">Acción rápida</button></div></td></tr>`).join('');
const MAESTRO_HTML = `<div class="tt-maestro-shell"><section class="tt-maestro-hero"><div class="tt-maestro-eyebrow">Tintin · Revisión del panel</div><h1>Maestro</h1><p>Revisá las secciones disponibles, sus permisos y si están conectadas correctamente.</p><div class="tt-maestro-actions"><button type="button" class="adm-btn adm-btn-primary">Comprobar ahora</button><button type="button" class="adm-btn">Diagnóstico integral</button><button type="button" class="adm-btn">Descargar revisión (JSON)</button></div></section><div class="tt-maestro-kpis">${[1, 2, 3, 4].map(i => `<article class="tt-maestro-kpi"><span>Indicador ${i}</span><strong>${i}0%</strong><small>comprobaciones de esta sesión correctas</small></article>`).join('')}</div><div class="tt-maestro-grid"><section class="tt-maestro-card"><div class="tt-maestro-card-head"><h2>Salud del Super Admin</h2><div class="tt-maestro-status"><span class="tt-maestro-dot"></span>Correcto</div></div></section><aside class="tt-maestro-card"><div class="tt-maestro-card-head"><h2>Política de seguridad</h2></div><div class="tt-maestro-card-body tt-maestro-policy"><div class="tt-maestro-policy-item"><strong>Pedidos</strong>Papelera + restauración + inventario.</div></div></aside></div><section class="tt-maestro-card"><div class="tt-maestro-card-head"><div><h2>Matriz de capacidades</h2><div class="tt-maestro-footer-note">C/R/U/D = Crear / Leer / Actualizar / Eliminar.</div></div><input id="maestro-filter" class="adm-input tt-maestro-search" type="search" placeholder="Buscar módulo o capacidad…"></div><div class="tt-maestro-table-wrap"><table class="tt-maestro-table"><thead><tr><th>Módulo</th><th>Crear</th><th>Leer</th><th>Editar</th><th>Eliminar</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>`;
const step = i => `<div class="tt-welcome-step-card"><div class="tt-welcome-step-head"><div class="tt-welcome-step-drag" aria-hidden="true">⠿</div><div class="tt-welcome-step-badge">Mensaje ${i}</div><div class="tt-welcome-step-actions"><button type="button" class="tt-welcome-btn">Subir</button><button type="button" class="tt-welcome-btn">Bajar</button><button type="button" class="tt-welcome-btn">Duplicar</button><button type="button" class="tt-welcome-btn danger">Eliminar</button></div></div><div class="tt-welcome-admin-row"><div class="tt-welcome-admin-field"><label>Ícono o emoji</label><input value="💗" maxlength="8"></div><div class="tt-welcome-admin-field"><label>Botón</label><input value="Siguiente" maxlength="40"></div></div><div class="tt-welcome-admin-field"><label>Imagen del paso</label><div class="tt-welcome-image-row"><input placeholder="https://..." inputmode="url"></div></div><div class="tt-welcome-admin-field"><label>Título</label><input value="Bienvenida a Tintin" maxlength="90"></div><div class="tt-welcome-admin-field"><label>Texto</label><textarea maxlength="420">Texto de ejemplo de un mensaje de bienvenida bastante largo para comprobar el ajuste de línea.</textarea></div><label class="tt-welcome-pill"><input type="checkbox" checked> Mostrar este mensaje</label></div>`;
const WELCOME_HTML = `<div class="tt-welcome-admin-grid"><div class="tt-welcome-admin-main"><div class="tt-welcome-admin-card"><h2 class="tt-welcome-admin-title">Mensaje de bienvenida</h2><p class="tt-welcome-admin-sub">Configurá los mensajes que ve una clienta nueva al iniciar sesión por primera vez.</p><div class="tt-welcome-preview-note">La prueba abre el sitio real como Super Admin.</div><div class="tt-welcome-admin-row" style="margin-top:16px"><div class="tt-welcome-admin-field"><label>Marca o encabezado breve</label><input id="welcome-title" value="Tintin" maxlength="90"></div><div class="tt-welcome-admin-field"><label>Contexto de la guía</label><input id="welcome-subtitle" value="Guía rápida" maxlength="90"></div></div><div class="tt-welcome-admin-switches"><label class="tt-welcome-pill"><input type="checkbox" checked> Activar bienvenida para usuarios nuevos</label><label class="tt-welcome-pill"><input type="checkbox" checked> Permitir prueba Super Admin</label></div></div><div class="tt-welcome-admin-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div><h3 class="tt-welcome-admin-title" style="font-size:17px">Mensajes</h3></div><button type="button" class="tt-welcome-btn primary">+ Agregar mensaje</button></div><div>${step(1)}${step(2)}</div><div class="tt-welcome-admin-actions"><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn">Restaurar mensajes base</button><button type="button" class="tt-welcome-btn danger">Reactivar para clientas</button></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn dark">Probar como nuevo usuario</button><button type="button" class="tt-welcome-btn primary">Guardar cambios</button></div></div></div></div><div class="tt-welcome-admin-side"><div class="tt-welcome-admin-card tt-welcome-preview-card"><h3 class="tt-welcome-admin-title" style="font-size:15px;margin-bottom:12px">Vista previa en vivo</h3><div class="tt-welcome-mini-card"><div class="tt-welcome-mini-top"><h2 class="tt-welcome-mini-title">Tintin</h2></div><div class="tt-welcome-mini-body"><div class="tt-welcome-mini-actions"><button type="button" class="tt-welcome-mini-btn">Atrás</button><button type="button" class="tt-welcome-mini-btn tt-welcome-mini-btn-primary">Siguiente</button></div></div></div></div></div></div>`;
const MODS = { 'section-maestro': { css: MAESTRO_CSS, html: MAESTRO_HTML }, 'section-welcome': { css: WELCOME_CSS, html: WELCOME_HTML } };

async function open(page, width, id) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(({ id, css, html }) => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.getElementById(id)?.remove();
    const s = document.createElement('div'); s.id = id; s.className = 'adm-section'; s.innerHTML = html;
    document.querySelector('.adm-content').appendChild(s);
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
  }, { id, ...MODS[id] });
  await page.waitForTimeout(500);
}
const measure = (page, id) => page.evaluate(id => {
  const scroller = n => { for (let p = n.parentElement; p && p.id !== id; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && !scroller(n);
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById(id);
  const name = n => n.id || n.className || n.textContent.trim().slice(0, 24);
  const hit = n => Math.max(r(n).height, r(n.closest('label') || n).height);
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, a.adm-btn')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(name),
    smallHit: [...s.querySelectorAll('input[type=checkbox], input[type=radio]')].filter(vis).filter(n => Math.round(hit(n)) < 44).map(name),
    smallFont: [...s.querySelectorAll('select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(name),
  };
}, id);

for (const id of Object.keys(MODS)) {
  for (const width of [320, 390, 540, 768]) {
    test(`${id} en modo app a ${width}px`, async ({ page }) => {
      await open(page, width, id);
      const m = await measure(page, id);
      expect(m.app).toBe(true);
      expect(m.overflow).toBe(false);
      expect(m.wide).toEqual([]);
      expect(m.small).toEqual([]);
      expect(m.smallHit).toEqual([]);
      expect(m.smallFont).toEqual([]);
    });
  }
  for (const width of [820, 1024, 1440]) {
    test(`${id} sin cambios de app a ${width}px`, async ({ page }) => {
      await open(page, width, id);
      expect((await measure(page, id)).app).toBe(false);
    });
  }
}
