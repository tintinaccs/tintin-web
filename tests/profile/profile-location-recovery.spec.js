const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const profile = fs.readFileSync(path.resolve(__dirname, '../../perfil.html'), 'utf8');
const mapImport = profile.split('import { createLocationMap, renderSavedMapPreviews }')[1].split('"')[1];
const editor = profile.match(/<div[^>]+id="perfil-location-editor"[\s\S]*?id="btn-cancelar-ubicacion"[^>]*>[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/)[0].replace(/ hidden/g, '');
const styles = [...profile.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('');
const summary = profile.slice(profile.indexOf('const setLocationSummary ='), profile.indexOf('const ensureLocationMap ='));
const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body data-tt-profile-v2="1"><main class="perfil-wrap"><div class="perfil-card tt-profile-address-card"><div class="perfil-body">${editor}</div></div></main><script type="module">
import {createLocationMap} from '${mapImport}';
const locationSelected=document.getElementById('perfil-location-selected');${summary}
window.controller=await createLocationMap({mapEl:document.getElementById('perfil-location-map'),locateButton:document.getElementById('perfil-location-locate'),onChange:place=>{window.picked=place;setLocationSummary(place);}});
window.ready=true;</script></body></html>`;

test('un fondo de mapa caído no oculta el GPS ni permite guardar sin punto', async ({page, context}) => {
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

for (const [width,height] of [[320,568],[390,844],[430,932],[667,375],[768,1024],[820,1180],[844,390],[1024,768],[1180,820],[1181,820],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
  test(`perfil dirección alineada, mapa y GPS · ${width}x${height}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -25.3, longitude: -57.6, accuracy: 20 });
    await page.route('**/__profile-map', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.route(/https:\/\/[^/]*tile\.openstreetmap\.org\//, route => route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f4f0ec"/></svg>'}));
    await page.goto('/__profile-map');
    await page.waitForFunction(() => window.ready);
    await expect(page.locator('.tt-profile-location-map')).toHaveCSS('box-shadow','none');
    await expect(page.locator('#perfil-location-locate')).toHaveCSS('background-image','none');
    const fields = ['perfil-location-search','perfil-location-name','perfil-location-address'];
    const geometry = await page.evaluate(ids => {
      const box = node => {const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {overflow:document.documentElement.scrollWidth>innerWidth,editor:box(document.getElementById('perfil-location-editor')),fields:ids.map(id=>({input:box(document.getElementById(id)),label:box(document.querySelector(`label[for="${id}"]`))})),map:box(document.getElementById('perfil-location-map')),actions:[...document.querySelectorAll('.tt-profile-address-actions button')].map(box)};
    },fields);
    expect(geometry.overflow).toBe(false);
    for (const field of geometry.fields) {
      expect(field.label.bottom).toBeLessThanOrEqual(field.input.top);
      expect(field.input.left).toBeGreaterThanOrEqual(geometry.editor.left-1);
      expect(field.input.right).toBeLessThanOrEqual(geometry.editor.right+1);
      expect(field.input.height).toBeGreaterThanOrEqual(48);
    }
    expect(geometry.map.width).toBeGreaterThan(200);
    expect(geometry.map.right).toBeLessThanOrEqual(geometry.editor.right+1);
    for (const action of geometry.actions) {
      expect(action.height).toBeGreaterThanOrEqual(48);
      expect(action.right).toBeLessThanOrEqual(geometry.editor.right+1);
    }
    expect(geometry.actions[0].right<=geometry.actions[1].left || geometry.actions[0].bottom<=geometry.actions[1].top).toBe(true);
    const name = page.getByLabel('Nombre de la dirección',{exact:true});
    await name.fill('Casa principal, entrada por el portón lateral');
    await page.keyboard.press('Tab');
    await expect(page.locator('#perfil-location-address')).toBeFocused();
    await expect(page.locator('#perfil-location-address')).toHaveCSS('outline-style','solid');
    const button = page.locator('#perfil-location-locate');
    const save = page.locator('#btn-guardar-ubicacion');
    await expect(save).toBeDisabled();
    await button.click();
    await expect.poll(() => page.evaluate(() => window.picked?.lat)).toBe(-25.3);
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page.locator('.tt-map-status')).toContainText('Ubicación encontrada');
    await expect(save).toBeEnabled();
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
    if (width===768) {
      await page.setViewportSize({width:1024,height:768});
      await expect(name).toHaveValue('Casa principal, entrada por el portón lateral');
      await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.setViewportSize({width,height});
    }
    if ([390,768,1024,1440].includes(width)) await page.locator('.tt-profile-address-card').screenshot({path:`artifacts/profile-address/editor-${width}.png`,animations:'disabled',style:'html,body{scroll-behavior:auto!important}'});
    await page.clock.install();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {getCurrentPosition: () => {}} });
    });
    await button.click();
    await expect(button).toBeDisabled();
    await page.clock.runFor(5001);
    await page.clock.runFor(5001);
    await expect(button).toBeEnabled();
    await expect(page.locator('.tt-map-status')).toContainText('tardó demasiado');
    expect(await page.evaluate(() => window.picked.lat)).toBe(-25.32);
    await page.locator('#perfil-location-map').click({position:{x:120,y:90}});
    await expect.poll(()=>page.evaluate(()=>window.picked.lat)).not.toBe(-25.32);
    await expect(name).toHaveValue('Casa principal, entrada por el portón lateral');
    await button.click();
    await page.evaluate(() => window.controller.clearLocation());
    await expect(button).toBeEnabled();
    await expect(save).toBeDisabled();
    await page.evaluate(() => {
      Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:ok=>ok({coords:{latitude:-25.33,longitude:-57.63,accuracy:20}})}});
    });
    await button.click();
    await expect.poll(()=>page.evaluate(()=>window.picked?.lat)).toBe(-25.33);
    await expect(save).toBeEnabled();
  });
}
