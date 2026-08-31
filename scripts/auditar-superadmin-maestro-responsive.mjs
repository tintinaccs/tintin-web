#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const panelSource = fs.readFileSync(path.join(root, 'js/admin/maestro/panel-maestro.js'), 'utf8');
const cssMatch = panelSource.match(/style\.textContent\s*=\s*`([\s\S]*?)`;\s*document\.head\.appendChild\(style\)/);
if (!cssMatch) {
  console.error('No se pudo extraer el CSS real de panel-maestro.js.');
  process.exit(1);
}
const maestroCss = cssMatch[1];

for (const required of ['@media(max-width:1050px)', '@media(max-width:600px)', '.tt-maestro-table-wrap{overflow:auto}', '.tt-maestro-grid{display:grid']) {
  if (!maestroCss.includes(required)) {
    console.error(`Falta contrato responsive Maestro: ${required}`);
    process.exit(1);
  }
}

const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{font-family:Montserrat,sans-serif;background:#faf8f9;color:#2b2b2b}.adm-content{width:100%;padding:24px;--adm-muted:#786d72;--adm-border:#eadde2}.adm-btn{min-height:42px;border:1px solid #ded2d7;background:#fff;border-radius:12px;padding:9px 13px;font:inherit}.adm-btn-primary{background:#AD3F67;color:#fff}.adm-input{min-height:42px;width:100%;border:1px solid #ded2d7;border-radius:10px;padding:8px 10px}
${maestroCss}
</style></head><body><main class="adm-content"><section id="section-maestro" class="adm-section active"><div class="tt-maestro-shell">
<div class="tt-maestro-hero"><div class="tt-maestro-eyebrow">Super Admin · Control integral</div><h1>Maestro Tintin</h1><p>Centro maestro para gobernar módulos, CRUD, permisos, sincronización y estado general.</p><div class="tt-maestro-actions"><button class="adm-btn adm-btn-primary">Ejecutar comprobación</button><button class="adm-btn">Nuevo pedido</button><button class="adm-btn">Nuevo producto</button><button class="adm-btn">Nueva colección</button></div></div>
<div class="tt-maestro-kpis"><div class="tt-maestro-kpi"><span>Módulos</span><strong>20</strong><small>Cobertura total</small></div><div class="tt-maestro-kpi"><span>Salud</span><strong>100%</strong><small>Contratos activos</small></div><div class="tt-maestro-kpi"><span>CRUD</span><strong>OK</strong><small>Política segura</small></div><div class="tt-maestro-kpi"><span>Sync</span><strong>Full</strong><small>Admin ↔ Público</small></div></div>
<div class="tt-maestro-grid"><article class="tt-maestro-card"><div class="tt-maestro-card-head"><h2>Matriz de gobierno</h2><input class="adm-input tt-maestro-search" placeholder="Buscar módulo"></div><div class="tt-maestro-table-wrap"><table class="tt-maestro-table"><thead><tr><th>Módulo</th><th>C</th><th>R</th><th>U</th><th>Arch.</th><th>D</th><th>Buscar</th><th>Exportar</th><th>Sync</th><th>Auditar</th><th>Permisos</th></tr></thead><tbody>${Array.from({length:8},(_,i)=>`<tr><td><div class="tt-maestro-module-name">Módulo ${i+1} con nombre administrable</div><div class="tt-maestro-module-policy">Política segura y conectada</div></td>${Array.from({length:10},()=>'<td><span class="tt-maestro-cap yes">Sí</span></td>').join('')}</tr>`).join('')}</tbody></table></div></article><aside class="tt-maestro-card"><div class="tt-maestro-card-head"><h2>Salud de conexiones</h2></div><div class="tt-maestro-card-body"><div class="tt-maestro-health">${Array.from({length:6},(_,i)=>`<div class="tt-maestro-check" data-ok="true"><div class="tt-maestro-check-icon">✓</div><div><strong>Conexión ${i+1}</strong><small>Interconexión operativa verificada.</small></div></div>`).join('')}</div></div></aside></div>
</div></section></main></body></html>`;

const viewports = [
  { name: 'desktop', width: 1440, height: 900, kpis: 4, grid: 2 },
  { name: 'tablet', width: 820, height: 1180, kpis: 2, grid: 1 },
  { name: 'mobile', width: 390, height: 844, kpis: 1, grid: 1 },
  { name: 'mobile-small', width: 320, height: 720, kpis: 1, grid: 1 },
];

function columnCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.setContent(fixture, { waitUntil: 'load' });
    const state = await page.evaluate(() => {
      const kpis = getComputedStyle(document.querySelector('.tt-maestro-kpis')).gridTemplateColumns;
      const grid = getComputedStyle(document.querySelector('.tt-maestro-grid')).gridTemplateColumns;
      const head = getComputedStyle(document.querySelector('.tt-maestro-card-head')).flexDirection;
      const tableWrap = document.querySelector('.tt-maestro-table-wrap');
      const actions = document.querySelector('.tt-maestro-actions');
      const buttons = [...actions.querySelectorAll('.adm-btn')].map(button => button.getBoundingClientRect().width);
      return {
        docWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        kpis,
        grid,
        head,
        actionsWidth: actions.getBoundingClientRect().width,
        buttons,
        tableOverflowX: getComputedStyle(tableWrap).overflowX,
        tableClientWidth: tableWrap.clientWidth,
        tableScrollWidth: tableWrap.scrollWidth,
      };
    });
    const kpiCount = columnCount(state.kpis);
    const gridCount = columnCount(state.grid);
    const issues = [];
    if (state.docWidth > viewport.width + 2 || state.bodyWidth > viewport.width + 2) issues.push(`overflow global ${state.docWidth}/${state.bodyWidth} > ${viewport.width}`);
    if (kpiCount !== viewport.kpis) issues.push(`KPIs: ${kpiCount} columnas, esperado ${viewport.kpis}`);
    if (gridCount !== viewport.grid) issues.push(`grid principal: ${gridCount} columnas, esperado ${viewport.grid}`);
    if (!['auto','scroll'].includes(state.tableOverflowX)) issues.push(`tabla sin scroll interno: overflow-x=${state.tableOverflowX}`);
    if (state.tableScrollWidth <= state.tableClientWidth) issues.push('la matriz no está ejerciendo su scroll interno de seguridad');
    if (viewport.width <= 600) {
      if (state.head !== 'column') issues.push(`cabecera mobile no apila: ${state.head}`);
      if (state.buttons.some(width => width < state.actionsWidth * 0.92)) issues.push('acciones mobile no ocupan el ancho disponible');
    }
    const result = { viewport, state, issues, ok: issues.length === 0 };
    results.push(result);
    if (issues.length) failures.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}

const payload = { schemaVersion: 1, status: failures.length ? 'FAIL' : 'PASS', checkedAt: new Date().toISOString(), results };
fs.writeFileSync(path.join(artifactDir, 'superadmin-maestro-responsive.json'), JSON.stringify(payload, null, 2) + '\n');

for (const result of results) console.log(`${result.ok ? 'OK' : 'FAIL'} — Maestro ${result.viewport.name} ${result.viewport.width}x${result.viewport.height}${result.issues.length ? ` · ${result.issues.join('; ')}` : ''}`);
if (failures.length) process.exit(1);
console.log('\nResponsive Maestro: CORRECTO · Desktop + Tablet + Mobile sin overflow global y con matriz segura.');
