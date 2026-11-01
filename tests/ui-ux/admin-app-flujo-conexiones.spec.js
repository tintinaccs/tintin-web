// App móvil, Fase 20 · Flujo de conexiones: en ≤768 los nodos y las conexiones son toques de 44 px,
// búsqueda y estado a todo el ancho con 16 px, resumen sin cortes; tablet y escritorio sin cambios.
// El módulo real importa Firebase: se inyecta HTML ficticio con las mismas clases que dibuja el módulo.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const pill = (state, label) => `<a href="#tfc-detail" class="tfc-pill tfc-state-${state}" data-node-id="${label}"><span class="tfc-live-dot is-partial" aria-label="Evidencia parcial">◐</span>${label}</a>`;
const edge = (a, b) => `<a href="#tfc-detail" class="tfc-edge-row" data-edge-id="${a}-${b}"><span class="tfc-edge-node">${a}</span><span class="tfc-edge-arrow">→</span><span class="tfc-edge-node">${b}</span><span class="tfc-edge-label">escribe pedido con un texto largo de ejemplo</span><span class="tfc-edge-live is-partial">◐ parcial</span></a>`;
const html = `<div class="adm-card tfc-card"><div class="adm-card-head tfc-head"><h3>Flujo de conexiones</h3><span id="tfc-monitor-status" role="status">Comprobación automática activa</span></div><div class="adm-card-body">
<div class="tfc-meta"><span>Solo lectura</span><span id="tfc-live-timestamp">Comprobando conexiones…</span></div>
<div id="tfc-summary" class="tfc-summary"><div class="tfc-summary-item"><strong>42</strong><span>nodos</span></div><div class="tfc-summary-item"><strong>90</strong><span>conexiones</span></div><div class="tfc-summary-item is-green"><strong>30</strong><span>verificados</span></div><div class="tfc-summary-item is-attention"><strong>12</strong><span>requieren atención</span></div><div class="tfc-summary-freshness">Última comprobación hace un momento</div></div>
<div class="tfc-toolbar"><input type="search" id="tfc-search" class="adm-select" placeholder="Buscar nodo, conexión, servicio, archivo o estado…"><select id="tfc-filter-state" class="adm-select"><option>Todos los estados</option></select></div>
<div class="tfc-legend"><span class="tfc-legend-item"><span class="tfc-pill-state tfc-state-con-error">Con error</span></span></div>
<div id="tfc-lanes" class="tfc-lanes"><div class="tfc-lane"><div class="tfc-lane-title">Tienda pública</div><div class="tfc-lane-pills">${pill('con-error', 'Carrito')}${pill('funcionando-en-produccion', 'Catálogo')}${pill('conectado-parcialmente', 'Checkout con nombre largo')}</div></div></div>
<div class="tfc-detail" id="tfc-detail"><div class="tfc-detail-head"><strong>Carrito</strong><span class="tfc-pill-state tfc-state-con-error">Con error</span></div><p class="tfc-detail-notes">Notas</p></div>
<div class="tfc-edges-head">Conexiones (2)</div><div id="tfc-edges" class="tfc-edges">${edge('Carrito', 'Checkout')}${edge('Catálogo', 'Carrito')}</div></div></div>`;

async function open(page, width) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(h => {
    const s = document.getElementById('section-flujo-conexiones');
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
    s.innerHTML = h;
  }, html);
}
const measure = page => page.evaluate(() => {
  const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const r = n => n.getBoundingClientRect();
  const s = document.getElementById('section-flujo-conexiones');
  return {
    app: document.documentElement.classList.contains('adm-app'),
    overflow: document.documentElement.scrollWidth > innerWidth,
    wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
    small: [...s.querySelectorAll('a.tfc-pill, a.tfc-edge-row, select, input')].filter(vis).filter(n => Math.round(r(n).height) < 44).map(n => n.id || n.textContent.trim().slice(0, 20)),
    smallFont: [...s.querySelectorAll('#tfc-search, #tfc-filter-state')].filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(n => n.id),
    pillHeight: Math.round(r(s.querySelector('a.tfc-pill')).height),
  };
});

for (const width of [320, 390, 540, 768]) {
  test(`flujo de conexiones en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    const m = await measure(page);
    expect(m.app).toBe(true);
    expect(m.overflow).toBe(false);
    expect(m.wide).toEqual([]);
    expect(m.small).toEqual([]);
    expect(m.smallFont).toEqual([]);
  });
}

for (const width of [820, 1024, 1440]) {
  test(`flujo de conexiones sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    const m = await measure(page);
    expect(m.app).toBe(false);
    expect(m.pillHeight).toBeLessThan(44);
  });
}
