'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Real panel markup and cascade. Browser CSP blocks scripts and connections;
// HTML is never filtered with a regexp or evaluated as an admin session.
const root = path.resolve(__dirname, '../..');
const shell = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const fixtureCsp = "default-src 'self'; script-src 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; object-src 'none'";

for (const width of [390,768,1440]) {
  test(`los tokens del catálogo siguen legibles después de normalizar estilos a ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.route('**/__catalog-color-fixture', route => route.fulfill({contentType:'text/html',body:`<!doctype html>
      <html style="--color-text-primary:#713C53;--color-button-primary-text:#713C53;--color-brand-primary:#F8AACA;--color-button-primary-background:#F8AACA;--color-background-page:#FFF6FA">
      <head><link rel="stylesheet" href="/css/core/tema-unificado-tintin.css"><link rel="stylesheet" href="/css/pages/catalog/catalog-maintenance.css"></head>
      <body class="tt-catalog-maintenance"><button class="cat-filter-toggle" style="display:block">Filtrar por categoría</button><button class="tt-filtro-btn activo">Todos</button><button class="tt-card-btn-cart">Agregar</button></body></html>`}));
    await page.goto('/__catalog-color-fixture',{waitUntil:'load'});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'js/components/color/normalizador-color-tema.js'),'utf8')});
    for (const selector of ['.cat-filter-toggle','.tt-filtro-btn.activo','.tt-card-btn-cart']) {
      await expect(page.locator(selector)).toHaveCSS('color','rgb(113, 60, 83)');
      await expect(page.locator(selector)).toHaveCSS('background-color','rgb(248, 170, 202)');
    }
    expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-background-page').trim())).toBe('#FFF6FA');
  });
}

for (const width of [390, 768, 1440]) {
  test(`iconos malva legibles sobre el rosa aprobado a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/admin-white-fixture.html', route => route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': fixtureCsp }, body: shell }));
    await page.goto('/admin-white-fixture.html', { waitUntil: 'load' });
    expect(await page.evaluate(() => window.TT_PAGE_LOADER_WAIT)).toBeUndefined();
    const colors = await page.evaluate(() => {
      const color = selector => [...document.querySelectorAll(selector)].map(node => getComputedStyle(node).color);
      return {
        nav: color('.adm-nav-icon svg'),
        stats: color('.adm-stat-icon svg'),
        mobile: color('.adm-mobile-tab svg'),
        logo: color('.adm-sidebar-logo-text'),
        backgrounds: [...document.querySelectorAll('.adm-nav-icon,.adm-stat-icon,.adm-sidebar-logo,.adm-mobile-tab')].map(node => ({className:node.className,color:getComputedStyle(node).backgroundColor}))
      };
    });
    for (const key of ['nav', 'stats', 'mobile', 'logo']) {
      expect(colors[key].length, key).toBeGreaterThan(0);
      expect(colors[key].every(value => value === 'rgb(113, 60, 83)'), key).toBe(true);
    }
    for (const surface of colors.backgrounds) {
      const expected = surface.className === 'adm-mobile-tab active' ? 'rgb(253, 236, 242)' : 'rgb(248, 170, 202)';
      expect(surface.color, surface.className).toBe(expected);
    }
  });
}
