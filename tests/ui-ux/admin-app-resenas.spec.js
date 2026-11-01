// App móvil, Fase 10 · Reseñas: búsqueda + botón Filtros (Estado/Puntuación/
// Respuesta/Periodo/Orden en la hoja), pestañas en una fila sin encimarse,
// toques de 44 px (casilla con zona de 44 px que no abre el detalle) y detalle a
// pantalla completa con campos de 16 px. Módulo real con datos ficticios: Firebase,
// sesión y API simulados; no se guarda nada.
const { test, expect } = require('@playwright/test');
const safeJson = value => JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const html = removeFixtureScripts(fs.readFileSync(path.resolve(__dirname, '../../admin.html'), 'utf8'), { removeModulePreloads: true });
const now = Date.parse('2026-10-30T12:00:00Z') / 1000;
const reviews = [1, 2, 3].map(i => ({
  reviewId: 'rev_' + i, ownerUid: 'uid_' + i, email: `clienta${i}@example.test`, displayName: 'Clienta de ejemplo ' + i,
  productId: 'p_' + i, productName: 'Pulsera de prueba con nombre largo ' + i, rating: 6 - i,
  comment: 'Comentario ficticio para revisar el diseño en teléfono.', visible: i !== 3, unread: i === 1,
  createdAt: { seconds: now - i * 3600 }, conversation: [], likeCount: i,
}));
const stubs = {
  'core/store/publicar-cambio-administrativo.js': 'export async function withAdminSiteChange(_, fn){ return fn(); }',
  'admin/auth/lecturas-admin.js': `const data = ${safeJson({ reviewRecords: reviews })};
    export function subscribeAdminSnapshot(ref, next){ const rows = data[ref.col] || [];
      setTimeout(() => next({ docs: rows.map(r => ({ id: r.reviewId, data: () => r })), data: () => null }), 0); return () => {}; }`,
  'core/firebase/firebase.js': 'export const auth = {}; export const db = {};',
  'admin/auth/app-check-admin.js': 'export async function waitForAdminAppCheck(){ return true; }',
  'core/auth/coordinador-sesion.js': 'export function subscribeAuthState(cb){ setTimeout(() => cb({ uid: "qa", email: "qa@example.test", getIdToken: async () => "t" }), 0); return () => {}; }',
  'core/auth/identidad-super-admin.js': 'export const isSuperAdmin = () => true;',
};
const firestore = 'export const collection=(db,col)=>({col}); export const doc=(db,col,id)=>({col,id}); export const query=r=>r; export const limit=()=>null; export const getDoc=async()=>({exists:()=>false,data:()=>null}); export const setDoc=async()=>{ globalThis.__egWrites=(globalThis.__egWrites||0)+1; };';

async function open(page, width) {
  await page.setViewportSize({ width, height: 844 });
  const writes = [];
  await page.route('**/__local-app', route => route.fulfill({ contentType: 'text/html', body: html }));
  for (const [file, body] of Object.entries(stubs)) await page.route(`**/js/${file}?*`, route => route.fulfill({ contentType: 'text/javascript', body }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({ contentType: 'text/javascript', body: firestore }));
  await page.route('**/api/admin-engagement*', route => {
    if (route.request().method() !== 'GET') writes.push(route.request().postData());
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, reports: [] }) });
  });
  await page.goto('/__local-app');
  await page.evaluate(() => { document.documentElement.classList.add('adm-auth-ready'); document.querySelectorAll('.adm-section').forEach(node => node.classList.toggle('active', node.id === 'section-resenas')); });
  await page.addScriptTag({ type: 'module', url: '/js/admin/maestro/app-movil-admin.js' });
  await page.addScriptTag({ type: 'module', url: '/js/admin/participacion/gestion-participacion-admin-v2.js' });
  await expect(page.locator('#reviews-admin-list .eg-card')).toHaveCount(3);
  return writes;
}
const toolbarLabels = page => page.locator('[data-eg-review-panel="inbox"] .eg-toolbar > label').evaluateAll(list => list.filter(l => l.getClientRects().length).length);

