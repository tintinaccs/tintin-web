'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Real panel markup and cascade. Browser CSP blocks scripts and connections;
// HTML is never filtered with a regexp or evaluated as an admin session.
const root = path.resolve(__dirname, '../..');
const shell = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const fixtureCsp = "default-src 'self'; script-src 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; object-src 'none'";

for (const width of [390, 768, 1440]) {
  test(`iconos blancos legibles con cascada real a ${width}px`, async ({ page }) => {
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
      expect(colors[key].every(value => value === 'rgb(255, 255, 255)'), key).toBe(true);
    }
    expect(colors.backgrounds.filter(value => value.color === 'rgb(255, 255, 255)' || value.color === 'rgba(0, 0, 0, 0)')).toEqual([]);
  });
}
