'use strict';

const { test, expect } = require('@playwright/test');

// Área táctil mínima de 44 px en el Catálogo (auditoría responsive/a11y 2026-10-31):
// enlace del título de cada tarjeta y opciones del filtro lateral.
async function openCatalog(page, width) {
  const base = new URL(test.info().project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173');
  await page.context().addCookies([{ name: 'tt_privacy_choice', value: 'v2.necessary', url: base.origin }]);
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.setViewportSize({ width, height: 850 });
  await page.goto('/catalogo', { waitUntil: 'load' });
}

for (const width of [320, 768, 1440]) {
  test(`el enlace del título de tarjeta mide al menos 44px de alto en ${width}px sin alterar la tarjeta`, async ({ page }) => {
    await openCatalog(page, width);
    const link = page.locator('.tt-card-name a').first();
    await expect(link).toBeVisible();
    const m = await link.evaluate(a => ({
      link: a.getBoundingClientRect().height,
      block: a.parentElement.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(a.parentElement).lineHeight) || 0,
      hScroll: document.documentElement.scrollWidth > innerWidth
    }));
    expect(m.link).toBeGreaterThanOrEqual(44);
    expect(m.block).toBeLessThanOrEqual(m.line * 3 + 1);
    expect(m.hScroll).toBe(false);
  });
}

test('las opciones del filtro lateral miden al menos 44px de alto en escritorio', async ({ page }) => {
  await openCatalog(page, 1440);
  const options = page.locator('.cat-filter-option:visible');
  await expect(options.first()).toBeVisible();
  const heights = await options.evaluateAll(list => list.map(e => e.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});
