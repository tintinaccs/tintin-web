const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`dashboard sólido y completo a ${width}px`, async ({ page }, testInfo) => {
    await load(page, width, 'admin.html', { sidebar: true });
    // Valores sintéticos para verificar tamaños; ningún dato de producción.
    await page.evaluate(() => {
      const values = { 'stat-users': '1.248', 'stat-orders-today': '24', 'stat-sales-month': '25.850.000 Gs.', 'stat-orders-total': '1.482', 'stat-visits-today': '368', 'stat-online-now': '12' };
      for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
    });
    await expect(page.getByRole('heading', { name: 'Hoy en Tintin' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.tt-dashboard-shortcuts button:visible')).toHaveCount(4);
    const surfaces = await page.locator('.tt-dashboard-hero,#dash-stats .adm-stat,.tt-dashboard-link').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { left: box.left, right: box.right, image: style.backgroundImage, blur: style.backdropFilter };
    }));
    for (const surface of surfaces) {
      expect(surface.left).toBeGreaterThanOrEqual(0); expect(surface.right).toBeLessThanOrEqual(width + 1);
      expect(surface.image).toBe('none'); expect(surface.blur).toBe('none');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.tt-dashboard-orders')).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('#section-dashboard')).toHaveCSS('background-image', 'none');
    if (width >= 1280) await expect(page.locator('#section-dashboard')).toHaveCSS('display', 'grid');
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
  });
}

test('buscador: acentos, teclado, sin resultados, Escape y foco', async ({ page }) => {
  await load(page, 390);
  const opener = page.locator('.tt-control-search'); await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Buscar módulos' }), input = dialog.getByLabel('Nombre del módulo');
  await expect(input).toBeFocused(); await input.fill('configuracion');
  await expect(dialog.locator('.tt-control-result-button')).toHaveCount(1);
  await page.keyboard.press('ArrowDown'); await expect(dialog.getByRole('button', { name: /Configuración/ })).toBeFocused();
  await page.evaluate(() => document.documentElement.classList.toggle('adm-sidebar-peek'));
  await expect(dialog.getByRole('button', { name: /Configuración/ })).toBeFocused();
  await input.fill('inexistente-123'); await expect(dialog.getByRole('status')).toContainText('No encontramos');
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
  await page.keyboard.press('Control+k'); await expect(input).toBeFocused();
});

test('el rediseño sigue los colores elegidos en Apariencia', async ({ page }) => {
  await load(page, 1440);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--admin-color-background-surface', '#172133');
    document.documentElement.style.setProperty('--admin-color-text-primary', '#eff3f8');
  });
  await expect(page.locator('.tt-dashboard-hero')).toHaveCSS('background-color', 'rgb(23, 33, 51)');
  await expect(page.locator('.tt-dashboard-hero h2')).toHaveCSS('color', 'rgb(239, 243, 248)');
  await expect(page.locator('#stat-users')).toHaveCSS('color', 'rgb(239, 243, 248)');
});

