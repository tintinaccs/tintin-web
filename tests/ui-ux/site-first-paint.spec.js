const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const pages = ['index','catalogo','collections','product','checkout','login','perfil','about','contact','envios','cambios-devoluciones','preguntas-frecuentes','terminos','privacidad','404','admin','admin-images'];
const pageStyles = {
  index: ['#tt-home-maintenance-css'], catalogo: ['[data-tt-catalog-maintenance]'],
  checkout: ['[data-tt-checkout-maintenance]', '#tt-payment-methods-style'],
  about: ['[data-tt-about-maintenance]'], product: ['[data-tt-product-maintenance]'],
  login: ['[data-tt-login-maintenance]', '[data-tt-login-fluid]', '[data-tt-login-onboarding-flow]'],
  admin: ['[data-adm-social-notifications]'],
};
for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) for (const name of pages) {
  test(`${name}: estilos finales sin módulos diferidos en ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const source = await page.evaluate(html => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      document.querySelectorAll('script').forEach(script => script.remove());
      return '<!doctype html>' + document.documentElement.outerHTML;
    }, fs.readFileSync(`${name}.html`, 'utf8'));
    await page.route(`**/${name}.html?initial-render-test=1`, r => r.fulfill({ contentType: 'text/html', body: source }));
    await page.route(url => url.origin !== new URL(baseURL).origin, r => r.abort());
    await page.goto(`/${name}.html?initial-render-test=1`);
    const publicPage = !name.startsWith('admin');
    const selectors = ['#tt-phase10-accessibility-css', ...(pageStyles[name] || [])];
    if (publicPage) selectors.push('#tt-global-studio-runtime-css', '#tt-visual-builder-runtime-css', '[data-tt-social-notifications]', '#tt-navigation-desktop-css', '#tt-navigation-tablet-css', '#tt-navigation-mobile-css', '#tt-surface-controller-css');
    for (const selector of selectors) {
      const link = page.locator(`head link${selector}`);
      await expect(link).toHaveCount(1);
      expect(await link.evaluate(el => {
        const owner = el.disabled && el.dataset.ttStyleBundle ? document.getElementById(el.dataset.ttStyleBundle) : el;
        return (el.rel === 'stylesheet' || (el.rel === 'tt-bundled-stylesheet' && el.disabled && owner !== el)) && Boolean(owner?.sheet);
      })).toBe(true);
    }
    // Activar los calificadores de estilo de los runtimes no debe cambiar la geometría ya visible.
    const geometry = () => page.locator('body > section, body > main, .tt-footer').evaluateAll(nodes => nodes.map(el => {
      const r = el.getBoundingClientRect(), css = getComputedStyle(el);
      return { x:r.x, y:r.y, width:r.width, height:r.height, background:css.backgroundColor, padding:css.padding };
    }));
    const initial = await geometry();
    await page.evaluate(name => {
      document.documentElement.classList.add('tt-parity-safe');
      if (name === 'catalogo') document.body.classList.add('tt-catalog-maintenance');
      if (name === 'about') { document.documentElement.classList.add('tt-about-maintained'); document.body.classList.add('tt-about-maintained'); }
      if (name === 'product') document.body.classList.add('tt-product-maintenance');
      if (name === 'collections') document.body.classList.add('tt-collections-page');
    }, name);
    expect(await geometry()).toEqual(initial);
    if (['terminos', 'privacidad'].includes(name)) {
      const runtime = fs.readFileSync('js/pages/institutional/mantenimiento-legal.js', 'utf8');
      const enhance = runtime.slice(runtime.indexOf('  function enhanceStructure()'), runtime.indexOf('  function updateContact'));
      await page.evaluate(code => { eval(code + '; enhanceStructure();'); }, enhance);
      expect(await geometry()).toEqual(initial);
      await expect(page.locator('#tt-legal-nav')).toHaveCount(1);
      await expect(page.locator('#tt-legal-note')).toHaveCount(1);
    }

  });
}
