const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js', 'utf8');
const start = source.indexOf('function initWaFloatVisibility()');
const end = source.indexOf('\n/* ─', start);
const behavior = source.slice(start, end);
const css = fs.readFileSync('styles.css', 'utf8');

test('una hoja de estilos tardía puede mover el aviso sin cambiar su tamaño', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.setContent(`<style>${css}</style>
    <a id="wa-float" class="tt-wa-float" style="position:fixed;right:20px;bottom:100px;width:50px;height:50px">WhatsApp</a>
    <aside class="tt-privacy-consent" style="position:fixed;right:10px;bottom:300px;width:200px;height:100px;animation:none">Privacidad</aside>`);
  await page.addScriptTag({ content: `${behavior}\ninitWaFloatVisibility();` });
  await page.waitForTimeout(250);
  await expect(page.locator('#wa-float')).toBeVisible();
  await page.addStyleTag({ content: '.tt-privacy-consent { bottom:90px !important; }' });
  await expect(page.locator('#wa-float')).toBeHidden({ timeout: 1000 });
});

test('un aviso revelado por una clase del documento también reserva el espacio del flotante', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.setContent(`<style>${css}
    html.qa-notice-pending .tt-privacy-consent { visibility:hidden; }
    </style><a id="wa-float" class="tt-wa-float" style="position:fixed;right:20px;bottom:100px;width:50px;height:50px">WhatsApp</a>
    <aside class="tt-privacy-consent" style="position:fixed;right:10px;bottom:90px;width:200px;height:100px">Privacidad</aside>`);
  await page.evaluate(() => document.documentElement.classList.add('qa-notice-pending'));
  await page.addScriptTag({ content: `${behavior}\ninitWaFloatVisibility();` });
  await page.waitForTimeout(250);
  await expect(page.locator('#wa-float')).toBeVisible();
  // Cambia visibilidad, no tamaño: ResizeObserver no puede detectar este caso.
  await page.evaluate(() => document.documentElement.classList.remove('qa-notice-pending'));
  await expect(page.locator('#wa-float')).toBeHidden();
});

for (const width of [320, 390, 768, 1440]) {
  test(`WhatsApp reserva el aviso de privacidad y vuelve al cerrarlo en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height:850 });
    await page.setContent(`<style>${css}</style>
      <button id="ordinary" style="position:fixed;right:20px;bottom:100px;width:50px;height:50px">Contenido</button>
      <a id="wa-float" class="tt-wa-float" href="#" style="right:20px;bottom:100px;width:50px;height:50px">WhatsApp</a>
      <aside class="tt-privacy-consent" hidden style="position:fixed;right:10px;bottom:90px;width:200px;height:100px">Privacidad</aside>`);
    await page.evaluate(() => {
      const wa = document.getElementById('wa-float');
      const measure = wa.getBoundingClientRect.bind(wa);
      window.waGeometryReads = 0;
      wa.getBoundingClientRect = () => { window.waGeometryReads++; return measure(); };
    });
    await page.addScriptTag({ content:`${behavior}\ninitWaFloatVisibility();` });
    const whatsapp = page.locator('#wa-float');
    await expect(whatsapp).toBeVisible();
    await page.evaluate(() => new Promise(resolve => {
      document.body.appendChild(document.createElement('div'));
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    expect(await page.evaluate(() => window.waGeometryReads)).toBe(0);
    await page.evaluate(() => { document.querySelector('.tt-privacy-consent').hidden = false; });
    await expect(whatsapp).toBeHidden();
    await expect(whatsapp).toHaveAttribute('tabindex', '-1');
    await page.evaluate(() => { document.querySelector('.tt-privacy-consent').hidden = true; });
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).not.toHaveAttribute('tabindex', '-1');
    await page.evaluate(() => {
      const consent = document.querySelector('.tt-privacy-consent');
      consent.style.bottom = '300px'; consent.hidden = false;
    });
    await expect(whatsapp).toBeVisible();
  });
}

test('WhatsApp no mide en bucle ni al actualizar tarjetas ajenas; sigue reaccionando a avisos nuevos', async ({ page }) => {
  await page.setContent(`<style>${css}</style><main id="cards"></main><a id="wa-float" class="tt-wa-float" style="position:fixed;right:20px;bottom:100px;width:50px;height:50px">WhatsApp</a>`);
  await page.addScriptTag({ content: `${behavior}\ninitWaFloatVisibility();` });
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__ttWaFloatStats.checks);
  await page.evaluate(async () => {
    for (let i = 0; i < 25; i++) {
      const card = document.createElement('article');
      card.textContent = `Producto ${i}`;
      document.getElementById('cards').append(card);
      await new Promise(requestAnimationFrame);
    }
  });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__ttWaFloatStats.checks) - before).toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    const notice = document.createElement('aside');
    notice.className = 'tt-cart-feedback';
    notice.style.cssText = 'position:fixed;left:auto;right:10px;bottom:90px;width:200px;height:100px;transform:none';
    document.body.append(notice);
  });
  await expect(page.locator('#wa-float')).toBeVisible();
  await page.locator('.tt-cart-feedback').evaluate(node => node.classList.add('is-visible'));
  await expect(page.locator('#wa-float')).toBeHidden();
  await page.locator('.tt-cart-feedback').evaluate(node => node.remove());
  await expect(page.locator('#wa-float')).toBeVisible();
});
