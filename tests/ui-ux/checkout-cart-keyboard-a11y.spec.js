'use strict';

const { test, expect } = require('@playwright/test');

// Pasos del checkout navegables con teclado y botón secundario del carrito
// con área táctil mínima de 44 px (auditoría responsive/a11y 2026-10-31).
const cartItem = [{ id: 'qa-a11y-item', name: 'QA accesibilidad', price: 1000, qty: 1, cat: 'relojes' }];

async function preparePage(page) {
  const base = new URL(test.info().project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173');
  await page.context().addCookies([{ name: 'tt_privacy_choice', value: 'v2.necessary', url: base.origin }]);
  await page.addInitScript(item => {
    window.TT_DISABLE_STORE_GATE = true;
    try {
      localStorage.setItem('tt_cart', JSON.stringify(item));
      localStorage.setItem('tt_cart_guest', JSON.stringify(item));
    } catch {}
  }, cartItem);
}

for (const width of [320, 768, 1440]) {
  test(`pasos del checkout muestran foco visible al tabular en ${width}px`, async ({ page }) => {
    await preparePage(page);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/checkout', { waitUntil: 'load' });
    const step = page.locator('.ck-step[role="button"][tabindex="0"]').first();
    await expect(step).toBeVisible();
    await step.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(step).toBeFocused();
    const ring = await step.evaluate(el => {
      const s = getComputedStyle(el);
      return { matches: el.matches(':focus-visible'), style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(ring.matches).toBe(true);
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });

  test(`botón Seguir comprando del carrito mide al menos 44 px en ${width}px`, async ({ page }) => {
    await preparePage(page);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/', { waitUntil: 'load' });
    const trigger = page.locator('#tabbar-cart, [data-nav-action="cart"]').filter({ visible: true }).first();
    await trigger.click();
    const keepShopping = page.locator('#cart-drawer [data-cart-action="close"]', { hasText: 'Seguir comprando' });
    await expect(keepShopping).toBeVisible();
    const box = await keepShopping.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
}
