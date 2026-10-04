const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// The real profile renderer and shared Leaflet module; no Firebase session or write.
test('direcciones guardadas muestran mapas diferidos de solo lectura y liberan sus instancias', async ({ page }) => {
  const profile = fs.readFileSync(path.join(__dirname, '../../perfil.html'), 'utf8');
  const fragment = profile.slice(profile.indexOf('let addressBook = [];'), profile.indexOf('/** Fecha legible'));
  const escape = profile.slice(profile.indexOf('function escapeHtmlPerfil('), profile.indexOf('// Libreta de direcciones'));
  await page.route('**/__saved-address-map', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><link rel="stylesheet" href="/css/components/location/selector-ubicacion.css"></head><body><div style="height:1600px"></div><main id="saved-fixture"><div id="perfil-location-content"></div></main><script type="module">
    import {renderSavedMapPreviews} from '../../js/components/location/mapa-ubicacion.js?v=tintin-20261004-final-integration-1';
    const MAX_SAVED_LOCATIONS=5;
    ${escape}
    ${fragment}
    window.replaceAddresses=renderSavedLocation;
    renderSavedLocation([{name:'Casa <principal>',lat:-25.3,lng:-57.6}]);
    window.fixtureReady=true;
  </script></body></html>`}));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/__saved-address-map');
  await page.waitForFunction(()=>window.fixtureReady);
  const map=page.locator('[data-saved-map]');
  await expect(map).toHaveAttribute('aria-label','Mapa de Casa <principal>');
  await expect(map).not.toHaveClass(/leaflet-container/);
  await page.locator('#saved-fixture').scrollIntoViewIfNeeded();
  await expect(map).toHaveClass(/leaflet-container/);
  await expect(map.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect(map.locator('.leaflet-marker-draggable,.leaflet-interactive,.leaflet-control-zoom')).toHaveCount(0);
  await expect(map).toHaveCSS('height','155px');
  await expect(page.getByRole('link',{name:'Ir a Casa <principal> con Waze'})).toHaveAttribute('href',/ll=-25.3,-57.6/);
  await page.evaluate(()=>{window.previousMap=document.querySelector('[data-saved-map]');window.replaceAddresses([]);});
  expect(await page.evaluate(()=>({connected:window.previousMap.isConnected,removed:window.previousMap._leaflet_id===undefined}))).toEqual({connected:false,removed:true});
  await expect(page.locator('[data-saved-map]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
