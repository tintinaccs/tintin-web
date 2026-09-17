import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'css/admin/flujo-conexiones.css'), 'utf8');
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const pills = Array.from({ length: 36 }, (_, index) => `<button class="tfc-pill" type="button">Nodo ${index + 1} · conexión operativa</button>`).join('');
const edges = Array.from({ length: 37 }, (_, index) => `<button class="tfc-edge-row" type="button"><span class="tfc-edge-node">Origen ${index + 1}</span><span class="tfc-edge-arrow">→</span><span class="tfc-edge-node">Destino ${index + 1}</span><span class="tfc-edge-label">evidencia de contrato y producción</span><span class="tfc-pill-state tfc-state-implementado-pero-no-verificado">IMPLEMENTADO PERO NO VERIFICADO</span></button>`).join('');

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const failures = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      :root{--admin-color-border:#ddd;--admin-color-background-surface:#fff;--admin-color-background-page:#fafafa;--admin-color-text-primary:#222;--admin-color-text-secondary:#666;--admin-color-text-tertiary:#888;--admin-color-brand:#ad3f67;--admin-color-success-background:#e9f7ed;--admin-color-success-text:#176b2b;--admin-color-warning-background:#fff4e5;--admin-color-warning-text:#8a4b00;--admin-color-error-background:#feeceb;--admin-color-error-text:#a52b20;--admin-color-badge-background:#f1eef0}*{box-sizing:border-box}body{margin:0;background:#fafafa;font-family:Montserrat}.adm-card{margin:12px;max-width:1200px}.adm-card-head{display:flex}.adm-card-body{padding:16px}.adm-btn{min-height:40px}.adm-select{min-height:40px;border:1px solid #ccc;border-radius:7px;padding:8px}.tfc-card{width:auto}.tfc-head{justify-content:space-between}.tfc-lane{margin-bottom:10px}.tfc-lane-pills{display:flex;flex-wrap:wrap}.tfc-legend{display:flex}.tfc-legend-item{margin:2px}.tfc-state-implementado-pero-no-verificado{background:#fff8e1;color:#8d6e00;border-color:#ffe082}
      ${css}</style></head><body><section id="section-flujo-conexiones"><div class="adm-card tfc-card"><div class="adm-card-head tfc-head"><div><h1>Flujo real</h1><p>Estado verificable.</p></div><button class="adm-btn">Revalidar en vivo</button></div><div class="adm-card-body"><div class="tfc-summary"><div class="tfc-summary-item"><strong>36</strong><span>nodos</span></div><div class="tfc-summary-item"><strong>37</strong><span>conexiones</span></div><div class="tfc-summary-freshness">Última revalidación: ahora</div></div><div class="tfc-toolbar"><input id="tfc-search" class="adm-select" placeholder="Buscar nodo, conexión, servicio, archivo o estado"><select id="tfc-filter-state" class="adm-select"><option>Todos los estados</option></select></div><div class="tfc-lanes"><div class="tfc-lane"><div class="tfc-lane-title">Entrada</div><div class="tfc-lane-pills">${pills}</div></div></div><div class="tfc-edges"><div class="tfc-edges-head">Conexiones</div>${edges}</div></div></div></section></body></html>`, { waitUntil: 'load' });
    const geometry = await page.evaluate(() => {
      const body = document.body;
      const controls = [...document.querySelectorAll('button,input,select')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && (rect.left < -2 || rect.right > innerWidth + 2);
      });
      return { documentWidth: document.documentElement.scrollWidth, bodyWidth: body.scrollWidth, controls: controls.length };
    });
    if (geometry.documentWidth > viewport.width + 2 || geometry.bodyWidth > viewport.width + 2 || geometry.controls) {
      failures.push({ viewport: viewport.name, geometry });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error('Responsive flow audit failed:', JSON.stringify(failures));
  process.exit(1);
}
console.log('Responsive flow audit: PASS · desktop/laptop/tablet/mobile sin overflow ni controles fuera del viewport.');
