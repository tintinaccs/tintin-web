'use strict';

const { test, expect } = require('@playwright/test');

async function openMotionFixture(page) {
  await page.route('**/global-refinement-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/css/quality/movimiento.css">
      <link rel="stylesheet" href="/css/theme/sistema-superficies-tintin.css">
      <style>body{margin:0}main{padding:24px}section{min-height:200px}.tt-product-card{padding:24px}.tt-btn{display:block;padding:14px;margin:12px}</style>
      </head><body><main><section><h1>Accesorios Tintín</h1>
      <article class="tt-product-card">Reloj de prueba</article>
      <button class="tt-btn" id="action">Ver catálogo</button>
      <button class="tt-btn" id="disabled" aria-disabled="true">Guardando</button>
      </section></main><script src="/js/quality/revelado-desplazamiento-global.js"></script></body></html>`
  }));
  await page.goto('/global-refinement-fixture');
  await expect(page.locator('html')).toHaveClass(/tt-reveal/);
}

test('activar movimiento después de iniciar reducido también observa contenido futuro', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMotionFixture(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveClass(/tt-reveal-ready/);
  await expect(page.locator('main > section')).toHaveClass(/tt-auto-reveal/);
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.id = 'new-section';
    section.textContent = 'Nueva colección';
    document.querySelector('main').append(section);
  });
  await expect(page.locator('#new-section')).toHaveClass(/tt-auto-reveal/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#new-section')).toHaveCSS('transform', 'none');
  await expect(page.locator('#new-section')).toHaveCSS('opacity', '1');
});

test('perder la ventana o cambiar a movimiento reducido libera la respuesta de pulsación', async ({ page }) => {
  await openMotionFixture(page);
  const action = page.locator('#action');
  await action.dispatchEvent('pointerdown');
  await expect(action).toHaveClass(/tt-premium-pressed/);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(action).not.toHaveClass(/tt-premium-pressed/);
  await action.dispatchEvent('pointerdown');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(action).not.toHaveClass(/tt-premium-pressed/);
});

test('una acción deshabilitada no responde visualmente como una acción disponible', async ({ page }) => {
  await openMotionFixture(page);
  await page.locator('#disabled').dispatchEvent('pointerdown');
  await expect(page.locator('#disabled')).not.toHaveClass(/tt-premium-pressed/);
});

test('una tarjeta respeta movimiento reducido incluso con el puntero encima', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMotionFixture(page);
  await page.locator('.tt-product-card').hover();
  await expect(page.locator('.tt-product-card')).toHaveCSS('transform', 'none');
});

test('las tarjetas táctiles no conservan una elevación hover después de tocar', async ({ browser }) => {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await openMotionFixture(page);
    await page.locator('.tt-product-card').tap();
    await expect(page.locator('.tt-product-card')).toHaveCSS('transform', 'none');
  } finally { await context.close(); }
});
