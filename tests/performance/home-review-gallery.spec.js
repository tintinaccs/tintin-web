const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const html = removeFixtureScripts(fs.readFileSync('index.html', 'utf8'), { removeModulePreloads: true });
const runtime = fs.readFileSync('js/pages/home/resenas-clientas.js', 'utf8');

for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  test(`reseñas reales: cuatro imágenes y galería accesible sin cargarla antes de abrir · ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/__home-reviews', route => route.fulfill({ contentType: 'text/html', body: html }));
    const requested = [];
    page.on('request', request => {
      if (request.url().includes('/resenas-clientas/') && request.url().endsWith('.jpg')) requested.push(request.url());
    });
    await page.goto('/__home-reviews');
    await page.addScriptTag({ content: runtime });
    const preview = page.locator('.tt-reviews-section .tt-review-screen img');
    await expect(preview).toHaveCount(4);
    const more = page.getByRole('button', { name: 'Ver más reseñas' });
    await more.scrollIntoViewIfNeeded();
    await expect.poll(() => preview.evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(requested.length).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await more.click();
    const dialog = page.locator('#tt-reviews-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveCount(23);
    const close = dialog.getByRole('button', { name: 'Cerrar reseñas' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    // El diálogo nativo también permite pasar a la barra del navegador;
    // nunca debe enviar el foco a un enlace de la página de fondo.
    expect(await dialog.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
    await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect(await close.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.right <= innerWidth && node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(more).toBeFocused();
    await more.click();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(more).toBeFocused();
    await expect(dialog.locator('img')).toHaveCount(23);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    const imageButton=page.getByRole('button',{name:'Reseña de una clienta de Tintin, captura 1. Abrir galería de reseñas',exact:true});
    await imageButton.click();await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');await expect(imageButton).toBeFocused();
    await page.keyboard.press('Enter');await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');await expect(imageButton).toBeFocused();
  });
}
