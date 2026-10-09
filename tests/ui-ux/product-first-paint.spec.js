const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
// HTML/CSS reales sin SDK: comprueba la ficha antes de cargar los módulos diferidos.
const html = fs.readFileSync('product.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`Producto usa el diseño final antes de ejecutar módulos en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/product-first-paint', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/product-first-paint');
    await page.evaluate(() => {
      document.getElementById('product-grid').style.display = 'grid';
      document.getElementById('product-loading').style.display = 'none';
      document.getElementById('product-name').textContent = 'GAFAS ÉLISE';
    });
    const panel = page.locator('.tt-product-info-panel');
    const styles = () => panel.evaluate(el => {
      const css = getComputedStyle(el);
      return { border: css.borderTopWidth, radius: css.borderTopLeftRadius, shadow: css.boxShadow, padding: css.padding };
    });
    const initial = await styles();
    expect(initial.border).toBe('0px');
    expect(initial.radius).toBe('0px');
    expect(initial.shadow).toBe('none');
    await page.evaluate(() => document.body.classList.add('tt-product-maintenance', 'tt-product-runtime-ready'));
    expect(await styles()).toEqual(initial);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
