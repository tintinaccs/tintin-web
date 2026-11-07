const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// El tamaño natural de un SVG es su viewport, no la resolución del PNG
// que encapsula el kit. Calculamos la cobertura real de píxeles del recorte.
const mark = fs.readFileSync(path.join(__dirname, '../../assets-tintin/novak-signature/novak-mark.svg'), 'utf8');
const crop = mark.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const imageSize = mark.match(/<image[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
const bitmap = Buffer.from(mark.match(/data:image\/png;base64,([^"]+)/)[1], 'base64');
const markPixels = { width: crop[2] * bitmap.readUInt32BE(16) / Number(imageSize[1]), height: crop[3] * bitmap.readUInt32BE(20) / Number(imageSize[2]) };
const sizes = [[320, 568], [568, 320], [768, 1024], [1024, 768], [1366, 768], [768, 1366], [1920, 1080], [1080, 1920]];

for (const deviceScaleFactor of [1, 2, 3, 4]) {
  test(`logos originales con resolución suficiente a densidad ${deviceScaleFactor}×, de móvil a Full HD`, async ({ browser, baseURL }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({ deviceScaleFactor });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/about', baseURL).href);
      await expect(page.locator('body')).toHaveClass(/tt-public-shell-mounted/);
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.locator('footer .novak-credit').scrollIntoViewIfNeeded();
        for (const selector of ['footer .tt-logo-img', 'footer .novak-credit img']) {
          const image = page.locator(selector);
          await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
          const metrics = await image.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return { width: rect.width, height: rect.height, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, dpr: devicePixelRatio, filter: style.filter, opacity: style.opacity };
          });
          const capacity = selector.includes('novak-credit') ? markPixels : { width: metrics.naturalWidth, height: metrics.naturalHeight };
          expect(capacity.width, `${selector} ${width}×${height}`).toBeGreaterThanOrEqual(Math.ceil(metrics.width * metrics.dpr));
          expect(capacity.height).toBeGreaterThanOrEqual(Math.ceil(metrics.height * metrics.dpr));
          expect(metrics.filter).not.toContain('blur(');
          expect(metrics.opacity).toBe('1');
          await expect(image).toBeVisible();
        }
      }
      // El render interno no debe cambiar el desplazamiento ni la escala
      // perceptibles del kit al usar ratón, teclado o movimiento reducido.
      const credit = page.locator('footer .novak-credit');
      const image = credit.locator('img');
      const relative = () => image.evaluate(el => {
        const box = el.getBoundingClientRect();
        const link = el.closest('.novak-credit').getBoundingClientRect();
        return { center: box.x + box.width / 2 - link.x, width: box.width };
      });
      await page.mouse.move(0, 0);
      const initial = await relative();
      await credit.hover();
      await expect.poll(async () => (await relative()).center - initial.center).toBeCloseTo(2, 1);
      await expect.poll(async () => (await relative()).width).toBeCloseTo(initial.width * 1.06, 1);
      await page.mouse.move(0, 0);
      await credit.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(credit).toBeFocused();
      await expect.poll(() => credit.evaluate(el => el.matches(':focus-visible'))).toBe(true);
      await expect.poll(async () => (await relative()).center - initial.center).toBeCloseTo(2, 1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(async () => (await relative()).center).toBeCloseTo(initial.center, 1);
      await expect.poll(async () => (await relative()).width).toBeCloseTo(initial.width, 1);
      const original = fs.readFileSync(path.join(__dirname, '../../assets-tintin/novak-signature/novak-mark.svg'));
      expect(createHash('sha256').update(original).digest('hex')).toBe('d031d3ee6ef4df3f62f3a5995d858d6a169ee2681f69de9cf8251720f1ff05f1');
    } finally { await context.close(); }
  });
}
