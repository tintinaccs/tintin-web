const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
test.use({ hasTouch: true });
const css = fs.readFileSync('css/quality/accesibilidad-global.css', 'utf8');
for (const width of [320, 390, 768]) {
  test(`aviso informativo no intercepta Continuar y Reintentar funciona en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.setContent(`<style>${css}</style><button id="continue">Continuar</button><aside class="tt-connectivity-status" role="status"><span class="tt-connectivity-status-text">Estás sin conexión</span><button class="tt-connectivity-retry">Reintentar</button></aside>`);
    await page.evaluate(() => {
      window.continued = 0; window.retried = 0;
      const target = document.getElementById('continue');
      const text = document.querySelector('.tt-connectivity-status-text').getBoundingClientRect();
      Object.assign(target.style, { position:'fixed', left:`${text.x}px`, top:`${text.y}px`, width:`${text.width}px`, height:`${text.height}px` });
      target.onclick = () => window.continued++;
      document.querySelector('.tt-connectivity-retry').onclick = () => window.retried++;
    });
    await page.locator('#continue').tap();
    expect(await page.evaluate(() => window.continued)).toBe(1);
    await page.locator('.tt-connectivity-retry').tap();
    expect(await page.evaluate(() => window.retried)).toBe(1);
    await expect(page.getByRole('status')).toBeVisible();
  });
}
