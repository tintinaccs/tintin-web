// App móvil, Fase 13 · Páginas: las tarjetas ya las da espacio-modulos-admin
// (se verifica que sigan); se agrega búsqueda a todo el ancho y, en el editor,
// barra fija Guardar/Cancelar encima de la barra inferior. Se usa el render real
// de paginas-admin.js con datos ficticios; Firestore no se carga y no se guarda nada.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const source = fs.readFileSync(path.join(__dirname, '../../js/admin/pages/paginas-admin.js'), 'utf8');
const code = source.slice(source.indexOf('const scheduleSearch ='), source.indexOf('\nfunction openEditor('));

async function open(page, width) {
  await load(page, width, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(async code => {
    document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-paginas'));
    const { normalizeAdminSearch, debounceAdminSearch, renderAdminSearchMarkup } = await import('https://tintin.test/js/admin/datos/busqueda-admin.mjs');
    const host = document.getElementById('tt-pages-admin-root');
    const custom = { title: 'Guía de regalos para el día de la madre', slug: 'guia-de-regalos-dia-de-la-madre', pageType: 'custom', published: false, template: 'editorial', contentHtml: '<p>Hola</p>', metaTitle: '', metaDescription: '' };
    window.__pagesDeps = { normalizeAdminSearch, debounceAdminSearch, renderAdminSearchMarkup,
      root: () => host, canUse: () => true,
      pages: [{ title: 'Inicio', slug: '/', path: '/', pageType: 'builtin', published: true, template: 'Tintin' }, custom],
      esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
      slugify: value => String(value || '').toLowerCase(), dateLabel: () => '1 nov 2026, 10:00',
      removePage() {}, savePage() { window.__saved = (window.__saved || 0) + 1; }, custom };
    const script = document.createElement('script'); script.nonce = 'dGludGluLWZpeHR1cmU=';
    script.textContent = `{ let editing = null; const {${Object.keys(window.__pagesDeps).join(',')}} = window.__pagesDeps;
      const openEditor = slug => { editing = { original: custom, data: { ...custom } }; render(); };
      const closeEditor = () => { editing = null; render(); };
      ${code}; window.__pagesRender = render; render(); }`;
    document.body.append(script);
  }, code);
  await expect(page.locator('#tt-pages-admin-root .tt-pages-title')).toHaveCount(2);
}
const metrics = (page, scope) => page.evaluate(scope => {
  const root = document.querySelector(scope);
  const visible = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  return {
    overflow: document.documentElement.scrollWidth > innerWidth,
    innerScroll: [...root.querySelectorAll('*')].filter(n => n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)).map(n => n.className),
    small: [...root.querySelectorAll('button, a.adm-btn, select, input:not([type="checkbox"]), .tt-pages-toggle')].filter(visible)
      .filter(n => Math.round(n.getBoundingClientRect().height) < 44).map(n => (n.textContent || n.id).trim().slice(0, 24)),
    minFont: Math.min(...[...root.querySelectorAll('input:not([type="checkbox"]), select, textarea')].filter(visible).map(n => parseFloat(getComputedStyle(n).fontSize))),
  };
}, scope);

for (const width of [320, 390, 540, 768]) {
  test(`Páginas en modo app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).toHaveClass(/adm-app/);
    // Lista: tarjetas (capa existente), sin desplazamiento lateral; búsqueda a todo el ancho.
    const list = await metrics(page, '#tt-pages-admin-root');
    expect(list.overflow).toBe(false);
    expect(list.innerScroll).toEqual([]);
    expect(list.small).toEqual([]);
    expect(list.minFont).toBeGreaterThanOrEqual(16);
    const card = await page.locator('.tt-pages-table tbody tr').nth(1).evaluate(tr => {
      const r = tr.getBoundingClientRect(), table = tr.closest('.tt-pages-table').getBoundingClientRect();
      return { fits: r.right <= table.right + 1 && r.left >= table.left - 1, radius: parseFloat(getComputedStyle(tr).borderTopLeftRadius), date: getComputedStyle(tr.children[4], '::before').content };
    });
    expect(card.fits).toBe(true);
    expect(card.radius).toBeGreaterThan(0);
    expect(card.date).toBe('"Actualización"');
    const search = await page.evaluate(() => { const t = document.querySelector('.tt-pages-toolbar'), i = t.querySelector('input'); const cs = getComputedStyle(t); return { input: i.getBoundingClientRect().width, inner: t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; });
    expect(Math.round(search.input)).toBe(Math.round(search.inner));

    // Editor: barra Guardar/Cancelar fija encima de la barra inferior, visible sin desplazar.
    await page.locator('[data-page-edit]').click();
    await expect(page.locator('#tt-pages-save')).toBeVisible();
    const editor = await metrics(page, '#tt-pages-admin-root');
    expect(editor.overflow).toBe(false);
    expect(editor.small).toEqual([]);
    expect(editor.minFont).toBeGreaterThanOrEqual(16);
    const bar = await page.evaluate(() => {
      const bar = document.querySelector('.tt-pages-editor .adm-card-body > .tt-pages-actions').getBoundingClientRect();
      const nav = document.getElementById('adm-mobile-tabs');
      return { bottom: bar.bottom, top: bar.top, vh: innerHeight, navTop: nav ? nav.getBoundingClientRect().top : innerHeight, position: getComputedStyle(document.querySelector('.tt-pages-editor .adm-card-body > .tt-pages-actions')).position };
    });
    expect(bar.position).toBe('sticky');
    expect(bar.top).toBeGreaterThan(0);
    expect(bar.bottom).toBeLessThanOrEqual(bar.navTop + 1);
    await page.locator('#tt-pages-save').click();
    expect(await page.evaluate(() => window.__saved)).toBe(1);
    await page.locator('#tt-pages-cancel').click();
    await expect(page.locator('.tt-pages-table tbody tr')).toHaveCount(2);
  });
}

for (const width of [820, 1440]) {
  test(`Páginas sin cambios de app a ${width}px`, async ({ page }) => {
    await open(page, width);
    await expect(page.locator('html')).not.toHaveClass(/adm-app/);
    expect(await page.locator('.tt-pages-toolbar input').evaluate(n => Math.round(n.getBoundingClientRect().width))).toBeLessThan(400);
    await page.locator('[data-page-edit]').click();
    expect(await page.locator('.tt-pages-editor .adm-card-body > .tt-pages-actions').evaluate(n => getComputedStyle(n).position)).toBe('static');
  });
}
