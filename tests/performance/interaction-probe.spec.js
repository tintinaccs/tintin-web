'use strict';
const { test, expect } = require('@playwright/test');
const { probeInteraction } = require('./_helpers');

test('la sonda mide trabajo del gesto y apertura completa, sin espera del automatizador', async ({ page }) => {
  await page.setContent('<button data-nav-action="cart" disabled>Carrito</button><aside id="cart-drawer" aria-hidden="true"><button id="btn-cart-close">Cerrar</button></aside>');
  await page.evaluate(() => {
    window.__ttVitals = {};
    window.TintinSurfaceController = { state: 'idle' };
    const trigger = document.querySelector('[data-nav-action="cart"]');
    setTimeout(() => { trigger.disabled = false; }, 700);
    document.addEventListener('click', event => {
      if (!event.target.closest('[data-nav-action="cart"]')) return;
      event.stopImmediatePropagation();
      window.TintinSurfaceController.state = 'opening';
      const until = performance.now() + 80;
      while (performance.now() < until) { /* real synchronous event work */ }
      document.getElementById('cart-drawer').setAttribute('aria-hidden', 'false');
      setTimeout(() => { window.TintinSurfaceController.state = 'open'; }, 120);
    }, true);
    document.getElementById('btn-cart-close').onclick = () => {
      document.getElementById('cart-drawer').setAttribute('aria-hidden', 'true');
      window.TintinSurfaceController.state = 'idle';
    };
  });
  await probeInteraction(page);
  const elapsed = await page.evaluate(() => window.__ttVitals.interactionMs);
  expect(elapsed).toBeGreaterThanOrEqual(200);
  expect(elapsed).toBeLessThanOrEqual(500);
});