test('los módulos ocultos o deshabilitados no aparecen y los módulos tardíos sí', async ({ page }) => {
  await load(page, 768);
  await page.evaluate(() => {
    document.querySelector('#adm-nav [data-section="configuracion"]').style.display = 'none';
    document.querySelector('#adm-nav [data-section="usuarios"]').disabled = true;
    const button = document.createElement('button'); button.className = 'adm-nav-item'; button.dataset.section = 'welcome'; button.textContent = 'Mensaje de bienvenida'; document.getElementById('adm-nav').append(button);
  });
  await expect(page.locator('.tt-dashboard-link[data-admin-open="configuracion"]')).toBeHidden();
  await page.locator('.tt-control-search').click();
  const dialog = page.locator('#tt-control-module-dialog');
  await expect(dialog.getByRole('button', { name: /Configuración|Usuarios/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Imágenes' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /bienvenida/i })).toBeVisible();
});

test('la búsqueda reutiliza navegación y guardia reales y conserva el borrador al cancelar', async ({ page }) => {
  await load(page, 390, 'admin.html', { guard: true });
  await page.evaluate(() => {
    const root = document.getElementById('section-configuracion');
    document.querySelector('.adm-section.active').classList.remove('active'); root.classList.add('active');
    window.AdminUnsaved.register('settings-fixture', { root, label: 'Configuración' });
    document.querySelector('#adm-nav [data-section="productos"]').addEventListener('click', () => window.AdminUnsaved.requestNavigation(() => { window.__navigated = true; }));
  });
  const field = page.locator('#section-configuracion input[type="text"]').first(); await field.fill('Borrador conservado');
  await page.evaluate(() => window.AdminUnsaved.markDirty('settings-fixture'));
  await page.locator('.tt-control-search').click();
  const dialog = page.locator('#tt-control-module-dialog'); await dialog.getByLabel('Nombre del módulo').fill('productos');
  await dialog.getByRole('button', { name: /Productos/ }).click();
  await expect(dialog).toBeHidden();
  const guard = page.locator('#unsaved-modal'); await expect(guard).toBeVisible();
  await expect(field).toHaveValue('Borrador conservado');
  expect(await page.evaluate(() => window.__navigated)).toBeUndefined();
  await guard.getByRole('button', { name: /seguir editando|quedarme|cancelar/i }).click();
  await expect(guard).toBeHidden(); await expect(field).toHaveValue('Borrador conservado');
});

test('Usuarios tiene su paginador en el módulo correcto, fuera del Dashboard', async ({ page }) => {
  await load(page, 390);
  await expect(page.locator('#section-usuarios #users-pagination')).toHaveCount(1);
  await expect(page.locator('#section-dashboard #users-pagination')).toHaveCount(0);
});

test('el dashboard distribuye pedidos y visitantes sin superponerlos', async ({ page }) => {
  await load(page, 1440, 'admin.html', { sidebar: true });
  await page.locator('#dashboard-visitor-geo').evaluate(element => { element.hidden = false; });
  const visitor = await page.locator('#dashboard-visitor-geo').boundingBox();
  const orders = await page.locator('.tt-dashboard-orders').boundingBox();
  expect(visitor.x).toBeGreaterThanOrEqual(orders.x + orders.width);
  expect(Math.abs(visitor.y - orders.y)).toBeLessThan(2);
});

for (const width of [320, 390, 540]) {
  test(`barra flotante y drop-up accesible a ${width}px`, async ({ page }, testInfo) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    const nav = page.locator('#adm-mobile-tabs'), more = page.locator('#adm-mobile-more-toggle');
    const box = await nav.boundingBox();
    await expect(nav.locator('.adm-mobile-tab:visible')).toHaveCount(5);
    expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(1);
    expect(box.x).toBeGreaterThan(0); expect(box.x + box.width).toBeLessThan(width);
    expect(box.y + box.height).toBeLessThan(800);
    await more.click();
    const sheet = page.locator('#adm-mobile-more-sheet');
    await expect(sheet).toBeVisible(); await expect(sheet).toHaveCSS('background-color', 'rgb(255, 255, 255)'); await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#adm-mobile-more-close')).toBeFocused();
    expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(true);
    // Medir el diseño final después de la animación real, sin esperas fijas.
    await sheet.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    const bounds = await sheet.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThan(box.y);
    expect(await sheet.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    const last = sheet.locator('.adm-mobile-tab:visible').last(); await expect(last).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('#adm-mobile-more-close')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`mobile-modules-${width}.png`), fullPage: true });
    await page.setViewportSize({ width, height: 360 });
    const compact = await sheet.boundingBox(); expect(compact.y).toBeGreaterThanOrEqual(0); expect(compact.y + compact.height).toBeLessThan(360 - 76);
    await page.keyboard.press('Escape'); await expect(sheet).toBeHidden(); await expect(more).toBeFocused();
    await page.setViewportSize({ width, height: 800 });
    expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(false);
    await more.click(); await page.locator('#adm-mobile-more-backdrop').click({ position: { x: 2, y: 2 } });
    await expect(sheet).toBeHidden(); await expect(more).toBeFocused();
    await more.click(); await page.setViewportSize({ width: 844, height: 390 });
    await expect(sheet).toBeHidden(); expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(false);
    await expect(page.locator('body')).not.toHaveClass(/adm-mobile-more-open/);
    expect(await page.locator('#adm-sidebar').evaluate(node => node.inert)).toBe(false);
  });
}

test('drop-up conserva permisos, módulos tardíos y navegación nativa', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true });
  await page.evaluate(() => {
    document.querySelector('#adm-mobile-more-grid [data-section="configuracion"]').style.display = 'none';
    const button = document.createElement('button'); button.className = 'adm-mobile-tab'; button.dataset.section = 'welcome'; button.textContent = 'Mensaje de bienvenida';
    button.addEventListener('click', () => document.body.dataset.nativeNavigation = 'welcome');
    document.getElementById('adm-mobile-tabs').append(button);
  });
  await page.locator('#adm-mobile-more-toggle').click();
  await expect(page.locator('#adm-mobile-more-grid [data-section="configuracion"]')).toBeHidden();
  const native = page.locator('#adm-mobile-more-grid [data-section="welcome"]'); await expect(native).toBeVisible(); await native.click();
  await expect(page.locator('body')).toHaveAttribute('data-native-navigation', 'welcome');
  await expect(page.locator('#adm-mobile-more-sheet')).toBeHidden();
  expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(false);
});

