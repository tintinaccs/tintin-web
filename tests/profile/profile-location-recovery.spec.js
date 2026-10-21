const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const profile = fs.readFileSync(path.resolve(__dirname, '../../perfil.html'), 'utf8');
const mapImport = profile.split('import { createLocationMap, renderSavedMapPreviews }')[1].split('"')[1];
const editor = profile.match(/<div[^>]+id="perfil-location-editor"[\s\S]*?id="btn-cancelar-ubicacion"[^>]*>[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/)[0].replace(/ hidden/g, '');
const styles = [...profile.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('');
const summary = profile.slice(profile.indexOf('const setLocationSummary ='), profile.indexOf('const ensureLocationMap ='));
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body><main class="perfil-wrap"><div class="perfil-card"><div class="perfil-body">${editor}</div></div></main><script type="module">
import {createLocationMap} from '${mapImport}';
const locationSelected=document.getElementById('perfil-location-selected');${summary}
window.controller=await createLocationMap({mapEl:document.getElementById('perfil-location-map'),locateButton:document.getElementById('perfil-location-locate'),onChange:place=>{window.picked=place;setLocationSummary(place);}});
window.ready=true;</script></body></html>`;

test('un fondo de mapa caído no oculta el resultado de ubicación ni permite guardar un punto vacío', async ({page, context}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:-25.3,longitude:-57.6,accuracy:25});
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/__profile-map', route => route.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto('/__profile-map');
  await page.waitForFunction(() => window.ready);
  await expect(page.locator('.tt-map-tile-status')).toBeVisible();
  await expect(page.locator('#btn-guardar-ubicacion')).toBeDisabled();
  await page.locator('#perfil-location-locate').click();
  await expect(page.locator('.tt-map-status')).toContainText('Ubicación encontrada');
  await expect(page.locator('#btn-guardar-ubicacion')).toBeEnabled();
  await expect(page.locator('.tt-map-tile-status')).toBeVisible();
  expect(await page.evaluate(() => window.picked.lat)).toBe(-25.3);
});

for (const [width, height] of [[320, 740], [390, 844], [600, 960], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
  test(`perfil marca ubicación y libera el botón · ${width}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -25.3, longitude: -57.6, accuracy: 20 });
    await page.route('**/__profile-map', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.goto('/__profile-map');
    await page.waitForFunction(() => window.ready);
    const button = page.locator('#perfil-location-locate');
    const save = page.locator('#btn-guardar-ubicacion');
    await expect(save).toBeDisabled();
    await button.click();
    await expect.poll(() => page.evaluate(() => window.picked?.lat)).toBe(-25.3);
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page.locator('.tt-map-status')).toContainText('Ubicación encontrada');
    await expect(save).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of ['#perfil-location-search', '#perfil-location-name', '#perfil-location-address', '#perfil-location-map', '#btn-guardar-ubicacion', '#btn-cancelar-ubicacion']) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await save.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
    if ([390, 1440].includes(width)) await page.screenshot({ path: path.resolve(__dirname, `../../../../outputs/ubicacion-${width}.png`), fullPage: true });
    // Una respuesta GPS tardía no reemplaza el punto que el usuario eligió.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {getCurrentPosition: ok => {window.finishGPS=ok;}} });
    });
    await button.click();
    await page.evaluate(() => {
      window.controller.setLocation({lat:-25.32,lng:-57.62,name:'Casa'}, {scroll:false});
      window.finishGPS({coords:{latitude:-25.4,longitude:-57.7,accuracy:20}});
    });
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => window.picked.lat)).toBe(-25.32);
    await page.clock.install();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {getCurrentPosition: () => {}} });
    });
    await button.click();
    await expect(button).toBeDisabled();
    await page.clock.runFor(11000);
    await page.clock.runFor(16000);
    await expect(button).toBeEnabled();
    await expect(page.locator('.tt-map-status')).toContainText('tardó demasiado');
    expect(await page.evaluate(() => window.picked.lat)).toBe(-25.32);
    // Cancelar permite volver a abrir e iniciar otra búsqueda sin esperar al proveedor.
    await button.click();
    await page.evaluate(() => window.controller.clearLocation());
    await expect(button).toBeEnabled();
    await expect(save).toBeDisabled();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {getCurrentPosition: ok => ok({coords:{latitude:-25.33,longitude:-57.63,accuracy:20}})} });
    });
    await button.click();
    await expect.poll(() => page.evaluate(() => window.picked?.lat)).toBe(-25.33);
  });
}
