const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const profile = fs.readFileSync(path.resolve(__dirname, '../../perfil.html'), 'utf8');
const mapImport = profile.split('import { createLocationMap, renderSavedMapPreviews }')[1].split('"')[1];
const editor = profile.match(/<div[^>]+id="perfil-location-editor"[\s\S]*?id="btn-cancelar-ubicacion"[^>]*>[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/)[0].replace(/ hidden/g, '');
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/js/vendor/leaflet/leaflet.css"><style>#perfil-location-map{height:280px}body{margin:16px}</style></head><body>${editor}<script type="module">
import {createLocationMap} from '${mapImport}';
window.controller=await createLocationMap({mapEl:document.getElementById('perfil-location-map'),locateButton:document.getElementById('perfil-location-locate'),onChange:place=>{window.picked=place;document.getElementById('perfil-location-selected').textContent=place?String(place.lat):'Sin punto';}});
window.ready=true;</script></body></html>`;

for (const width of [390, 768, 1440]) {
  test(`perfil marca ubicación y libera el botón · ${width}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -25.3, longitude: -57.6, accuracy: 20 });
    await page.route('**/__profile-map', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.goto('/__profile-map');
    await page.waitForFunction(() => window.ready);
    const button = page.locator('#perfil-location-locate');
    await button.click();
    await expect.poll(() => page.evaluate(() => window.picked?.lat)).toBe(-25.3);
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page.locator('.tt-map-status')).toContainText('Ubicación encontrada');
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
  });
}
