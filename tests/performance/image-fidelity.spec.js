const { test, expect } = require('@playwright/test');
test.use({ deviceScaleFactor: 2 });

test('About conserva resolución Retina después del snapshot y respeta la foto personalizada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/__image-quality', route => route.fulfill({ contentType: 'text/html', body: '<div data-img-slot="about_foto" style="width:358px;height:398px"></div>' }));
  await page.route('**/images/imagenes.js*', route => route.fulfill({ contentType: 'text/javascript', body: `export const HERO_IMAGE_CONFIG_VERSION='fixture';export const HERO_IMAGE_FALLBACKS={};export const resolveSlotImage=(values,slot,device)=>values[slot+'_'+device]||values[slot]||'';export function onImagesUpdate(callback){window.confirmImages=callback;callback({});callback({});}` }));
  await page.goto('/__image-quality');
  await page.addScriptTag({ type: 'module', url: '/js/components/images/gestion-imagenes.js' });
  const image = page.locator('[data-img-slot="about_foto"] img');
  await expect.poll(() => image.evaluate(img => img.currentSrc)).toMatch(/barbi-historia-tablet.webp$/);
  const custom = '/assets-tintin/images/nosotros/barbi-mision/barbi-mision-desktop.webp?custom=1';
  await page.evaluate(custom => window.confirmImages({ about_foto_mobile: custom }), custom);
  await expect.poll(() => image.evaluate(img => img.currentSrc)).toContain('?custom=1');
});

test('las nuevas fotos conservan detalle hasta 4K sin ampliar originales pequeños', async ({ page }) => {
  await page.goto('/404.html');
  const results = await page.evaluate(async () => {
    const { processImage } = await import('../../js/components/images/procesamiento-imagenes.js');
    const output = [];
    for (const [width, height] of [[4000, 2400], [640, 480]]) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F8AACA'; ctx.fillRect(0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'foto.png', { type: 'image/png' });
      const result = await processImage(file);
      const full = await createImageBitmap(result.fullBlob);
      const thumb = await createImageBitmap(result.thumbBlob);
      output.push({ width: full.width, height: full.height, thumbWidth: thumb.width, thumbHeight: thumb.height, sourcePreserved: result.fullBlob === file });
      full.close(); thumb.close();
    }
    return output;
  });
  expect(results).toEqual([
    { width: 3840, height: 2304, thumbWidth: 320, thumbHeight: 192, sourcePreserved: false },
    { width: 640, height: 480, thumbWidth: 320, thumbHeight: 240, sourcePreserved: true },
  ]);
});
