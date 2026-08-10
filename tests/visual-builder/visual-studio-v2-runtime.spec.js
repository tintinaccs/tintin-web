'use strict';
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
let server;
let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://local');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{}');
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function mountVisualPreview(page) {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(() => {
    document.body.replaceChildren();
    const frame = document.createElement('iframe');
    frame.id = 'visual-v2-preview';
    frame.style.width = '390px';
    frame.style.height = '820px';
    frame.src = '/index.html?ttVisualPreview=1';
    document.body.appendChild(frame);
  });
  const frame = page.frameLocator('#visual-v2-preview');
  await expect(frame.locator('.tt-hero-title')).toBeVisible({ timeout: 30000 });
  await page.locator('#visual-v2-preview').evaluate(node => new Promise(resolve => {
    if (node.contentDocument?.readyState === 'complete') resolve();
    else node.addEventListener('load', resolve, { once: true });
  }));
  await expect(frame.locator('html')).toHaveAttribute('data-tt-visual-builder', /ready|fallback/, { timeout: 30000 });
  return frame;
}

test('Visual Studio v2 renderiza beneficios, marquee, contador y spacer y aplica override mobile real', async ({ page }) => {
  const frame = await mountVisualPreview(page);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  await page.evaluate(({ future }) => {
    document.getElementById('visual-v2-preview').contentWindow.postMessage({
      type: 'tintin:visual-preview',
      pageId: 'index',
      config: {
        sections: {},
        customBlocks: [
          {
            id: 'features-v2', type: 'features', afterSection: 'hero', title: 'Comprar en Tintin es fácil',
            items: [{ q: 'Compra fácil', a: 'Elegí tus favoritos.' }, { q: 'Envíos', a: 'Recibí tu pedido.' }],
            style: { variant: 'cards', responsive: { mobile: { visibility: 'hide' } } },
          },
          { id: 'marquee-v2', type: 'marquee', afterSection: 'hero', title: 'NUEVO · TINTIN · NUEVO', marqueeSpeed: 'fast', style: { variant: 'bar' } },
          { id: 'countdown-v2', type: 'countdown', afterSection: 'hero', title: 'Termina pronto', endAt: future, expiredText: 'Finalizado', style: {} },
          { id: 'spacer-v2', type: 'spacer', afterSection: 'hero', spacerSize: 'medium', style: {} },
        ],
      },
      content: {},
    }, location.origin);
  }, { future });

  await expect(frame.locator('[data-tt-visual-block="features-v2"] .tt-visual-feature-card')).toHaveCount(2);
  await expect(frame.locator('[data-tt-visual-block="features-v2"]')).toHaveCSS('display', 'none');
  await expect(frame.locator('[data-tt-visual-block="marquee-v2"] .tt-visual-marquee-track')).toContainText('NUEVO');
  await expect(frame.locator('[data-tt-visual-block="countdown-v2"] .tt-visual-countdown-value')).not.toHaveText('');
  await expect(frame.locator('[data-tt-visual-block="spacer-v2"]')).toHaveCSS('height', '48px');
});

test('el shell público carga el runtime global en una página real y falla de forma segura sin API', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await expect(page.locator('html')).toHaveAttribute('data-tt-global-studio', /ready|fallback/, { timeout: 30000 });
});

test('campaña prioritaria y pop-up global se aplican sobre la tienda y Escape restaura la interacción', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(async () => {
    const runtimePath = ['js', 'core', 'store', 'visual-studio-global-runtime.js'].join('/');
    const module = await import(new URL(runtimePath, `${location.origin}/`).href);
    module.disposeGlobalVisualStudio();
    module.applyGlobalVisualStudio({
      campaigns: [
        { id: 'low', name: 'Baja', enabled: true, priority: 10, announcement: 'Campaña baja', effect: 'none', closable: true },
        { id: 'high', name: 'Alta', enabled: true, priority: 90, announcement: 'Campaña principal', effect: 'hearts', intensity: 'low', closable: true, accentColor: '#ad3f67' },
      ],
      popups: [
        {
          id: 'popup-real', name: 'Promo', enabled: true, priority: 80, kind: 'center', title: 'Una sorpresa para vos', text: 'Contenido real del aviso',
          buttonLabel: 'Ver catálogo', href: 'catalogo.html', trigger: 'immediate', triggerValue: 0, frequency: 'always', pages: ['*'],
          devices: ['desktop', 'tablet', 'mobile'], animation: 'fade',
        },
      ],
    });
  });

  await expect(page.locator('[data-tt-global-campaign="high"]')).toContainText('Campaña principal');
  await expect(page.locator('[data-tt-global-campaign="low"]')).toHaveCount(0);
  await expect(page.locator('[data-tt-global-effects="high"]')).toHaveCount(1);
  await expect(page.locator('[data-tt-global-popup="popup-real"]')).toBeVisible();
  await expect(page.locator('[data-tt-global-popup="popup-real"] [role="dialog"]')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('[data-tt-global-popup="popup-real"] .tt-global-popup-action')).toHaveAttribute('href', 'catalogo.html');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tt-global-popup="popup-real"]')).toHaveCount(0);
  const overflow = await page.locator('html').evaluate(node => node.style.overflow);
  expect(overflow).toBe('');
});
