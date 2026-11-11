const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const home = fs.readFileSync('index.html', 'utf8');
const preload = home.match(/<link rel="preload" as="image"[^>]+>/g).join('');
const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)[0];
for (const [width, height] of [[390,844],[820,1180],[1024,768],[1366,768]]) {
  test(`precarga una sola variante WebP del maletín elegida por picture en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const requests = [];
    await page.route('**/assets-tintin/**', async route => {
      const url = new URL(route.request().url());
      if (/\/suitcase(?:-\d+)?\.(?:png|webp)$/.test(url.pathname)) requests.push(url.pathname);
      const types = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      await route.fulfill({ body: fs.readFileSync('.' + url.pathname), contentType: types[path.extname(url.pathname)] });
    });
    await page.setContent(`<base href="http://tintin.test/">${preload}${hero}`);
    const suitcase = page.locator('.tt-hero-suitcase img');
    await expect.poll(() => suitcase.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect.poll(() => page.locator('#tt-hero-img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const expected = '/assets-tintin/images/home/hero-reference/suitcase-640.webp';
    expect(new URL(await suitcase.evaluate(img => img.currentSrc)).pathname).toBe(expected);
    expect(requests).toEqual([expected]);
  });
}