for (const width of [320, 390, 540, 768]) {
  test(`Reseñas en modo app a ${width}px`, async ({ page }) => {
    const writes = await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    const button = page.locator('[data-eg-review-panel="inbox"] .eg-toolbar > .adm-app-filter-btn');
    await expect(button).toHaveText('Filtros');
    expect(await toolbarLabels(page)).toBe(1);
    const m = await page.evaluate(() => {
      const section = document.getElementById('section-resenas');
      const visible = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      const tabs = [...section.querySelectorAll('.eg-segments > button')].map(n => n.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        toolbarH: section.querySelector('[data-eg-review-panel="inbox"] .eg-toolbar').getBoundingClientRect().height,
        tabRows: new Set(tabs.map(r => Math.round(r.top))).size,
        tabsOverlap: tabs.some((r, i) => i && r.left < tabs[i - 1].right - 0.5),
        tabsClipped: [...section.querySelectorAll('.eg-segments > button')].filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.textContent.trim()),
        small: [...section.querySelectorAll('button, select, input:not([type="checkbox"]), summary, a, .eg-card-select')].filter(visible)
          .map(n => ({ t: (n.textContent || n.id).trim().slice(0, 20), r: n.getBoundingClientRect() })).filter(x => x.r.height < 43.5 || x.r.width < 43.5).map(x => x.t),
        minFont: Math.min(...[...section.querySelectorAll('input:not([type="checkbox"]), select')].filter(visible).map(n => parseFloat(getComputedStyle(n).fontSize))),
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.toolbarH).toBeLessThan(120);
    expect(m.tabRows).toBe(1);
    expect(m.tabsOverlap).toBe(false);
    expect(m.tabsClipped).toEqual([]);
    expect(m.small).toEqual([]);
    expect(m.minFont).toBeGreaterThanOrEqual(16);

    // Hoja con los selectores reales: filtrar sigue funcionando y al cerrar vuelven.
    await button.click();
    const sheet = page.locator('#adm-app-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('select')).toHaveCount(5);
    for (const f of await sheet.locator('select').evaluateAll(list => list.map(s => ({ h: Math.round(s.getBoundingClientRect().height), f: parseFloat(getComputedStyle(s).fontSize) })))) {
      expect(f.h).toBeGreaterThanOrEqual(44); expect(f.f).toBeGreaterThanOrEqual(16);
    }
    await sheet.locator('#reviews-rating').selectOption('5');
    await expect(page.locator('#reviews-admin-list .eg-card')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveText('Filtros · 1');
    await expect(page.locator('[data-eg-review-panel="inbox"] .eg-toolbar #reviews-rating')).toHaveValue('5');
    expect(await toolbarLabels(page)).toBe(1);
    await button.click();
    await sheet.locator('#reviews-rating').selectOption('all');
    await sheet.getByRole('button', { name: 'Listo' }).click();
    await expect(button).toHaveText('Filtros');
    await expect(page.locator('#reviews-admin-list .eg-card')).toHaveCount(3);

    // Tocar la zona de la casilla (fuera del cuadro de 22 px) la marca y no abre el detalle.
    const zone = page.locator('[data-review-id="rev_2"] .eg-card-select');
    await zone.click({ position: { x: 3, y: 3 } });
    await expect(page.locator('[data-eg-select-review="rev_2"]')).toBeChecked();
    await expect(page.locator('#eg-review-bulk')).toBeVisible();
    await expect(page.locator('.eg-drawer')).toHaveCount(0);
    await zone.click({ position: { x: 3, y: 3 } });
    await expect(page.locator('[data-eg-select-review="rev_2"]')).not.toBeChecked();

    // Detalle a pantalla completa.
    await page.locator('[data-eg-open-review="rev_2"]').click();
    const drawer = page.locator('.eg-drawer');
    await expect(drawer).toBeVisible();
    const d = await drawer.evaluate(node => {
      const ref = document.createElement('div'); ref.style.cssText = 'position:fixed;left:0;right:0;top:0;height:0'; document.body.append(ref);
      const vw = ref.getBoundingClientRect().width; ref.remove(); // el navegador de pruebas reserva el canal de la barra de desplazamiento
      const r = node.getBoundingClientRect();
      const fields = [...node.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea')].filter(n => n.getClientRects().length);
      return { w: r.width, h: r.height, vw, close: node.querySelector('.eg-drawer-head .eg-icon-btn').getBoundingClientRect().height, link: node.querySelector('.eg-detail-product a').getBoundingClientRect().height, minFont: fields.length ? Math.min(...fields.map(n => parseFloat(getComputedStyle(n).fontSize))) : 16, fields: fields.length };
    });
    expect(Math.round(d.w)).toBe(Math.round(d.vw));
    expect(Math.round(d.h)).toBe(844);
    expect(d.close).toBeGreaterThanOrEqual(44);
    expect(Math.round(d.link)).toBeGreaterThanOrEqual(44); // Fase 11
    expect(d.fields).toBeGreaterThan(0);
    expect(d.minFont).toBeGreaterThanOrEqual(16);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => globalThis.__egWrites || 0)).toBe(0);
  });
}

for (const width of [820, 1440]) {
  test(`Reseñas sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    expect(await page.locator('.adm-app-filter-btn').evaluateAll(list => list.filter(n => n.getClientRects().length).length)).toBe(0);
    expect(await toolbarLabels(page)).toBe(6);
    const box = await page.locator('[data-review-id="rev_1"] .eg-card-select input').boundingBox();
    expect(Math.round(box.width)).toBe(16);
    await page.locator('[data-eg-open-review="rev_2"]').click();
    await expect(page.locator('.eg-drawer')).toBeVisible();
    await expect.poll(() => page.locator('.eg-drawer').evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(560);
  });
}
