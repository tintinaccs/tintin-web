const { test, expect } = require('@playwright/test');

async function openPublicPage(page, viewport, path = '/index.html') {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.tt-public-shell-mounted');
  await page.evaluate(() => {
    document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending');
    window.TintinLoader?.hide?.();
  });
}

async function expectNoHorizontalOverlap(locator) {
  const boxes = await locator.evaluateAll(nodes => nodes
    .filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    })
    .map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const sameRow = a.top < b.bottom - 2 && a.bottom > b.top + 2;
      if (!sameRow) continue;
      expect(Math.min(a.right, b.right) - Math.max(a.left, b.left)).toBeLessThanOrEqual(2);
    }
  }
}

async function expectHeaderBrandHealthy(page) {
  const shell = page.locator('#tt-header-desktop-tablet,#tt-header-tablet,#tt-tablet-menu');
  await expect(shell.locator('.tt-img-error-label')).toHaveCount(0);
  const broken = await shell.locator('img').evaluateAll(images => images
    .filter(image => !image.complete || image.naturalWidth === 0)
    .map(image => ({ alt: image.alt, src: image.currentSrc || image.src })));
  expect(broken).toEqual([]);
  await expect(shell.locator('img[data-tt-shared-logo]')).toHaveCount(0);
}

test('mobile conserva etiquetas, admite Alertas y se compacta sin solaparse', async ({ page }) => {
  await openPublicPage(page, { width: 390, height: 844 });

  const nav = page.locator('#tt-tabbar');
  const visibleButtons = nav.locator('.tt-tabbar-btn:not([hidden])');
  const labels = nav.locator('.tt-tabbar-btn:not([hidden]) > span:last-child');
  await expect(nav).toBeVisible();
  await expect(nav.locator('.tt-tabbar-btn')).toHaveCount(6);
  await expect(visibleButtons).toHaveCount(5);
  await expect(nav.locator('#tabbar-notifications')).toBeHidden();
  await expect(labels).toHaveCount(5);
  await expect(labels.first()).toBeVisible();
  await expect(visibleButtons.nth(0)).toHaveAttribute('aria-label', 'Inicio');
  await expect(visibleButtons.nth(1)).toHaveAttribute('aria-label', 'Buscar');
  await expect(visibleButtons.nth(2)).toHaveAttribute('aria-label', 'Tienda');

  // Simula el estado autenticado más exigente: aparecen las seis acciones.
  await nav.locator('#tabbar-notifications').evaluate(node => { node.hidden = false; });
  await expect(visibleButtons).toHaveCount(6);
  let columnCount = await nav.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columnCount).toBe(6);
  await expect(nav.locator('#tabbar-notifications')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  // Respeta una configuración exclusiva de mobile: Inicio oculto. Con Alertas
  // visible deben quedar cinco columnas reales, no seis con un hueco fantasma.
  await page.evaluate(() => {
    document.documentElement.dataset.ttMobileHome = 'hidden';
    const home = document.querySelector('[data-shell-tab="home"]');
    if (home) home.hidden = true;
  });
  await expect(visibleButtons).toHaveCount(5);
  columnCount = await nav.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columnCount).toBe(5);
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  const expandedWidth = await nav.evaluate(node => node.getBoundingClientRect().width);
  await page.evaluate(() => window.scrollTo(0, 560));
  await expect(nav).toHaveClass(/tt-tabbar-compact/);
  const compactWidth = await nav.evaluate(node => node.getBoundingClientRect().width);
  expect(compactWidth).toBeLessThan(expandedWidth);
  await expect(visibleButtons.first()).toHaveCSS('min-height', '48px');
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(nav).not.toHaveClass(/tt-tabbar-compact/);
  await expect(labels.first()).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 560));
  await expect(nav).toHaveClass(/tt-tabbar-compact/);
  await page.locator('#tabbar-tienda').click();
  await expect(nav).not.toHaveClass(/tt-tabbar-compact/);
  await expect(page.locator('#collections-sheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#btn-close-sheet')).toBeFocused();
});

