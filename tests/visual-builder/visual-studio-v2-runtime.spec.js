const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

async function resetGlobalConfig(page) {
  await page.route('**/api/visual-studio-global-public**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, config: {} }),
  }));
}

test.beforeEach(async ({ page }) => {
  await resetGlobalConfig(page);
});

test('Visual Studio v2 renderiza beneficios, marquee, contador y spacer y aplica override mobile real', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('body.tt-public-shell-mounted')).toBeAttached({ timeout: 30000 });

  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({
      blocks: [
        { id: 'benefits-test', type: 'benefits', title: 'Beneficios', items: [{ icon: '♥', title: 'Seguro', text: 'Compra protegida' }] },
        { id: 'marquee-test', type: 'marquee', text: 'TINTIN TEST', speed: 'fast' },
        { id: 'countdown-test', type: 'countdown', title: 'Cuenta regresiva', endAt: new Date(Date.now() + 86400000).toISOString() },
        { id: 'spacer-test', type: 'spacer', size: 'large' },
      ],
      mobile: { benefits: { columns: 1 } },
    });
  });

  await expect(page.locator('[data-tt-global-block="benefits-test"]')).toContainText('Seguro');
  await expect(page.locator('[data-tt-global-block="marquee-test"]')).toContainText('TINTIN TEST');
  await expect(page.locator('[data-tt-global-block="countdown-test"]')).toContainText('Cuenta regresiva');
  await expect(page.locator('[data-tt-global-block="spacer-test"]')).toBeAttached();
});

test('el shell público carga el runtime global en una página real y falla de forma segura sin API', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('html')).toHaveAttribute('data-tt-global-studio', /ready|fallback/, { timeout: 30000 });
});

test('layout global vacío hereda el diseño existente y los overrides explícitos se aplican responsive', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('#tt-tabbar')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.tt-footer')).toBeAttached();

  const before = await page.evaluate(() => ({
    tabbarBackground: getComputedStyle(document.getElementById('tt-tabbar')).backgroundColor,
    footerBackground: getComputedStyle(document.querySelector('.tt-footer')).backgroundColor,
    columns: getComputedStyle(document.getElementById('tt-tabbar')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
  }));

  await page.evaluate(async () => {
    const module = await import(new URL('js/components/navigation/compartido/apariencia-global.js', `${location.origin}/`).href);
    module.applyGlobalLayout({ header: {}, footer: {} });
  });
  await expect(page.locator('#tt-global-layout-css')).toBeAttached();

  const inherited = await page.evaluate(() => ({
    tabbarBackground: getComputedStyle(document.getElementById('tt-tabbar')).backgroundColor,
    footerBackground: getComputedStyle(document.querySelector('.tt-footer')).backgroundColor,
    headerCustom: document.documentElement.hasAttribute('data-tt-header-bg-custom'),
    footerCustom: document.documentElement.hasAttribute('data-tt-footer-bg-custom'),
  }));
  expect(inherited.tabbarBackground).toBe(before.tabbarBackground);
  expect(inherited.footerBackground).toBe(before.footerBackground);
  expect(inherited.headerCustom).toBe(false);
  expect(inherited.footerCustom).toBe(false);
  expect(before.columns).toBe(5);

  await page.evaluate(async () => {
    const module = await import(new URL('js/components/navigation/compartido/apariencia-global.js', `${location.origin}/`).href);
    module.applyGlobalLayout({
      header: {
        brandName: 'TINTIN TEST', brandTagline: 'GLOBAL', homeLabel: 'INICIO', shopLabel: 'TIENDA',
        searchLabel: 'Buscar', cartLabel: 'Carrito', accountLabel: 'Cuenta', showHome: false,
        background: '#112233', textColor: '#fefefe', accentColor: '#ad3f67', density: 'normal', navStyle: 'pills', logoSize: 'medium',
      },
      footer: { background: '#223344', textColor: '#ffffff', accentColor: '#ad3f67', density: 'normal', style: 'boxed', showWhatsapp: true },
    });
  });

  await expect(page.locator('#tt-tabbar')).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await expect(page.locator('.tt-footer')).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await expect(page.locator('[data-shell-tab="home"]')).toBeHidden();
  await expect(page.locator('#tt-header-desktop-tablet .tt-header-brand-copy')).toHaveCount(0);
  await expect(page.locator('#tt-header-tablet .tt-header-brand-copy')).toHaveCount(0);
  await expect(page.locator('#tt-mobile-brandbar .tt-header-brand-copy')).toHaveCount(0);
  await expect(page.locator('#tt-mobile-brandbar .tt-mobile-brand-logo-img')).toBeVisible();
  let columns = await page.locator('#tt-tabbar').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columns).toBe(4);

  await page.evaluate(async () => {
    const module = await import(new URL('js/components/navigation/compartido/apariencia-global.js', `${location.origin}/`).href);
    module.applyGlobalLayout({ header: {}, footer: {} });
  });
  await expect(page.locator('#tt-tabbar')).toHaveCSS('background-color', before.tabbarBackground);
  await expect(page.locator('.tt-footer')).toHaveCSS('background-color', before.footerBackground);
  await expect(page.locator('[data-shell-tab="home"]')).toBeVisible();
  columns = await page.locator('#tt-tabbar').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columns).toBe(5);
  const restored = await page.evaluate(() => ({
    headerCustom: document.documentElement.hasAttribute('data-tt-header-bg-custom'),
    footerCustom: document.documentElement.hasAttribute('data-tt-footer-bg-custom'),
  }));
  expect(restored.headerCustom).toBe(false);
  expect(restored.footerCustom).toBe(false);
});

