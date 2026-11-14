'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const { load } = require('./helpers/admin-panel-fixture.cjs');

async function violetSurfaces(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const violations = [];
    for (const element of document.querySelectorAll('body *')) {
      // Colores de variantes representan el producto real, no el tema.
      if (element.closest('.tt-color-swatch,.tt-card-color,.tt-variant-color,[data-color-swatch]')) continue;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) continue;
      for (const property of ['backgroundColor', 'color', 'borderTopColor']) {
        context.clearRect(0, 0, 1, 1); context.fillStyle = style[property]; context.fillRect(0, 0, 1, 1);
        const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
        if (alpha < 40) continue;
        const high = Math.max(red, green, blue), low = Math.min(red, green, blue), delta = high - low;
        if (delta < 16) continue;
        let hue = high === red ? (green - blue) / delta : high === green ? 2 + (blue - red) / delta : 4 + (red - green) / delta;
        hue = (hue * 60 + 360) % 360;
        if (hue >= 235 && hue <= 315) violations.push({ element: element.id || String(element.className).slice(0, 80) || element.tagName, property, value: style[property] });
      }
    }
    return violations;
  });
}

for (const width of [390, 1440]) test(`superficies públicas sin acentos violetas ajenos a Tintín ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const pages = ['index', 'catalogo', 'collections', 'product', 'checkout', 'login', 'perfil',
    'about', 'contact', 'envios', 'cambios-devoluciones', 'preguntas-frecuentes', 'terminos', 'privacidad', '404'];
  for (const file of pages) {
    await page.route(`**/__palette-${file}`, route => route.fulfill({ contentType: 'text/html',
      body: removeFixtureScripts(fs.readFileSync(`${file}.html`, 'utf8'), { removeModulePreloads: true }) }));
    await page.goto(`/__palette-${file}`);
    await page.evaluate(() => {
      document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending');
      document.getElementById('tt-loader')?.remove();
    });
    await page.addStyleTag({ content: '*{content-visibility:visible!important;animation:none!important;transition:none!important}' });
    expect(await violetSurfaces(page), file).toEqual([]);
    if (file === 'index') {
      const contrast = await page.locator('#hero .tt-hero-title').evaluate(title => {
        const context = document.createElement('canvas').getContext('2d'); context.canvas.width = context.canvas.height = 1;
        const rgb = value => { context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const luminance = values => values.map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const foreground = luminance(rgb(getComputedStyle(title).color)), root = getComputedStyle(document.documentElement);
        return ['--color-brand-primary', '--color-brand-accent', '--color-background-page'].map(name => {
          const background = luminance(rgb(root.getPropertyValue(name)));
          return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
      });
      expect(Math.min(...contrast), 'Título legible sobre todos los tonos de su degradado').toBeGreaterThanOrEqual(4.5);
    }
  }
  // El detector debe seguir denunciando un acento violeta visible.
  await page.evaluate(() => { const probe = document.createElement('div'); probe.id = 'violet-probe'; probe.style.cssText = 'width:44px;height:44px;background:#8b5cf6'; document.body.append(probe); });
  expect((await violetSurfaces(page)).some(row => row.element === 'violet-probe')).toBe(true);
});

for (const width of [390, 1440]) test(`panel y gráficos heredan la paleta y conservan los avisos ${width}px`, async ({ page }) => {
  await load(page, width, 'admin.html', { mobile: true });
  await page.evaluate(() => {
    const host = document.createElement('article'); host.id = 'palette-components';
    host.innerHTML = '<span class="adm-badge badge-enviado">Enviado</span><span class="adm-user-role-badge role-viewer">Consulta</span><span class="adm-diagnostic-badge-recurrent">Recurrente</span><div class="adm-trend-chart"><div class="adm-trend-bar" style="--adm-trend-height:60px"></div><div class="adm-trend-bar adm-trend-bar-orders" style="--adm-trend-height:80px"></div><div class="adm-trend-bar adm-trend-bar-visits" style="--adm-trend-height:100px"></div></div>';
    document.querySelector('.adm-section.active').append(host);
  });
  expect(await violetSurfaces(page)).toEqual([]);
  const backgrounds = await page.locator('#palette-components .adm-trend-bar').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
  expect(new Set(backgrounds).size).toBe(3);
  await page.evaluate(() => document.documentElement.style.setProperty('--admin-color-badge-background', '#F8AACA'));
  for (const selector of ['.badge-enviado', '.role-viewer', '.adm-diagnostic-badge-recurrent']) {
    await expect(page.locator(`#palette-components ${selector}`)).toHaveCSS('background-color', 'rgb(248, 170, 202)');
  }
  const tokens = await page.evaluate(() => { const style = getComputedStyle(document.documentElement); return ['--color-success-text', '--color-error-text', '--color-button-whatsapp-background'].map(name => style.getPropertyValue(name).trim().toLowerCase()); });
  expect(tokens).toEqual(['#166534', '#b8341f', '#0d8043']);
  if (width === 390) {
    await page.evaluate(() => document.getElementById('adm-theme-switch').click());
    await expect(page.locator('html')).toHaveClass(/adm-dark/);
    await expect(page.locator('#palette-components .adm-trend-bar-visits')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(new Set(await page.locator('#palette-components .adm-trend-bar').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).size).toBe(3);
  }
});
