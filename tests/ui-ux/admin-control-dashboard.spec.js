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
    await expect(page.getByRole('heading', { name: 'Tu tienda, en foco.' })).toBeVisible();
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