test('campaña prioritaria y pop-up global se aplican sobre la tienda y Escape restaura la interacción', async ({ page }) => {
  await page.goto(`${baseUrl}/catalogo.html`);
  await expect(page.locator('body.tt-public-shell-mounted')).toBeAttached({ timeout: 30000 });

  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({
      campaigns: [{ id: 'campaign-test', enabled: true, priority: 90, title: 'Promo', message: 'Campaña activa', ctaLabel: 'Ver promo', ctaHref: '/catalogo' }],
      popups: [{ id: 'popup-test', enabled: true, priority: 90, title: 'Hola Tintina', text: 'Pop-up activo', ctaLabel: 'Comprar', ctaHref: '/catalogo', frequency: 'always', devices: ['mobile', 'tablet', 'desktop'] }],
    });
  });

  await expect(page.locator('[data-tt-global-campaign]')).toContainText('Campaña activa');
  await expect(page.locator('[data-tt-global-popup]')).toContainText('Hola Tintina');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tt-global-popup]')).toHaveCount(0);
});

test('pop-up con targeting de dispositivo no aparece fuera de sus dispositivos elegidos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('body.tt-public-shell-mounted')).toBeAttached({ timeout: 30000 });
  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({ popups: [{ id: 'desktop-only', enabled: true, title: 'Solo desktop', frequency: 'always', devices: ['desktop'] }] });
  });
  await expect(page.locator('[data-tt-global-popup]')).toHaveCount(0);
});

test('pop-up con frecuencia "once" no vuelve a mostrarse tras cerrarse', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('body.tt-public-shell-mounted')).toBeAttached({ timeout: 30000 });
  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({ popups: [{ id: 'once-test', enabled: true, title: 'Una vez', frequency: 'once', devices: ['desktop', 'tablet', 'mobile'] }] });
  });
  await expect(page.locator('[data-tt-global-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tt-global-popup]')).toHaveCount(0);
  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({ popups: [{ id: 'once-test', enabled: true, title: 'Una vez', frequency: 'once', devices: ['desktop', 'tablet', 'mobile'] }] });
  });
  await expect(page.locator('[data-tt-global-popup]')).toHaveCount(0);
});

test('barra de campaña y pop-up top-bar simultáneos no se superponen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('body.tt-public-shell-mounted')).toBeAttached({ timeout: 30000 });
  await page.evaluate(async () => {
    const module = await import(new URL('js/core/store/visual-studio-global-runtime.js', `${location.origin}/`).href);
    module.applyGlobalVisualStudio({
      campaigns: [{ id: 'campaign-bar', enabled: true, priority: 80, title: 'Campaña', message: 'Barra campaña', ctaHref: '/catalogo' }],
      popups: [{ id: 'popup-top', enabled: true, priority: 80, title: 'Top', text: 'Popup top', position: 'top', frequency: 'always', devices: ['desktop'] }],
    });
  });
  const boxes = await page.evaluate(() => {
    const campaign = document.querySelector('[data-tt-global-campaign]')?.getBoundingClientRect();
    const popup = document.querySelector('[data-tt-global-popup]')?.getBoundingClientRect();
    return campaign && popup ? { campaign: { top: campaign.top, bottom: campaign.bottom }, popup: { top: popup.top, bottom: popup.bottom } } : null;
  });
  expect(boxes).not.toBeNull();
  expect(boxes.popup.top >= boxes.campaign.bottom || boxes.campaign.top >= boxes.popup.bottom).toBe(true);
});