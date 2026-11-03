const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sizes = [[320, 568], [568, 320], [768, 1024], [1024, 768], [1366, 768], [768, 1366], [1920, 1080], [1080, 1920]];

for (const deviceScaleFactor of [2, 3]) {
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
          expect(metrics.naturalWidth, `${selector} ${width}×${height}`).toBeGreaterThanOrEqual(Math.ceil(metrics.width * metrics.dpr));
          expect(metrics.naturalHeight).toBeGreaterThanOrEqual(Math.ceil(metrics.height * metrics.dpr));
          expect(metrics.filter).not.toContain('blur(');
          expect(metrics.opacity).toBe('1');
          await expect(image).toBeVisible();
        }
      }
      const original = fs.readFileSync(path.join(__dirname, '../../assets-tintin/novak-signature/novak-mark.svg'));
      expect(createHash('sha256').update(original).digest('hex')).toBe('d031d3ee6ef4df3f62f3a5995d858d6a169ee2681f69de9cf8251720f1ff05f1');
    } finally { await context.close(); }
  });
}
