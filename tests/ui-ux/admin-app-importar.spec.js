// App móvil, Fase 14 · Import/Export: guardia de regresión. El módulo real
// (importacion-admin.js) ya se adapta al teléfono: oculta los importadores legacy,
// sus botones miden 44 px y la vista previa pasa a tarjetas con la capa existente.
// Se carga el módulo real con Firebase/red sustituidos por dobles: el CSV ficticio
// solo se analiza en el navegador; nada se escribe ni se descarga.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');
const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const stubs = {
  '/js/core/firebase/firebase.js': 'export const db = {}; export const auth = {};',
  '/js/core/auth/roles.js': "export const SUPER_ADMIN = 'admin@tintin.test';",
  '/js/core/auth/coordinador-sesion.js': "export function subscribeAuthState(cb){ cb({ email: 'admin@tintin.test' }); return () => {}; }",
  '/js/core/firebase/paginacion-firestore.js': "export async function getDocsPaginated(){ return { truncated:false, docs:[{ id:'aros', data:()=>({ name:'Aros', slug:'aros' }) }] }; }",
  '/js/core/auth/cliente-api-autenticado.js': "export async function authenticatedFetch(){ throw new Error('sin red'); } export const apiFailureMessage = () => 'sin red';",
  '/js/core/store/publicar-cambio-administrativo.js': 'export async function withAdminSiteChange(){ throw new Error("sin escritura"); }',
};
const firestore = 'export const collection=()=>({}); export const doc=()=>({}); export const runTransaction=async()=>{throw new Error("sin escritura")}; export const serverTimestamp=()=>null;';
async function respond(route, url) {
  if (url.hostname === 'www.gstatic.com') { await route.fulfill({ contentType: 'text/javascript', body: firestore }); return true; }
  if (url.hostname !== 'tintin.test') return false;
  if (stubs[url.pathname]) { await route.fulfill({ contentType: 'text/javascript', body: stubs[url.pathname] }); return true; }
  if (url.pathname === '/js/admin/importacion-admin.js' || url.pathname === '/js/admin/aplicar-importacion-admin.js' || url.pathname.startsWith('/js/core/store/')) {
    await route.fulfill({ path: path.join(ROOT, url.pathname), contentType: 'text/javascript' }); return true;
  }
  return false;
}
const csv = ['Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Variant SKU,Variant Price,Variant Inventory Qty,Image Src,Status',
  'aro-luna,Aro Luna dorado,<p>Hola</p>,Tintin,aros,aros,true,AR-1,85000,4,,active',
  'collar-sin-precio-con-nombre-largo-para-probar,Collar con un nombre muy largo para probar el corte de texto,,Tintin,collares,collares,true,CO-1,,2,,active',
  'pulsera-x,Pulsera X,,Tintin,,,true,PU-1,50000,,,draft'].join('\n');
for (const width of [320, 390, 540, 768, 820, 1440]) test(`Import/Export a ${width}px`, async ({ page }) => {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true, respond });
  await page.evaluate(() => document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-importar')));
  await page.evaluate(() => { const s = document.createElement('script'); s.type = 'module'; s.nonce = 'dGludGluLWZpeHR1cmU='; s.src = '/js/admin/importacion-admin.js'; document.body.append(s); });
  await expect(page.locator('#shopify-import-canonical-card')).toBeVisible();
  await page.locator('#shopify-import-canonical-card input[type=file]').setInputFiles({ name: 'shopify.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.phase10-preview')).toBeVisible();
  const toggle = page.locator('.phase10-actions button', { hasText: 'Ver los' }); if (await toggle.isVisible()) await toggle.click();
  const m = await page.evaluate(() => {
    const root = document.getElementById('section-importar');
    const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
    return { overflow: document.documentElement.scrollWidth > innerWidth,
      inner: [...root.querySelectorAll('*')].filter(vis).filter(n => n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)).length,
      small: [...root.querySelectorAll('button,a.adm-btn,select,input:not([type=checkbox]):not([type=file]),textarea,[role=button]')].filter(vis).filter(n => Math.round(n.getBoundingClientRect().height) < 44).map(n => (n.textContent || n.id).trim().slice(0, 30)),
      minFont: Math.min(...[...root.querySelectorAll('input:not([type=checkbox]):not([type=file]),select,textarea')].filter(vis).map(n => parseFloat(getComputedStyle(n).fontSize))),
      legacyVisible: [...root.querySelectorAll('[data-phase9-legacy-importer]')].filter(vis).length,
      cardsFit: [...root.querySelectorAll('.adm-card')].filter(vis).every(n => n.getBoundingClientRect().right <= innerWidth),
      thead: getComputedStyle(root.querySelector('.phase10-table thead')).position,
      label: getComputedStyle(root.querySelector('.phase10-table tbody td:nth-child(2)'), '::before').content,
    };
  });
  expect(m.overflow).toBe(false);
  expect(m.inner).toBe(0);
  if (width <= 768) { expect(m.small).toEqual([]); expect(m.minFont).toBeGreaterThanOrEqual(16); }
  expect(m.legacyVisible).toBe(0);
  expect(m.cardsFit).toBe(true);
  await expect(page.locator('.phase10-table tbody tr')).toHaveCount(3);
  if (width <= 768) { await expect(page.locator('html')).toHaveClass(/adm-app/); expect(m.label).toContain('Producto'); }
  else { await expect(page.locator('html')).not.toHaveClass(/adm-app/); expect(m.label).not.toContain('Producto'); }
});
