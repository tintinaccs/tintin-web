const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const home = fs.readFileSync('index.html', 'utf8');
const preload = home.match(/<link rel="preload" as="image"[^>]+>/g).join('');
const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)[0];
for (const [width, height, device] of [[390,844,'mobile'],[820,1180,'tablet-vertical'],[1024,768,'tablet-horizontal'],[1366,768,'desktop']]) {
  test(`precarga sólo el banner elegido por picture en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const requests = [];
    await page.route('**/hero-nuevo/*', async route => {
      const url = new URL(route.request().url()); if (/\/hero-nuevo-[^/]+\.(webp|png)$/.test(url.pathname)) requests.push(url.pathname);
      await route.fulfill({ body: fs.readFileSync('.' + url.pathname), contentType: 'image/webp' });
    });
    await page.setContent(`<base href="http://tintin.test/">${preload}${hero}`);
    await expect.poll(() => page.locator('#tt-hero-img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(requests).toEqual([`/assets-tintin/images/home/hero-nuevo/hero-nuevo-${device}.webp`]);
  });
}
