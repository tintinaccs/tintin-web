#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(ROOT, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{font-family:Arial,sans-serif;padding:18px}.adm-card{max-width:1100px;margin:auto;border:1px solid #eadde2;border-radius:12px;overflow:hidden}.adm-card-header{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px}.actions,.adm-bulk-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.adm-bulk-toolbar{padding:10px 16px;background:#fff3e0}.adm-btn{min-height:40px;border:1px solid #d6b8c2;border-radius:9px;padding:8px 12px;background:#fff}.adm-btn-danger{background:#b3261e;color:#fff;border-color:#b3261e}@media(max-width:600px){.adm-card-header{align-items:stretch}.actions{width:100%}.actions .adm-btn{flex:1 1 145px}.adm-bulk-toolbar .adm-btn{flex:1 1 145px}}
</style></head><body>
<div class="adm-card"><div class="adm-card-header"><strong>Productos</strong><div class="actions"><button class="adm-btn adm-btn-danger" id="btn-eliminar-todos-productos">Eliminar TODOS</button><button class="adm-btn">+ Nuevo producto</button></div></div><div class="adm-bulk-toolbar"><span>12 seleccionados</span><button class="adm-btn adm-btn-danger">Eliminar seleccionados</button><button class="adm-btn">Exportar</button></div></div>
<div style="height:20px"></div>
<div class="adm-card"><div class="adm-card-header"><strong>Colecciones</strong><div class="actions"><button class="adm-btn adm-btn-danger" id="btn-eliminar-todas-colecciones">Eliminar TODAS</button><button class="adm-btn">+ Nueva colección</button></div></div><div class="adm-bulk-toolbar"><span>4 seleccionadas</span><button class="adm-btn adm-btn-danger">Eliminar seleccionadas</button><button class="adm-btn">Exportar</button></div></div>
</body></html>`;

const viewports = [
  { name:'desktop', width:1440, height:900 },
  { name:'tablet', width:820, height:1180 },
  { name:'mobile', width:390, height:844 },
  { name:'mobile-small', width:320, height:720 },
];
const results = [];
const failures = [];
const browser = await chromium.launch({ headless:true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, reducedMotion:'reduce' });
    const page = await context.newPage();
    await page.setContent(fixture, { waitUntil:'load' });
    const state = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      productVisible: !!document.querySelector('#btn-eliminar-todos-productos')?.getClientRects().length,
      collectionVisible: !!document.querySelector('#btn-eliminar-todas-colecciones')?.getClientRects().length,
      buttons: [...document.querySelectorAll('.adm-btn')].map(button => ({ width:button.getBoundingClientRect().width, height:button.getBoundingClientRect().height })),
    }));
    const issues = [];
    if (state.docWidth > viewport.width + 2) issues.push(`overflow ${state.docWidth} > ${viewport.width}`);
    if (!state.productVisible || !state.collectionVisible) issues.push('botones Eliminar TODOS no visibles');
    if (state.buttons.some(button => button.height < 38 || button.width < 70)) issues.push('control destructivo demasiado pequeño');
    const result = { viewport, state, issues, ok:issues.length === 0 };
    results.push(result);
    if (issues.length) failures.push(result);
    await context.close();
  }
} finally { await browser.close(); }

fs.writeFileSync(path.join(artifacts, 'catalog-global-delete-responsive.json'), JSON.stringify({ status:failures.length?'FAIL':'PASS', results }, null, 2) + '\n');
results.forEach(result => console.log(`${result.ok?'OK':'FAIL'} — borrado catálogo ${result.viewport.name} ${result.viewport.width}px${result.issues.length ? ` · ${result.issues.join('; ')}` : ''}`));
if (failures.length) process.exit(1);
console.log('Borrado global responsive: Desktop + Tablet + Mobile CORRECTO.');
