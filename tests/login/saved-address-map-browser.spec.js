const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('dirección guardada carga el mapa al abrir, reutiliza y libera al actualizar', async ({ page }) => {
  const profile = fs.readFileSync(path.join(__dirname, '../../perfil.html'), 'utf8');
  const fragment = profile.slice(profile.indexOf('let addressBook = [];'), profile.indexOf('/** Fecha legible'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<main style="margin:16px"><div id="perfil-location-content"></div></main>');
  await page.addScriptTag({ content: `
    const MAX_SAVED_LOCATIONS = 5;
    function escapeHtmlPerfil(text) { const el = document.createElement('span'); el.textContent = text; return el.innerHTML; }
    window.mapEvidence = { created: 0, destroyed: 0, resized: 0, places: [] };
    async function createLocationMap(options) {
      window.mapEvidence.created++;
      window.mapEvidence.readOnly = options.readOnly;
      return {
        setLocation(place, settings) { window.mapEvidence.places.push({ place, settings }); },
        invalidateSize() { window.mapEvidence.resized++; },
        destroy() { window.mapEvidence.destroyed++; }
      };
    }
    ${fragment}
    renderSavedLocation([{name: 'Casa <principal>', lat: -25.3, lng: -57.6}]);
  ` });
  const summary = page.locator('details summary');
  await expect(summary).toHaveText('Ver mapa de Casa <principal>');
  expect(await page.evaluate(() => window.mapEvidence.created)).toBe(0);
  await summary.click();
  await expect.poll(() => page.evaluate(() => window.mapEvidence.created)).toBe(1);
  const evidence = await page.evaluate(() => window.mapEvidence);
  expect(evidence.readOnly).toBe(true);
  expect(evidence.places[0].settings.scroll).toBe(false);
  await expect(page.getByRole('region', {name:'Mapa de la dirección guardada'})).toHaveCSS('height', '220px');
  await summary.click();
  await summary.click();
  await expect.poll(() => page.evaluate(() => window.mapEvidence.resized)).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.mapEvidence.created)).toBe(1);
  await page.evaluate(() => renderSavedLocation([]));
  expect(await page.evaluate(() => window.mapEvidence.destroyed)).toBe(1);
  await expect(page.locator('details')).toHaveCount(0);
});
