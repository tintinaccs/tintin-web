// App móvil, Fase 26 · Ver tienda y Salir: en ≤768 viven en el grupo "Cuenta" de la hoja "Más" con toques ≥44 px.
// No se pulsa Salir (cerraría la sesión real); solo se comprueba que existe, es visible y apunta a lo correcto.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [320, 390, 540, 768]) {
  test(`cuenta (Ver tienda / Salir) en modo app a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    await page.locator('#adm-mobile-more-toggle').click();
    await expect(page.locator('#adm-mobile-more-sheet')).toBeVisible();
    const store = page.locator('#adm-mobile-more-grid a.adm-mobile-tab[href="/"]');
    const out = page.locator('#adm-mobile-more-grid #mtab-logout');
    await expect(store).toBeVisible();
    await expect(out).toBeVisible();
    for (const el of [store, out]) {
      const b = await el.boundingBox();
      expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
    }
    expect((await store.textContent()).trim().toLowerCase()).toContain('tienda');
    expect((await out.textContent()).trim().toLowerCase()).toContain('salir');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [820, 1024, 1440]) {
  test(`cuenta sin cambios de app a ${width}px (salir del menú lateral)`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    expect(await page.evaluate(() => document.documentElement.classList.contains('adm-app'))).toBe(false);
    expect(await page.locator('#adm-logout').count()).toBe(1);
  });
}
