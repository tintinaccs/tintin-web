const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../about.html'), 'utf8'));

for (const width of [390, 768, 1024, 1440]) {
  test(`historia personal, foto primero y firma sin recuadro en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/__about-story', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/__about-story');
    await page.evaluate(() => document.documentElement.classList.add('tt-about-maintained'));
    const photo = page.locator('#historia .tt-about-portrait');
    const intro = page.locator('#historia .tt-about-content');
    const photoBox = await photo.boundingBox();
    const introBox = await intro.boundingBox();
    expect(introBox.y).toBeGreaterThan(photoBox.y + photoBox.height);
    await expect(page.locator('#origen h2')).toHaveText('¿Por qué Tintin se llama Tintin? 🎀');
    await expect(page.locator('#origen .tt-about-mission-text')).toHaveCount(7);
    await expect(page.locator('.tt-about-actions, .tt-about-signature')).toHaveCount(0);
    await expect(page.locator('.tt-about-childhood figcaption')).toHaveCount(0);
    const child = page.locator('.tt-about-childhood img');
    await child.scrollIntoViewIfNeeded();
    await expect.poll(() => child.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const signature = page.locator('.tt-about-handwritten-signature');
    await signature.scrollIntoViewIfNeeded();
    await expect.poll(() => signature.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const alignment = await signature.evaluate(img => {
      const box = img.getBoundingClientRect();
      const parent = img.parentElement.getBoundingClientRect();
      return { center: (box.left + box.right) / 2, parentCenter: (parent.left + parent.right) / 2, width: box.width, available: parent.width };
    });
    expect(Math.abs(alignment.center - alignment.parentCenter)).toBeLessThanOrEqual(1);
    expect(alignment.width).toBeLessThanOrEqual(alignment.available);
    for (const tone of ['light', 'pink']) {
      await page.locator('#origen').evaluate((el, tone) => el.dataset.ttFlowBlock = tone, tone);
      await expect(signature).toHaveCSS('filter', new RegExp(tone === 'pink' ? 'tt-signature-light' : 'tt-signature-dark'));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('.tt-about-portrait-frame')).toHaveCSS('border-top-width', '0px');
  });
}

for (const width of [768, 1024, 1440]) {
  test(`editorial sin bordes y foto con el alto de su columna en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const home = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8'));
    await page.route('**/__home-editorial', route => route.fulfill({ contentType: 'text/html', body: home }));
    await page.goto('/__home-editorial');
    const feature = page.locator('.tt-watch-feature');
    await feature.scrollIntoViewIfNeeded();
    await expect(feature).toHaveCSS('border-top-width', '0px');
    const sizes = await feature.evaluate(el => {
      const media = el.querySelector('.tt-watch-feature-img');
      const image = media.querySelector('img');
      return { column: media.getBoundingClientRect().height, image: image.getBoundingClientRect().height };
    });
    expect(sizes.column).toBeGreaterThan(0);
    expect(Math.abs(sizes.column - sizes.image)).toBeLessThanOrEqual(1);
  });
}
