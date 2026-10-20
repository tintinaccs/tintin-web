const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const html = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../about.html'), 'utf8'));

for (const width of [320, 390, 767, 768, 1024, 1440]) {
  test(`fotos alternadas, historia y firma centrada sin recuadro en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/__about-story', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/__about-story');
    await page.evaluate(() => document.documentElement.classList.add('tt-about-maintained'));
    const photo = page.locator('#historia .tt-about-portrait');
    const intro = page.locator('#historia .tt-about-content');
    const photoBox = await photo.boundingBox();
    const introBox = await intro.boundingBox();
    if (width >= 768) {
      expect(introBox.x + introBox.width).toBeLessThanOrEqual(photoBox.x);
      const childhood = await page.locator('.tt-about-childhood').boundingBox();
      const originText = await page.locator('#origen .tt-about-content').boundingBox();
      expect(childhood.x + childhood.width).toBeLessThanOrEqual(originText.x);
    } else {
      expect(introBox.y).toBeGreaterThan(photoBox.y + photoBox.height);
    }
    await expect(page.locator('#origen h2')).toHaveText('¿Por qué Tintin se llama Tintin? 🎀');
    await expect(page.locator('#origen .tt-about-mission-text')).toHaveCount(5);
    await expect(page.locator('#origen [data-instagram-video]')).toHaveAttribute('href', 'https://www.instagram.com/reel/DekE_RMBPjv/');
    await expect(page.locator('.tt-about-actions, .tt-about-signature')).toHaveCount(0);
    await expect(page.locator('.tt-about-childhood figcaption')).toHaveCount(0);
    const child = page.locator('.tt-about-childhood img');
    await child.scrollIntoViewIfNeeded();
    await expect.poll(() => child.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const signature = page.locator('#historia .tt-about-handwritten-signature');
    await expect(signature).toHaveCount(1);
    await expect(page.locator('#origen .tt-about-handwritten-signature')).toHaveCount(0);
    const signatureBox = await signature.boundingBox();
    const currentPhotoBox = await photo.boundingBox();
    const currentIntroBox = await intro.boundingBox();
    if (width >= 768) {
      expect(signatureBox.y).toBeGreaterThanOrEqual(currentPhotoBox.y + currentPhotoBox.height);
      expect(Math.abs(signatureBox.x + signatureBox.width / 2 - currentPhotoBox.x - currentPhotoBox.width / 2)).toBeLessThanOrEqual(1);
    } else {
      expect(signatureBox.y).toBeGreaterThanOrEqual(currentIntroBox.y + currentIntroBox.height);
      const originBox = await page.locator('#origen').boundingBox();
      expect(signatureBox.y + signatureBox.height).toBeLessThanOrEqual(originBox.y);
    }
    await signature.scrollIntoViewIfNeeded();
    await expect.poll(() => signature.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const alignment = await signature.evaluate(img => {
      const box = img.getBoundingClientRect();
      const parent = (innerWidth < 768 ? img.closest('.tt-about-grid') : img.parentElement).getBoundingClientRect();
      return { center: (box.left + box.right) / 2, parentCenter: (parent.left + parent.right) / 2, width: box.width, available: parent.width };
    });
    expect(Math.abs(alignment.center - alignment.parentCenter)).toBeLessThanOrEqual(1);
    expect(alignment.width).toBeLessThanOrEqual(alignment.available);
    for (const tone of ['light', 'pink']) {
      await page.locator('#historia').evaluate((el, tone) => el.dataset.ttFlowBlock = tone, tone);
      await expect(signature).toHaveCSS('filter', new RegExp(tone === 'pink' ? 'tt-signature-light' : 'tt-signature-dark'));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('.tt-about-portrait-frame')).toHaveCSS('border-top-width', '0px');
  });
}

for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [820, 1180], [1180, 820], [1366, 768], [1440, 900], [1920, 1080]]) {
  test(`editorial sin bordes ni bandas antes y después del runtime en ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const home = removeFixtureScripts(fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8'), { removeModulePreloads: true });
    await page.route('**/__home-editorial', route => route.fulfill({ contentType: 'text/html', body: home }));
    await page.route('**/images/imagenes.js*', route => route.fulfill({ contentType: 'text/javascript', body: `export const HERO_IMAGE_CONFIG_VERSION='fixture';export const HERO_IMAGE_FALLBACKS={};export const resolveSlotImage=()=>'';export function onImagesUpdate(callback){callback({});callback({});}` }));
    await page.goto('/__home-editorial');
    const feature = page.locator('.tt-watch-feature');
    await feature.scrollIntoViewIfNeeded();
    const check = async () => {
      const image = feature.locator('img');
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveCSS('object-fit', 'cover');
      await expect(feature).toHaveCSS('border-top-width', '0px');
      await expect(feature).toHaveCSS('border-bottom-width', '0px');
      await expect(feature).toHaveCSS('box-shadow', 'none');
      const sizes = await feature.evaluate(el => {
        const media = el.querySelector('.tt-watch-feature-img').getBoundingClientRect();
        const image = el.querySelector('img').getBoundingClientRect();
        return { column: media.height, image: image.height, top: Math.abs(media.top - image.top), bottom: Math.abs(media.bottom - image.bottom) };
      });
      expect(sizes.column).toBeGreaterThan(0);
      expect(Math.abs(sizes.column - sizes.image)).toBeLessThanOrEqual(1);
      expect(sizes.top).toBeLessThanOrEqual(1);
      expect(sizes.bottom).toBeLessThanOrEqual(1);
      for (const node of await feature.locator('.tt-watch-feature-img, .tt-img-placeholder, picture, img').all()) {
        await expect(node).toHaveCSS('border-top-width', '0px');
        await expect(node).toHaveCSS('border-bottom-width', '0px');
        await expect(node).toHaveCSS('box-shadow', 'none');
      }
      await expect(feature.locator('.tt-img-placeholder')).toHaveCSS('background-image', 'none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    };
    await check();
    await page.addScriptTag({ type: 'module', url: '/js/components/images/gestion-imagenes.js' });
    await expect(feature.locator('picture[data-tt-image-phase5]')).toHaveCount(1);
    await check();
  });
}
