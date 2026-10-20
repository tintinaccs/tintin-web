'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');

test.describe('Fase 8 — UI/UX global', () => {
  test.beforeEach(async ({ page }) => {
    // Probar la capa UI real sobre el HTML/CSS real, sin arrancar servicios
    // remotos ajenos a estados, botones y movimiento. Los errores locales se
    // siguen comprobando estrictamente, sin filtrar mensajes del navegador.
    await page.route(/\/(?:about|contact)\.html$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: removeFixtureScripts(await response.text(), { removeModulePreloads: true }) });
    });
  });

  test('carga una sola capa global y expone estados accesibles', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
      const text = message.text();
      if (message.type() === 'error') errors.push(text);
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/about.html', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ type: 'module', url: '/js/quality/experiencia-interfaz.js' });
    await page.waitForFunction(() => window.TintinUX?.booted === true);

    await expect(page.locator('html')).toHaveClass(/tt-phase8-ux-ready/);
    await expect(page.locator('#tt-phase8-ui-ux-css')).toHaveCount(1);

    const result = await page.evaluate(() => {
      const host = document.createElement('section');
      host.id = 'phase8-test-state';
      document.body.appendChild(host);
      window.TintinUX.renderState(host, {
        state: 'error',
        title: 'No pudimos cargar',
        message: 'Probá nuevamente.',
        actionLabel: 'Reintentar',
        onAction: () => {}
      });

      const button = document.createElement('button');
      button.id = 'phase8-test-button';
      button.textContent = 'Guardar';
      document.body.appendChild(button);
      window.TintinUX.enhance(document);
      window.TintinUX.setBusy(button, true, { label: 'Guardando…', timeout: 5000 });

      return {
        state: host.dataset.ttState,
        role: host.getAttribute('role'),
        live: host.getAttribute('aria-live'),
        actionClass: host.querySelector('button')?.className,
        busy: button.getAttribute('aria-busy'),
        busyData: button.dataset.ttBusy,
        disabled: button.disabled,
        interactive: button.dataset.ttInteractive,
      };
    });

    expect(result).toEqual({
      state: 'error',
      role: 'alert',
      live: 'assertive',
      actionClass: 'tt-state-action tt-interactive-control',
      busy: 'true',
      busyData: '1',
      disabled: true,
      interactive: '1',
    });

    await page.evaluate(() => window.TintinUX.setBusy(document.getElementById('phase8-test-button'), false));
    await expect(page.locator('#phase8-test-button')).not.toHaveAttribute('aria-busy');
    await expect(page.locator('#phase8-test-button')).toBeEnabled();

    await page.locator('#phase8-test-button').dispatchEvent('pointerdown');
    await expect(page.locator('#phase8-test-button')).toHaveClass(/tt-is-pressed/);
    await page.locator('#phase8-test-button').dispatchEvent('pointerup');
    await expect(page.locator('#phase8-test-button')).not.toHaveClass(/tt-is-pressed/);

    expect(errors).toEqual([]);
  });

  test('respeta movimiento reducido sin perder estados', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/contact.html', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ type: 'module', url: '/js/quality/experiencia-interfaz.js' });
    await page.waitForFunction(() => window.TintinUX?.booted === true);

    const values = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const button = document.createElement('button');
      button.textContent = 'Acción';
      document.body.appendChild(button);
      window.TintinUX.enhance(document);
      button.classList.add('tt-is-pressed');
      return {
        fast: root.getPropertyValue('--tt-motion-fast').trim(),
        transform: getComputedStyle(button).transform,
      };
    });

    expect(values.fast).toBe('1ms');
    expect(values.transform).toBe('none');
  });
});

// Variantes visuales: la selección y la foto deben coincidir en todos los dispositivos.
require('./product-shape-selection.spec.js');

for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]) {
  test(`carrito vacío mantiene contraste y destino del catálogo ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    const source=fs.readFileSync('checkout.html','utf8');
    const link=source.match(/<a href="\/catalogo" style="[^"]*">\s*Ver catálogo completo →\s*<\/a>/)[0];
    const styles=['css/core/tokens-color.css','css/core/tokens-tintin.css','css/pages/checkout/checkout.css','css/core/tema-unificado-tintin.css'].map(path=>fs.readFileSync(path,'utf8')).join('\n');
    await page.setContent(`<style>${styles}</style><main><div class="ck-empty">${link}</div></main>`);
    const action=page.getByRole('link',{name:'Ver catálogo completo'});
    await expect(action).toHaveAttribute('href','/catalogo');
    for(const [background,text] of [['#F8AACA','#222222'],['#222222','#FFFFFF']]) {
      await page.evaluate(([bg,fg])=>{document.documentElement.style.setProperty('--color-button-primary-background',bg);document.documentElement.style.setProperty('--color-button-primary-text',fg);},[background,text]);
      const contrast=await action.evaluate(el=>{
        const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const s=getComputedStyle(el),a=luminance(s.color),b=luminance(s.backgroundColor);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    const box=await action.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    await action.focus();await expect(action).toBeFocused();
    await page.screenshot({path:`test-results/empty-cart-contrast-${width}x${height}.png`});
  });
}

test('el auditor excluye sólo el logotipo decorativo y conserva la detección de texto y controles',async({page})=>{
  const source=fs.readFileSync('scripts/auditar-contraste.mjs','utf8');
  const scanner=source.slice(source.indexOf('        const lum ='),source.indexOf('\n      });\n      if (r.length)'));
  await page.setContent('<style>body{background:#F8AACA}span,a{font-size:24px;color:white}</style><div id="tt-loader-wordmark" aria-hidden="true"><span id="brand-glyph">i</span></div><a id="catalog-action" href="/catalogo">Ver catálogo completo</a><span id="ordinary-text" aria-hidden="true">Texto visible</span>');
  let failures=await page.evaluate(code=>new Function(code)(),scanner);
  expect(failures.some(row=>row.sel.includes('#brand-glyph'))).toBe(false);
  expect(failures.some(row=>row.sel.includes('#catalog-action'))).toBe(true);
  expect(failures.some(row=>row.sel.includes('#ordinary-text'))).toBe(true);
  await page.locator('#catalog-action').evaluate(el=>el.style.color='#222222');
  failures=await page.evaluate(code=>new Function(code)(),scanner);
  expect(failures.some(row=>row.sel.includes('#catalog-action'))).toBe(false);
  await page.locator('#tt-loader-wordmark').evaluate(el=>{const button=document.createElement('button');el.before(button);button.append(el);});
  failures=await page.evaluate(code=>new Function(code)(),scanner);
  expect(failures.some(row=>row.sel.includes('#brand-glyph'))).toBe(true);
});
