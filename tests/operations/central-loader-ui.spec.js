const { test, expect } = require('@playwright/test');

test('las operaciones CRUD muestran progreso centrado y un resultado real', async ({ page, baseURL }) => {
  await page.route('**/central-ops-fixture.html', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="es"><head>
      <meta charset="utf-8">
      <link rel="stylesheet" href="/css/admin/operaciones-admin.css">
    </head><body><div class="adm-topbar-actions"></div></body></html>`,
  }));
  await page.goto(new URL('/central-ops-fixture.html', baseURL).href);
  await page.addScriptTag({
    type: 'module',
    content: `import(new URL(['js', 'admin', 'operaciones', 'sistema-operaciones-admin.js'].join('/'), location.origin + '/').href + '?v=central-ops-ui-test');`,
  });
  await expect.poll(() => page.evaluate(() => typeof window.TintinAdminOps)).toBe('object');

  await page.evaluate(() => {
    window.TintinAdminOps.setViewerRole('superadmin');
    window.__operationPromise = window.TintinAdminOps.runOperation({
      name: 'Crear producto',
      title: 'Crear producto de prueba',
      centerLoader: true,
      showSuccessDialog: true,
      stages: [{ id: 'write', label: 'Guardar producto' }],
      run: async context => {
        window.__operationSeen = context.operation;
        context.start('write');
        window.__operationStarted = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
        context.ok('write');
        return { id: 'fixture-product' };
      },
    });
  });

  await expect.poll(() => page.evaluate(() => window.__operationStarted)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__operationSeen?.centerLoader)).toBe(true);
  const loader = page.locator('#tt-ops-loader');
  await expect(loader).toBeVisible();
  await expect(loader).toHaveClass(/tt-ops-loader--centered/);
  await expect(page.locator('body')).toHaveClass(/tt-ops-centered-active/);
  await expect(loader.locator('.tt-ops-loader__title')).toHaveText('Crear producto de prueba');
  const centered = await loader.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return {
      x: Math.abs(bounds.left + bounds.width / 2 - window.innerWidth / 2),
      y: Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2),
      position: getComputedStyle(element).position,
    };
  });
  expect(centered.position).toBe('fixed');
  expect(centered.x).toBeLessThanOrEqual(1);
  expect(centered.y).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.__operationPromise);
  await expect(page.locator('#tt-ops-loader')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/tt-ops-centered-active/);
  const dialog = page.locator('#tt-ops-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Crear producto de prueba');
  await expect(dialog).toContainText('Correcto');
});

test('si falla el CRUD, se oculta el cargador y el resultado central indica error', async ({ page, baseURL }) => {
  await page.route('**/central-ops-fixture.html', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="es"><body><div class="adm-topbar-actions"></div></body></html>',
  }));
  await page.goto(new URL('/central-ops-fixture.html', baseURL).href);
  await page.addScriptTag({
    type: 'module',
    content: `import(new URL(['js', 'admin', 'operaciones', 'sistema-operaciones-admin.js'].join('/'), location.origin + '/').href + '?v=central-ops-ui-failure-test');`,
  });
  await expect.poll(() => page.evaluate(() => typeof window.TintinAdminOps)).toBe('object');

  await page.evaluate(() => {
    window.TintinAdminOps.setViewerRole('superadmin');
    window.__operationPromise = window.TintinAdminOps.runOperation({
      name: 'Eliminar producto',
      title: 'Eliminar producto de prueba',
      centerLoader: true,
      showSuccessDialog: true,
      stages: [{ id: 'delete', label: 'Borrar producto' }],
      run: async context => {
        context.start('delete');
        await new Promise(resolve => setTimeout(resolve, 150));
        throw Object.assign(new Error('Permiso insuficiente'), { code: 'permission-denied' });
      },
    });
  });

  await expect(page.locator('#tt-ops-loader')).toBeVisible();
  await page.evaluate(() => window.__operationPromise);
  await expect(page.locator('#tt-ops-loader')).toBeHidden();
  await expect(page.locator('#tt-ops-dialog')).toBeVisible();
  await expect(page.locator('#tt-ops-dialog')).toContainText('Con errores');
  await expect(page.locator('#tt-ops-dialog')).toContainText('Eliminar producto de prueba');
});
