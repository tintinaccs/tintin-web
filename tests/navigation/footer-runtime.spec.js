const { test, expect } = require('@playwright/test');
const FOOTER_COPYRIGHT = `© 2024-${new Date().getUTCFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;

for (const width of [390, 1440]) {
  test(`Inicio y Nosotros conservan el mismo pie después de arrancar y volver a la página · ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/about']) {
      await page.goto(route);
      await expect(page.locator('body')).toHaveClass(/tt-public-shell-mounted/);
      if (route === '/') await page.waitForFunction(() => window.TintinHomeMaintenanceBooted === true);
      const copyright = page.locator('#tt-footer-ending .tt-footer-bottom');
      await expect(copyright).toHaveText(FOOTER_COPYRIGHT);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await expect(copyright).toHaveText(FOOTER_COPYRIGHT);
      await expect(page.locator('footer .novak-credit')).toHaveCount(1);
      await expect(page.locator('footer .tt-footer-col')).toHaveCount(3);
    }
  });
}
