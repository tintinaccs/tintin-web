'use strict';

/**
 * Rendimiento del acceso al Super Admin (sin credenciales reales: se mide el
 * shell de login/gate, que es lo que ve un usuario no autenticado). No usa datos
 * privados. La medición del panel autenticado se documenta como manual porque
 * requiere una sesión real de Super Admin.
 */
const { test, expect } = require('@playwright/test');
const { url, waitLoaderGone, collectVitals, BUDGETS } = require('./_helpers');

test('[admin] login.html carga rápido y el bundle admin no se descarga aquí', async ({ page }) => {
  const requested = [];
  page.on('request', r => requested.push(r.url()));

  await page.goto(url('login.html'), { waitUntil: 'load', timeout: 45000 });
  await waitLoaderGone(page, BUDGETS.loaderMaxMs);

  const v = await collectVitals(page);
  console.log(`[login] FCP=${v.fcp} LCP=${v.lcp} CLS=${v.cls} reqs=${v.requests} transfer=${v.transferKB}KB`);
  expect(v.cls, 'CLS del login dentro de presupuesto').toBeLessThanOrEqual(BUDGETS.clsMax);

  // El bundle pesado del panel no debe cargarse en el login.
  expect(requested.some(u => /admin-app\.js/.test(u)),
    'admin-app.js no debe descargarse en el login').toBeFalsy();
});

test('[admin] admin.html sin sesión no revela el panel (gate seguro)', async ({ page }) => {
  await page.goto(url('admin.html'), { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  // Sin sesión válida, el panel debe quedar tapado / redirigido, nunca visible.
  const panelVisible = await page.evaluate(() => {
    const panel = document.querySelector('#section-dashboard, .adm-shell, [data-admin-panel]');
    if (!panel) return false;
    const cs = getComputedStyle(panel);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && panel.offsetParent !== null;
  });
  expect(panelVisible, 'el panel no debe verse sin sesión resuelta').toBeFalsy();
});
