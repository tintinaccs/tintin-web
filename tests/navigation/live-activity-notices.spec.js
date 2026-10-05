const { test, expect } = require('@playwright/test');

for (const width of [390, 768, 1440]) {
  test(`aviso real de actividad cabe y desaparece a los tres segundos en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/about', { waitUntil: 'load' });
    await page.waitForSelector('body.tt-public-shell-mounted');
    await page.evaluate(() => window.TintinLoader?.hide?.());
    await page.clock.install({ time: new Date('2026-10-05T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-05T10:00:01Z'));
    // Esta importación se resuelve en el navegador, no junto al archivo Node.
    const browserModule = new URL('/js/components/notifications/avisos-en-vivo.mjs', test.info().project.use.baseURL).href;
    await page.evaluate(async moduleUrl => {
      const { createLiveActivityNotices } = await import(moduleUrl);
      const presenter = createLiveActivityNotices();
      const history = { id: 'history', title: 'Historial', read: false, createdAt: '2026-01-01' };
      await presenter.update('fixture:admin', [history]);
      await presenter.update('fixture:admin', [{ id: 'new', title: '<img src=x> Nueva actividad de prueba', body: 'Sólo fixture local: no se envía push ni se escribe en Firestore.', read: false, createdAt: '2026-10-05' }, history]);
    }, browserModule);
    const notice = page.locator('.tt-live-activity-notice');
    await expect(page.locator('.tt-live-activity')).toHaveCSS('position', 'fixed');
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(await notice.locator('img').count()).toBe(0);
    const bounds = await notice.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(15);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 15);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(width < 768 ? 810 : 884);
    await page.clock.fastForward(2999);
    await expect(notice).toHaveCount(1);
    await page.clock.fastForward(1);
    await expect(notice).toHaveCount(0);
  });
}
