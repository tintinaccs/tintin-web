// App móvil, Fase 23 · Roles y Permisos: en ≤768 la matriz acción × rol (3 roles) cabe sin cortes, con
// interruptores, módulos y botones de 44 px y campos de 16 px; tablet/escritorio sin cambios.
// HTML ficticio con las mismas clases que dibuja renderPermisosMatrix; no se guarda ningún permiso.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const roles = ['Admin', 'Agente / Modder', 'Viewer'];
const toggle = (n, on) => `<td data-label="${roles[n]}"><label class="perm-pill-toggle"><input type="checkbox" class="perm-pill-input" ${on ? 'checked' : ''}><span class="perm-pill-track"><span class="perm-pill-text perm-pill-text-on">Activado</span><span class="perm-pill-text perm-pill-text-off">Desactivado</span></span></label></td>`;
const na = n => `<td data-label="${roles[n]}"><span class="perm-pill-disabled">No disponible</span></td>`;
const module = label => `<details class="perm-module-block" open><summary>${label}</summary><div class="perm-module-body"><table class="adm-table perm-matrix-table"><thead><tr><th>Acción</th>${roles.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>
<tr><td data-label="Acción">Ver listado completo de pedidos con datos de la clienta<span class="perm-danger-badge">Sensible</span></td>${toggle(0, true)}${toggle(1, false)}${na(2)}</tr>
<tr><td data-label="Acción">Editar precios <span class="perm-uionly-badge">Solo visual</span></td>${toggle(0, false)}${na(1)}${na(2)}</tr>
<tr><td data-label="Acción">Exportar a Excel <span class="perm-row-not-implemented">— no implementado</span><br><span class="perm-row-fixed-note">Pendiente</span></td>${na(0)}${na(1)}${na(2)}</tr></tbody></table></div></details>`;

async function open(page, width) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(h => {
    const s = document.getElementById('section-permisos');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    document.getElementById('perm-modules-wrap').innerHTML = h;
    const sel = document.getElementById('perm-filter-module'); sel.innerHTML = '<option value="">Todos los módulos</option>';
  }, module('Pedidos') + module('Productos con un nombre de módulo bastante largo'));
  await page.waitForTimeout(500);
}
const measure = page => page.evaluate(() => {
  const clipped = n => { const h = n.closest('thead'); return h && h.getBoundingClientRect().width <= 1; };
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && !clipped(n);
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-permisos');
  const name = n => n.id || n.dataset.label || n.textContent.trim().slice(0, 24);
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('button, select, input:not([type=checkbox]), textarea, summary, label.perm-pill-toggle')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(name),
    smallFont: [...s.querySelectorAll('select, input:not([type=checkbox]), textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(name),
    toggles: [...s.querySelectorAll('label.perm-pill-toggle')].filter(vis).length,
  };
});

for (const width of [320, 390, 540, 768]) {
  test(`roles y permisos en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    const m = await measure(page);
    expect(m.app).toBe(true);
    expect(m.toggles).toBeGreaterThan(0);
    expect(m.overflow).toBe(false);
    expect(m.wide).toEqual([]);
    expect(m.small).toEqual([]);
    expect(m.smallFont).toEqual([]);
  });
}

for (const width of [820, 1024, 1440]) {
  test(`roles y permisos sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    expect((await measure(page)).app).toBe(false);
  });
}
