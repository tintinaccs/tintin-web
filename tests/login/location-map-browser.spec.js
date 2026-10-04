const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const checkout = fs.readFileSync(path.resolve(__dirname, '../../checkout.html'), 'utf8');
const mapCode = checkout.slice(checkout.indexOf('// Un único mapa'), checkout.indexOf('// ---- INIT ----'));
const profile = fs.readFileSync(path.resolve(__dirname, '../../perfil.html'), 'utf8');
const profileEscape = profile.slice(profile.indexOf('function escapeHtmlPerfil('), profile.indexOf('// Libreta de direcciones'));
const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><link rel="stylesheet" href="/css/components/location/selector-ubicacion.css"><style>body{margin:16px;font-family:Montserrat}.tt-map-search{max-width:600px}#ck-map{height:260px}</style></head><body>
<div id="error-2"></div><div id="ck-saved-location-hint" style="display:none"><strong id="ck-saved-confirm-title"></strong><span id="ck-saved-confirm-name"></span><span id="ck-saved-confirm-detail"></span><button id="ck-saved-location-confirm">Confirmar</button><button id="ck-saved-location-change">Cambiar</button></div>
<div class="tt-map-search"><input id="ck-map-search" aria-label="Buscar dirección"><div class="tt-map-results" id="ck-map-search-results"></div></div><button id="ck-map-locate">Usar mi ubicación actual</button><div id="ck-map"></div><div id="ck-map-coords"></div><input id="ck-location-name" aria-label="Nombre de dirección">
<script type="module">import {createLocationMap} from '../../js/components/location/mapa-ubicacion.js?v=tintin-20261004-location-consistency-1';import {attachSavedLocationConfirm,isConfirmableLocation} from '../../js/pages/checkout/checkout-ubicacion-guardada.js?v=tintin-20260803-saved-location-1';
const orderData={mapLocation:null};let currentUserProfile=null;const showError=(_,message)=>{document.getElementById('error-2').textContent=message};${mapCode}
${profileEscape}window.escapeAddressLabel=escapeHtmlPerfil;window.readDelivery=()=>({point:window.__TintinCheckoutPoint,location:orderData.mapLocation,name:document.getElementById('ck-location-name').value});
window.restoreAddress=()=>{currentUserProfile={savedLocation:{lat:-25.31,lng:-57.61,name:'Casa',address:'Calle de prueba'}};orderData.mapLocation=null;document.getElementById('ck-location-name').value='';maybeApplySavedLocation()};await initMap();window.mapReady=true;</script></body></html>`;

test('checkout conserva búsqueda, nombre, coordenadas y confirmación al usar el componente compartido', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -25.3, longitude: -57.6, accuracy: 20 });
  await page.route('**/__checkout-location-contract', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }));
  await page.route('**/api/geo-search?*', route => route.fulfill({ json: { places: [{ lat: -25.29, lng: -57.63, name: 'Local <prueba>', address: 'Asunción', source: 'OpenStreetMap' }] } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/__checkout-location-contract');
  await page.waitForFunction(() => window.mapReady);
  expect(await page.evaluate(() => escapeAddressLabel('Casa "central"'))).toBe('Casa &quot;central&quot;');
  await page.locator('#ck-map-locate').click();
  await expect.poll(() => page.evaluate(() => readDelivery().point?.lat)).toBe(-25.3);
  await page.locator('#ck-location-name').fill('Mi casa');
  await page.locator('#ck-map-search').fill('Local');
  await page.getByRole('option').click();
  await expect.poll(() => page.evaluate(() => readDelivery().point?.lat)).toBe(-25.29);
  expect(await page.evaluate(() => readDelivery().name)).toBe('Mi casa');
  expect(await page.locator('#ck-map-coords').textContent()).toContain('Local <prueba>');
  expect(await page.locator('#ck-map-coords prueba').count()).toBe(0);
  await page.evaluate(() => restoreAddress());
  await expect(page.locator('#ck-saved-location-hint')).toBeVisible();
  expect(await page.evaluate(() => readDelivery().point.lat)).toBe(-25.31);
  await page.locator('#ck-saved-location-change').click();
  expect(await page.evaluate(() => readDelivery().point)).toBeNull();
  expect(await page.evaluate(() => readDelivery().location)).toBeNull();
  expect(await page.locator('#ck-location-name').inputValue()).toBe('');
  expect(errors).toEqual([]);
});
