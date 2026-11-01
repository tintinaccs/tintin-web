// App móvil del panel (≤768px): barra superior, barra inferior, hoja "Más"
// agrupada, Volver, Atrás del navegador sobre ventanas y hoja de filtros.
// Fixture con markup y estilos reales, sin sesión, red ni datos reales.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const show = (page, id) => page.evaluate(id => {
  document.querySelectorAll('.adm-content > .adm-section').forEach(n => n.classList.toggle('active', n.id === `section-${id}`));
}, id);

for (const width of [320, 390, 540, 768]) {
  test(`barra inferior, Más agrupado y barra superior a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await expect(page.locator('html')).toHaveClass(/\badm-app\b/);
    const tabs = await page.locator('#adm-mobile-tabs > .adm-mobile-tab').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => n.textContent.trim().replace(/\s+/g, ' ')));
    expect(tabs).toEqual(['Inicio', 'Pedidos', 'Productos', 'Usuarios', '•••Más']);
    // Barra superior en una fila: título y búsqueda a la misma altura.
    const bar = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      return { title: r('.adm-topbar-title'), search: r('.adm-topbar .tt-control-search') };
    });
    expect(Math.abs((bar.title.top + bar.title.height / 2) - (bar.search.top + bar.search.height / 2))).toBeLessThanOrEqual(4);
    expect(bar.search.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#adm-hamburger')).toBeHidden();

    await page.locator('#adm-mobile-more-toggle').click();
    await expect(page.locator('#adm-mobile-more-sheet')).toBeVisible();
    const groups = await page.locator('#adm-mobile-more-grid .adm-more-group').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({
      title: n.querySelector('.adm-more-group-title')?.textContent.trim() || '',
      items: [...n.querySelectorAll('.adm-mobile-tab')].filter(t => t.getClientRects().length).map(t => t.textContent.trim().replace(/\s+/g, ' '))
    })));
    expect(groups.map(g => g.title)).toEqual(['Resumen', 'Operación', 'Catálogo', 'Comunicación', 'Control', 'Tu tienda', 'Cuenta']);
    expect(groups[0].items).toContain('Estadísticas');
    expect(groups.at(-1).items).toEqual(['Ver tienda', 'Salir']);
    const rows = await page.locator('#adm-mobile-more-grid .adm-mobile-tab').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => {
      const r = n.getBoundingClientRect(); return { h: r.height, right: r.right, font: parseFloat(getComputedStyle(n).fontSize) };
    }));
    for (const row of rows) { expect(row.h).toBeGreaterThanOrEqual(44); expect(row.right).toBeLessThanOrEqual(width); expect(row.font).toBeGreaterThanOrEqual(15); }
    // La hoja flotante queda centrada (no desplazada).
    const sheet = await page.locator('#adm-mobile-more-sheet').boundingBox();
    expect(Math.abs((sheet.x + sheet.width / 2) - width / 2)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Volver aparece solo fuera de los accesos principales y usa Atrás', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  const back = page.locator('#adm-app-back');
  await expect(back).toBeHidden();
  for (const id of ['pedidos', 'productos', 'usuarios']) { await show(page, id); await expect(back).toBeHidden(); }
  await page.evaluate(() => history.pushState({ ttAdminIndex: 1 }, '', '#correos'));
  await show(page, 'correos');
  await expect(back).toBeVisible();
  expect((await back.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  // Entrada directa (sin historial propio): Volver abre "Más".
  await page.evaluate(() => history.replaceState({ ttAdminIndex: 0 }, '', location.href));
  await back.click();
  await expect(page.locator('#adm-mobile-more-sheet')).toBeVisible();
});

test('"+ Nuevo pedido" solo en Pedidos', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  const button = page.locator('.adm-topbar-actions a[href="/checkout"]');
  await expect(button).toBeHidden();
  await show(page, 'pedidos');
  await expect(button).toBeVisible();
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await show(page, 'configuracion');
  await expect(button).toBeHidden();
});

test('Atrás del navegador cierra la ventana completa sin salir de la pantalla', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  await page.evaluate(() => {
    window.__closed = 0;
    window.closeClientFicha = () => { window.__closed++; document.getElementById('client-ficha-overlay').style.display = 'none'; };
    document.getElementById('client-ficha-overlay').style.display = 'flex';
  });
  const url = page.url();
  await expect.poll(() => page.evaluate(() => history.state?.ttAppOverlay)).toBe('client-ficha-overlay');
  await page.goBack();
  await expect(page.locator('#client-ficha-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__closed)).toBe(1);
  expect(page.url()).toBe(url);
  // Cerrar con su propio botón también retira la entrada agregada.
  await page.evaluate(() => { document.getElementById('client-ficha-overlay').style.display = 'flex'; });
  await expect.poll(() => page.evaluate(() => history.state?.ttAppOverlay)).toBe('client-ficha-overlay');
  await page.evaluate(() => window.closeClientFicha());
  await expect.poll(() => page.evaluate(() => history.state?.ttAppOverlay ?? null)).toBe(null);
  expect(page.url()).toBe(url);
});

test('hoja de filtros mueve y devuelve los controles reales', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'qa-filters';
    host.innerHTML = '<select id="qa-state" class="adm-select"><option>Todos</option><option>Pagado</option></select>';
    document.getElementById('section-dashboard').prepend(host);
    window.__changes = 0;
    document.getElementById('qa-state').addEventListener('change', () => window.__changes++);
    const opener = document.createElement('button'); opener.id = 'qa-open'; opener.className = 'adm-app-filter-btn'; opener.textContent = 'Filtros';
    host.after(opener);
    opener.addEventListener('click', () => window.AdmApp.openSheet({ title: 'Filtros', nodes: [document.getElementById('qa-state')], opener }));
  });
  await page.locator('#qa-open').click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('#qa-state')).toBeVisible();
  await sheet.locator('#qa-state').selectOption('Pagado');
  expect(await page.evaluate(() => window.__changes)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => document.getElementById('qa-state').parentElement.id)).toBe('qa-filters');
  await expect(page.locator('#qa-open')).toBeFocused();
});

test('movimiento reducido desactiva las transiciones de pantalla', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true, guard: true });
  expect(await page.locator('#section-dashboard').evaluate(n => getComputedStyle(n).animationName)).toBe('none');
});

for (const width of [820, 1024, 1440]) {
  test(`tablet y escritorio no entran en modo app a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true, guard: true });
    await expect(page.locator('html')).not.toHaveClass(/\badm-app\b/);
    await expect(page.locator('#adm-app-back')).toBeHidden();
    await expect(page.locator('#adm-sidebar')).toBeVisible();
    await expect(page.locator('#adm-mobile-tabs')).toBeHidden();
  });
}
