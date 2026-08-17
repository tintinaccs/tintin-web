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

async function expectHealthyLogo(page, selector) {
  const logo = page.locator(selector);
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(node => ({ complete: node.complete, width: node.naturalWidth })))
    .toEqual(expect.objectContaining({ complete: true }));
  expect(await logo.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('body')).not.toContainText('No pudimos cargar la imagen');
  await expect(page.locator('.tt-header-brand-copy')).toHaveCount(0);
}

test('mobile tiene barra blanca con logo centrado, cuenta circular y tabbar responsive', async ({ page }) => {
  await openPublicPage(page, { width: 390, height: 844 });

  const mobileHeader = page.locator('#tt-header-mobile');
  await expect(mobileHeader).toBeVisible();
  await expect(mobileHeader).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expectHealthyLogo(page, '#tt-header-mobile .tt-mobile-logo-img');

  const centering = await mobileHeader.evaluate(header => {
    const headerRect = header.getBoundingClientRect();
    const logoRect = header.querySelector('.tt-mobile-logo-img').getBoundingClientRect();
    return Math.abs((logoRect.left + logoRect.width / 2) - (headerRect.left + headerRect.width / 2));
  });
  expect(centering).toBeLessThanOrEqual(3);

  const accountIcon = page.locator('#tabbar-cuenta .tt-tabbar-account-icon');
  await expect(accountIcon).toBeVisible();
  const accountGeometry = await accountIcon.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius || '0');
    return { width: rect.width, height: rect.height, radius };
  });
  expect(Math.abs(accountGeometry.width - accountGeometry.height)).toBeLessThanOrEqual(1);
  expect(accountGeometry.radius).toBeGreaterThanOrEqual(accountGeometry.width / 2 - 1);

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

  const expandedWidth = await nav.evaluate(node => node.getBoundingClientRect().width);
  await page.evaluate(() => window.scrollTo(0, 560));
  await expect(nav).toHaveClass(/tt-tabbar-compact/);
  const compactWidth = await nav.evaluate(node => node.getBoundingClientRect().width);
  expect(compactWidth).toBeLessThan(expandedWidth);
  await expect(visibleButtons.first()).toHaveCSS('min-height', '48px');

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

test('mobile recupera automáticamente un logo remoto roto sin texto de error', async ({ page }) => {
  await openPublicPage(page, { width: 390, height: 844 });
  const logo = page.locator('#tt-header-mobile .tt-mobile-logo-img');
  await logo.evaluate(node => { node.src = '/__logo-roto-header-test__.png'; });

  await expect.poll(() => logo.evaluate(node => ({
    hidden: node.hidden,
    src: node.getAttribute('src') || '',
    width: node.naturalWidth,
  }))).toEqual(expect.objectContaining({ hidden: false }));

  await expect.poll(() => logo.evaluate(node => ({
    src: node.getAttribute('src') || '',
    width: node.naturalWidth,
  }))).toEqual(expect.objectContaining({
    src: expect.stringContaining('assets-tintin/images/general/logo.png'),
  }));
  expect(await logo.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('body')).not.toContainText('No pudimos cargar la imagen');
});

test('tablet tiene header exclusivo, logo-only y menú navegable', async ({ page }) => {
  await openPublicPage(page, { width: 768, height: 1024 });

  await expect(page.locator('#tt-header-tablet')).toBeVisible();
  await expect(page.locator('#tt-header-mobile')).toBeHidden();
  await expect(page.locator('#tt-header-desktop-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expectHealthyLogo(page, '#tt-header-tablet .tt-tablet-logo-img');
  await expect(page.locator('#btn-notifications-tablet')).toBeHidden();

  for (const control of await page.locator('#btn-menu-tablet,.tt-tablet-actions > button:not([hidden])').all()) {
    const box = await control.evaluate(node => node.getBoundingClientRect());
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

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

test('desktop conserva navegación con branding solo por logo y submenú funcional', async ({ page }) => {
  await openPublicPage(page, { width: 1440, height: 900 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-mobile')).toBeHidden();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expectHealthyLogo(page, '#tt-header-desktop-tablet .tt-logo-img');
  await expect(header.locator('[data-desktop-nav-item]')).toHaveCount(4);

  await page.locator('#btn-tienda').click();
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
