const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const styles = [
  'css/core/tokens-color.css',
  'css/core/tema-unificado-tintin.css',
  'css/theme/sistema-superficies-tintin.css',
  'css/pages/home/edicion-editorial-inicio.css',
  'css/pages/home/ajuste-inicio.css',
  'css/pages/home/mantenimiento-inicio.css',
  'css/theme/superficies-solidas-interfaz.css',
  'css/theme/superficies-marca-responsive-tintin.css',
  'css/theme/fondo-solido-cargador.css',
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

for (const width of [390, 1440]) {
  test(`el lienzo base permanece claro sin franjas rosas en acceso, checkout, perfil y administración en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`<style>${styles}</style><body>
      <div id="ck-steps"></div><div class="login-page">Acceso</div><div class="ck-body">Checkout</div>
      <div class="perfil-wrap">Perfil</div><div class="tt-404-wrap">Página de error</div>
      <main class="adm-main"><div class="adm-content"><div class="adm-section"><article class="tt-review-card">Contenido</article></div></div></main>
    </body>`);
    for (const selector of ['body', '.login-page', '.ck-body', '.perfil-wrap', '.tt-404-wrap', '.adm-main', '.adm-content', '.adm-section']) {
      await expect(page.locator(selector)).toHaveCSS('background-image', /linear-gradient/);
      await expect(page.locator(selector)).not.toHaveCSS('background-image', /248,\s*170,\s*202/);
      await expect(page.locator(selector)).toHaveCSS('color', 'rgb(34, 34, 34)');
      await expect(page.locator(selector)).toHaveCSS('filter', 'none');
    }
    await page.evaluate(() => {
      document.documentElement.classList.add('tt-first-paint-bg');
      const style = document.createElement('style');
      style.textContent = 'html.tt-first-paint-bg,html.tt-first-paint-bg body{background:#FFFFFF!important;background-image:var(--tt-flow-canvas,none)!important}';
      document.head.appendChild(style);
    });
    await expect(page.locator('body')).toHaveCSS('background-image', /linear-gradient/);
    await expect(page.locator('.tt-review-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test(`las secciones alternan los dos rosas y reordenan los fondos al ocultarse en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`<style>${styles}</style><body class="tt-home-premium">
      <section class="tt-hero"><picture><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E" alt="Hero con imagen"></picture></section>
      <section class="tt-trust-bar">Beneficios</section>
      <section class="tt-collection-carousel">Colecciones</section>
      <section id="look-section" class="section tt-look-section"><article class="tt-look-card">Tarjeta</article></section>
      <section class="section-sm">Editorial</section>
    </body>`);
    const visibleSections = page.locator('body > section:not([hidden]):not([style*="display: none"]):not([style*="display:none"])');
    for (let index = 0; index < 5; index++) {
      await expect(visibleSections.nth(index)).toHaveCSS('background-color', index % 2 ? 'rgb(248, 170, 202)' : 'rgb(253, 236, 242)');
      await expect(visibleSections.nth(index)).toHaveCSS('color', 'rgb(34, 34, 34)');
      await expect(visibleSections.nth(index)).toHaveCSS('background-image', /linear-gradient/);
      await expect(visibleSections.nth(index)).toHaveCSS('filter', 'none');
    }
    await expect(page.locator('.tt-look-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.tt-hero img')).toHaveAttribute('src', /^data:image\/svg\+xml,/);
    await page.locator('.tt-trust-bar').evaluate(section => { section.hidden = true; });
    for (let index = 0; index < 4; index++) {
      await expect(visibleSections.nth(index)).toHaveCSS('background-color', index % 2 ? 'rgb(248, 170, 202)' : 'rgb(253, 236, 242)');
    }
    const joins = await visibleSections.evaluateAll(sections => sections.map(section => {
      const style = getComputedStyle(section);
      return { start: style.getPropertyValue('--tt-section-start').trim(), end: style.getPropertyValue('--tt-section-end').trim() };
    }));
    for (let index = 1; index < joins.length; index++) expect(joins[index].start).toBe(joins[index - 1].end);
    // El catálogo oculta Completá tu look con style.display, no con hidden.
    await page.locator('#look-section').evaluate(section => { section.style.display = 'none'; });
    for (let index = 0; index < 3; index++) {
      await expect(visibleSections.nth(index)).toHaveCSS('background-color', index % 2 ? 'rgb(248, 170, 202)' : 'rgb(253, 236, 242)');
    }
    expect(await visibleSections.last().evaluate(section => {
      const style = getComputedStyle(section);
      return style.getPropertyValue('--tt-section-end').trim() === style.getPropertyValue('--tt-section-background').trim();
    })).toBe(true);
  });
}
