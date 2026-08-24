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

async function visibleRects(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes
    .filter(node => !node.hidden && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden')
    .map(node => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.id || node.getAttribute('aria-label') || node.textContent.trim().slice(0, 24),
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height,
      };
    }));
}

function overlaps(a, b, tolerance = 1) {
  return a.left < b.right - tolerance && a.right > b.left + tolerance &&
    a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

test('mobile conserva etiquetas y se compacta como Instagram al desplazarse', async ({ page }) => {
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

test('tablet tiene header exclusivo, marca completa y menú navegable', async ({ page }) => {
  await openPublicPage(page, { width: 768, height: 1024 });

  await expect(page.locator('#tt-header-tablet')).toBeVisible();
  await expect(page.locator('#tt-header-desktop-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(page.locator('#tt-header-tablet .tt-tablet-logo-img')).toBeVisible();
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
  await expect(page.locator('.tt-tablet-account-entry')).toBeHidden();
  await expect(page.locator('#tablet-cats .tt-tablet-cats-grid a')).toHaveCount(12);
  await expect(page.locator('#tablet-cats .tt-tablet-ver-todo')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden', 'true');
});

test('desktop conserva navegación, marca, submenú e indexación interna', async ({ page }) => {
  await openPublicPage(page, { width: 1440, height: 900 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(header.locator('.tt-logo-img')).toBeVisible();
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

test('desktop mínimo soporta notificaciones sin pisar logo, menú ni acciones', async ({ page }) => {
  await openPublicPage(page, { width: 1025, height: 820 });
  await page.locator('#btn-notifications').evaluate(node => { node.hidden = false; });
  await page.waitForTimeout(60);

  await expect(page.locator('#btn-notifications')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const tienda = page.locator('#btn-tienda');
  await expect(tienda).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(tienda).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');

  const groups = await visibleRects(page, '#tt-header-desktop-tablet .tt-logo-link,#tt-header-desktop-tablet .tt-nav-desktop,#tt-header-desktop-tablet .tt-header-actions');
  expect(groups).toHaveLength(3);
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) expect(overlaps(groups[i], groups[j])).toBeFalsy();
  }
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('tablet mínimo soporta cuarta acción autenticada sin tocar el logo', async ({ page }) => {
  await openPublicPage(page, { width: 768, height: 1024 });
  await page.locator('#btn-notifications-tablet').evaluate(node => { node.hidden = false; });
  await page.waitForTimeout(60);
  await expect(page.locator('#btn-notifications-tablet')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  const menu = (await visibleRects(page, '#btn-menu-tablet'))[0];
  const logo = (await visibleRects(page, '#tt-header-tablet .tt-tablet-logo-link'))[0];
  const actions = (await visibleRects(page, '#tt-header-tablet .tt-tablet-actions'))[0];
  expect(overlaps(menu, logo)).toBeFalsy();
  expect(overlaps(logo, actions)).toBeFalsy();
  expect(overlaps(menu, actions)).toBeFalsy();
});

test('mobile distribuye invitada, sesión y Home oculto sin huecos ni desborde', async ({ page }) => {
  await openPublicPage(page, { width: 320, height: 760 });
  const nav = page.locator('#tt-tabbar');

  const trackCount = () => nav.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(await trackCount()).toBe(5);

  await page.locator('#tabbar-notifications').evaluate(node => { node.hidden = false; });
  await page.waitForTimeout(60);
  expect(await trackCount()).toBe(6);
  await expect(page.locator('#tabbar-notifications')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.evaluate(() => {
    const home = document.querySelector('[data-shell-tab="home"]');
    if (home) home.hidden = true;
    document.documentElement.dataset.ttMobileHome = 'hidden';
  });
  await page.waitForTimeout(60);
  expect(await trackCount()).toBe(5);

  const controls = await visibleRects(page, '#tt-tabbar .tt-tabbar-btn');
  for (let i = 0; i < controls.length; i += 1) {
    expect(controls[i].width).toBeGreaterThan(40);
    for (let j = i + 1; j < controls.length; j += 1) expect(overlaps(controls[i], controls[j])).toBeFalsy();
  }
  const bounds = await nav.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
});