test('tablet reserva espacio para logo y cuatro acciones sin colisiones', async ({ page }) => {
  await openPublicPage(page, { width: 768, height: 1024 });

  await expect(page.locator('#tt-header-tablet')).toBeVisible();
  await expect(page.locator('#tt-header-desktop-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(page.locator('#tt-header-tablet .tt-tablet-logo-img')).toBeVisible();
  await expectHeaderBrandHealthy(page);
  await expect(page.locator('#btn-notifications-tablet')).toBeHidden();

  for (const control of await page.locator('#btn-menu-tablet,.tt-tablet-actions > button:not([hidden])').all()) {
    const box = await control.evaluate(node => node.getBoundingClientRect());
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator('#btn-notifications-tablet').evaluate(node => { node.hidden = false; });
  await expect(page.locator('.tt-tablet-actions > button:not([hidden])')).toHaveCount(4);
  await expect(page.locator('#btn-notifications-tablet')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  const tabletGeometry = await page.evaluate(() => {
    const menu = document.getElementById('btn-menu-tablet').getBoundingClientRect();
    const logo = document.querySelector('.tt-tablet-logo-link').getBoundingClientRect();
    const actions = document.querySelector('.tt-tablet-actions').getBoundingClientRect();
    const header = document.getElementById('tt-header-tablet');
    return {
      menuRight: menu.right,
      logoLeft: logo.left,
      logoRight: logo.right,
      actionsLeft: actions.left,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    };
  });
  expect(tabletGeometry.menuRight).toBeLessThanOrEqual(tabletGeometry.logoLeft);
  expect(tabletGeometry.logoRight).toBeLessThanOrEqual(tabletGeometry.actionsLeft);
  expect(tabletGeometry.scrollWidth).toBeLessThanOrEqual(tabletGeometry.clientWidth + 1);

  await page.locator('#btn-menu-tablet').click();
  await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#btn-tablet-close')).toBeFocused();
  await page.locator('#btn-tablet-tienda').click();
  await expect(page.locator('#tt-tablet-menu')).toHaveClass(/tt-tablet-shop-view/);
  await expect(page.locator('#tablet-cats .tt-tablet-cats-grid a')).toHaveCount(12);
  await expect(page.locator('#tablet-cats .tt-tablet-ver-todo')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden', 'true');
});

test('desktop conserva un solo indicador para Tienda y acciones sólidas', async ({ page }) => {
  await openPublicPage(page, { width: 1440, height: 900 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(header.locator('.tt-logo-img')).toBeVisible();
  await expectHeaderBrandHealthy(page);
  await expect(header.locator('[data-desktop-nav-item]')).toHaveCount(4);

  await page.locator('#btn-notifications').evaluate(node => { node.hidden = false; });
  await expect(page.locator('#btn-notifications')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expectNoHorizontalOverlap(header.locator('.tt-nav-desktop [data-desktop-nav-item],.tt-header-actions > button:not([hidden])'));

  await page.locator('#btn-tienda').click();
  const tiendaStyle = await page.locator('#btn-tienda').evaluate(node => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(tiendaStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(tiendaStyle.borderTopColor).toBe('rgba(0, 0, 0, 0)');
  expect(tiendaStyle.boxShadow).toBe('none');

  const dropdown = page.locator('#tt-tienda-dropdown-panel');
  await expect(dropdown).toHaveAttribute('aria-hidden', 'false');
  await expect(dropdown.locator('a[href^="/catalogo?cat="], a[href^="catalogo.html?cat="]')).toHaveCount(12);
  const bounds = await dropdown.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);

  await page.keyboard.press('Escape');
  await page.locator('#btn-cuenta').click();
  await expect(page.locator('#account-panel a[href="/login"], #account-panel a[href="login.html"]')).toHaveCount(2);
  await expect(page.locator('#account-drawer')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('desktop compacto 1025px reserva las cuatro acciones autenticadas', async ({ page }) => {
  await openPublicPage(page, { width: 1025, height: 768 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await page.locator('#btn-notifications').evaluate(node => { node.hidden = false; });
  await expect(page.locator('.tt-header-actions > button:not([hidden])')).toHaveCount(4);

  const geometry = await page.evaluate(() => {
    const logo = document.querySelector('#tt-header-desktop-tablet .tt-logo-link').getBoundingClientRect();
    const nav = document.getElementById('tt-nav-desktop-tablet').getBoundingClientRect();
    const actions = document.querySelector('#tt-header-desktop-tablet .tt-header-actions').getBoundingClientRect();
    const header = document.getElementById('tt-header-desktop-tablet');
    return {
      logoRight: logo.right,
      navLeft: nav.left,
      navRight: nav.right,
      actionsLeft: actions.left,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    };
  });

  expect(geometry.logoRight).toBeLessThanOrEqual(geometry.navLeft);
  expect(geometry.navRight).toBeLessThanOrEqual(geometry.actionsLeft);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await expectNoHorizontalOverlap(header.locator('.tt-nav-desktop [data-desktop-nav-item],.tt-header-actions > button:not([hidden])'));
});