test('drop-up y guardia conservan el borrador sin bloquear el panel', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  await page.evaluate(() => {
    const root = document.getElementById('section-configuracion');
    document.querySelector('.adm-section.active').classList.remove('active'); root.classList.add('active');
    window.AdminUnsaved.register('mobile-settings', { root, label: 'Configuración' });
    document.querySelector('#adm-mobile-more-grid [data-section="colecciones"]').addEventListener('click', () => window.AdminUnsaved.requestNavigation(() => { window.__navigated = true; }));
  });
  const field = page.locator('#section-configuracion input[type="text"]').first(); await field.fill('Borrador móvil');
  await page.evaluate(() => window.AdminUnsaved.markDirty('mobile-settings'));
  await page.locator('#adm-mobile-more-toggle').click();
  await page.locator('#adm-mobile-more-grid [data-section="colecciones"]').click();
  await expect(page.locator('#adm-mobile-more-sheet')).toBeHidden();
  const guard = page.locator('#unsaved-modal'); await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: /seguir editando/i }).click();
  await expect(field).toHaveValue('Borrador móvil'); expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(false);
  expect(await page.evaluate(() => window.__navigated)).toBeUndefined();
  // Imágenes usa un enlace externo al documento. La guardia real lo
  // intercepta en captura y debe recibir el panel ya liberado del drop-up.
  await page.locator('#adm-mobile-more-toggle').click();
  await page.locator('#adm-mobile-more-grid a[href*="admin-images"]').click();
  await expect(page.locator('#adm-mobile-more-sheet')).toBeHidden(); await expect(guard).toBeVisible();
  expect(await page.locator('.adm-main').evaluate(node => node.inert)).toBe(false);
  await guard.getByRole('button', { name: /seguir editando/i }).click();
  await expect(field).toHaveValue('Borrador móvil'); await expect(field).toBeEditable();
  await expect(page).toHaveURL('https://tintin.test/fixture');
  await expect(page.locator('#adm-mobile-more-toggle')).toBeFocused();
});

// Regresiones de enlaces push junto a la navegación real del panel.
require('./admin-push-navigation.spec.js');


for(const width of [320,390]) {
  // App móvil: sin cajón lateral; el buscador se abre desde la lupa superior.
  test(`buscar módulos desde la barra superior de la app a ${width}px`,async({page})=>{
    await load(page,width,'admin.html',{mobile:true,sidebar:true});
    await expect(page.locator('#adm-hamburger')).toBeHidden();
    const search=page.locator('.adm-topbar .tt-control-search');
    await search.click();
    await expect(page.getByRole('dialog',{name:'Buscar módulos'})).toBeVisible();
    await expect(page.getByLabel('Nombre del módulo')).toBeFocused();
    await expect(page.locator('#adm-sidebar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(search).toBeFocused();
  });
}

for (const width of [320, 768, 1440]) {
  test(`Páginas conserva input, cursor y teclado al buscar a ${width}px`, async ({ page }) => {
    const fs = require('node:fs');
    const source = fs.readFileSync(require('node:path').join(__dirname, '../../js/admin/pages/paginas-admin.js'), 'utf8');
    const code = source.slice(source.indexOf('const scheduleSearch ='), source.indexOf('\nfunction renderEditor('));
    await load(page, width);
    await page.evaluate(async code => {
      const { normalizeAdminSearch, debounceAdminSearch, renderAdminSearchMarkup } = await import('https://tintin.test/js/admin/datos/busqueda-admin.mjs');
      const host = document.createElement('div'); host.id = 'search-test-pages'; document.body.replaceChildren(host);
      const deps = { normalizeAdminSearch, debounceAdminSearch, renderAdminSearchMarkup,
        root: () => host, canUse: () => true, editing: null,
        pages: [{ title: 'Guía   de regalos', slug: 'guia', pageType: 'builtin', path: '/guia', published: true }],
        esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
        dateLabel: () => '—', openEditor() {}, removePage() {}, renderEditor() {} };
      window.__pagesDeps = deps;
      const script = document.createElement('script');script.nonce = 'dGludGluLWZpeHR1cmU=';
      script.textContent = `{ const {${Object.keys(deps).join(',')}} = window.__pagesDeps; ${code}; window.__pagesRender = render; render(); }`;
      document.body.append(script);
    }, code);
    const input = page.locator('#tt-pages-search'); await input.focus();
    await page.evaluate(() => { window.__pagesInput = document.activeElement; window.__pagesBlur = 0; document.activeElement.addEventListener('blur', () => window.__pagesBlur++); });
    await input.pressSequentially('GUIA  DE', { delay: 25 });
    await expect(page.locator('.tt-pages-title')).toHaveText('Guía   de regalos');
    await input.evaluate(node => { node.setSelectionRange(2, 4); window.__pagesRender(); });
    expect(await input.evaluate(node => ({ same: node === window.__pagesInput, focus: node === document.activeElement, blur: window.__pagesBlur, start: node.selectionStart, end: node.selectionEnd, value: node.value }))).toEqual({ same: true, focus: true, blur: 0, start: 2, end: 4, value: 'GUIA  DE' });
    await input.fill('sin coincidencias'); await expect(page.locator('.tt-pages-empty')).toBeVisible();
    await input.fill(''); await expect(page.locator('.tt-pages-title')).toHaveCount(1);
  });
}
