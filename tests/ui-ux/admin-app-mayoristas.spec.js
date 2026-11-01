// App móvil, Fase 8 · Pedidos mayoristas: resumen y pestañas táctiles, lista en
// tarjetas, detalle con las líneas como tarjetas (precio mayorista a todo el ancho,
// sin desplazamiento lateral) y barra fija Guardar/Rechazar/Aprobar sobre la barra
// inferior. Módulo real con Firestore y API simulados: no se envía ninguna decisión.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');

const ROOT = path.resolve(__dirname, '../..');
const source = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^import\s[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
const identity = source('js/admin/datos/busqueda-admin.mjs') + '\n' + source('js/pages/profile/estado-canonico-perfil.mjs');
const html = removeFixtureScripts(fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8'), { removeModulePreloads: true });

async function open(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/__wholesale-app', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/__wholesale-app');
  await page.evaluate(() => { document.documentElement.classList.add('adm-auth-ready'); document.querySelectorAll('.adm-section').forEach(node => node.classList.toggle('active', node.id === 'section-mayoristas')); });
  await page.addScriptTag({ type: 'module', url: '/js/admin/maestro/app-movil-admin.js' });
  await page.addScriptTag({ content: identity + `
    const auth={currentUser:{uid:'admin',email:'owner@example.com'}};const db={};const SUPER_ADMIN='owner@example.com';
    const sanitizeImageUrl=v=>v;const apiFailureMessage=()=>'';
    const collection=(_d,n)=>n;const query=c=>c;const limit=()=>{};const orderBy=()=>{};const where=()=>{};
    const onSnapshot=(n,next)=>{window.snapshotCallbacks||={};window.snapshotCallbacks[n]=next;return()=>{};};
    const authenticatedFetch=async(_u,o)=>{(window.sent||=[]).push(JSON.parse(o.body));return{ok:true,json:async()=>({ok:true,quote:{seenAt:'2026-10-05T12:00:00Z'}})};};
  ` + source('js/admin/mayoristas/mayoristas-admin.js') + '\ninitWholesaleAdmin();' });
  await page.evaluate(() => {
    const q = (id, status, seenAt) => ({ id, quoteNumber: 'MAY-' + id, userId: 'client', customerName: 'Clienta de prueba', userEmail: 'clienta.prueba@example.test', businessName: 'Emprendimiento ficticio', whatsapp: '595900000000', city: 'Luque', status, seenAt, notes: 'Nota ficticia', items: [{ name: 'Aros de prueba', variant: 'Dorado', qty: 10, retailUnitPrice: 10000 }, { name: 'Pulsera de prueba', qty: 5, retailUnitPrice: 25000 }], itemCount: 15, retailReferenceTotal: 225000, createdAt: '2026-10-05T12:00:00Z', revision: 1 });
    window.snapshotCallbacks.wholesaleQuotes({ docs: [q('new', 'pendiente'), q('seen', 'pendiente', '2026-10-05'), q('yes', 'aprobada'), q('no', 'rechazada')].map(x => ({ id: x.id, data: () => x })) });
    window.snapshotCallbacks.users({ docs: [{ id: 'client', data: () => ({ firstName: 'Clienta', lastName: 'Prueba', email: 'clienta.prueba@example.test', wholesaleStatus: 'aprobado', wholesaleBusinessName: 'Emprendimiento ficticio' }) }] });
  });
  await expect(page.locator('[data-open-quote]')).toHaveCount(2);
}

for (const width of [320, 390, 540, 768]) {
  test(`Mayoristas en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    const m = await page.evaluate(() => {
      const box = n => n.getBoundingClientRect();
      const s = document.getElementById('section-mayoristas');
      const tabs = [...s.querySelectorAll('[data-wholesale-tab]')];
      const fields = [...s.querySelectorAll('[data-wholesale-search], [data-wholesale-filter]')];
      return {
        summaryMinH: Math.min(...[...s.querySelectorAll('[data-wholesale-quick-filter]')].map(n => box(n).height)),
        tabsTop: new Set(tabs.map(n => Math.round(box(n).top))).size,
        tabsMinH: Math.min(...tabs.map(n => box(n).height)),
        fieldFont: Math.min(...fields.map(n => parseFloat(getComputedStyle(n).fontSize))),
        fieldMinH: Math.min(...fields.map(n => box(n).height)),
        openMinH: Math.min(...[...s.querySelectorAll('[data-open-quote]')].map(n => box(n).height)),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(m.summaryMinH).toBeGreaterThanOrEqual(44);
    expect(m.tabsTop).toBe(1);
    expect(m.tabsMinH).toBeGreaterThanOrEqual(44);
    expect(m.fieldFont).toBeGreaterThanOrEqual(16);
    expect(m.fieldMinH).toBeGreaterThanOrEqual(44);
    expect(m.openMinH).toBeGreaterThanOrEqual(44);
    expect(m.overflow).toBe(false);

    // Abrir marca como vista (API simulada) y muestra el detalle sin desplazamiento lateral.
    await page.locator('[data-open-quote="new"]').click();
    const detail = page.locator('[data-wholesale-detail]');
    await expect(detail).toContainText('WhatsApp 595900000000');
    await expect.poll(() => page.evaluate(() => window.sent)).toEqual([{ quoteId: 'new', decision: 'ver' }]);
    const d = await detail.evaluate(node => {
      const box = n => n.getBoundingClientRect();
      const wrap = node.querySelector('.adm-table-wrap');
      const inputs = [...node.querySelectorAll('[data-price-line]')];
      const card = inputs[0].closest('tr');
      return {
        lateral: wrap.scrollWidth > wrap.clientWidth + 1,
        cardW: box(card).width, inputW: box(inputs[0]).width,
        inputFont: parseFloat(getComputedStyle(inputs[0]).fontSize), inputH: box(inputs[0]).height,
        labels: [...card.children].slice(1).map(td => getComputedStyle(td, '::before').content),
        noteFont: parseFloat(getComputedStyle(node.querySelector('[data-admin-note]')).fontSize),
        decisionsMinH: Math.min(...[...node.querySelectorAll('[data-decision]')].map(n => box(n).height)),
        approveBg: getComputedStyle(node.querySelector('[data-decision="aprobar"]')).backgroundColor,
        primary: (() => { const ref = document.createElement('span'); ref.style.background = 'var(--admin-color-button-primary-background)'; document.body.append(ref); const c = getComputedStyle(ref).backgroundColor; ref.remove(); return c; })(),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(d.lateral).toBe(false);
    expect(d.inputW).toBeGreaterThan(d.cardW - 40); // precio mayorista a todo el ancho de la tarjeta
    expect(d.inputFont).toBeGreaterThanOrEqual(16);
    expect(d.inputH).toBeGreaterThanOrEqual(44);
    expect(d.labels).toEqual(['"Cant."', '"Precio minorista"', '"Precio mayorista c/u"', '"Subtotal"']);
    expect(d.noteFont).toBeGreaterThanOrEqual(16);
    expect(d.decisionsMinH).toBeGreaterThanOrEqual(44);
    expect(d.approveBg).toBe(d.primary);
    expect(d.overflow).toBe(false);

    // Escribir un precio sigue recalculando el subtotal (lógica real del módulo).
    await page.locator('[data-price-line="0"]').fill('8000');
    await expect(page.locator('[data-line-total="0"]')).toContainText('80.000');

    // Con el detalle en pantalla, la barra de decisión queda fija justo encima de la barra inferior.
    await page.evaluate(() => { document.scrollingElement.scrollTop = document.querySelector('[data-price-line]').getBoundingClientRect().top + scrollY - 200; });
    const sticky = () => page.evaluate(() => {
      const bar = document.querySelector('[data-wholesale-detail] div:has(> [data-decision])').getBoundingClientRect();
      const tabs = document.getElementById('adm-mobile-tabs').getBoundingClientRect().top;
      return bar.top > 0 && bar.bottom <= tabs;
    });
    await expect.poll(sticky).toBe(true);
    expect(await page.evaluate(() => window.sent.length)).toBe(1); // ninguna decisión enviada

    await page.locator('[data-wholesale-tab="users"]').click();
    await expect(page.locator('.wholesale-user-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [820, 1440]) {
  test(`Mayoristas sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    await page.locator('[data-open-quote="new"]').click();
    const d = await page.locator('[data-wholesale-detail]').evaluate(node => ({
      tableW: node.querySelector('.adm-table').getBoundingClientRect().width,
      bar: getComputedStyle(node.querySelector('div:has(> [data-decision])')).position,
      card: getComputedStyle(document.querySelector('#section-mayoristas > .adm-card')).overflow,
    }));
    expect(d.tableW).toBeGreaterThanOrEqual(width < 900 ? 960 : 600);
    expect(d.bar).toBe('static');
    expect(d.card).toBe('hidden');
  });
}
