const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('tienda.js', 'utf8');
const start = source.indexOf('function initWaFloatVisibility()');
const end = source.indexOf('\n/* ─', start);
const behavior = source.slice(start, end);
const css = fs.readFileSync('styles.css', 'utf8');

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
