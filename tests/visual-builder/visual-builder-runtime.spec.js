'use strict';
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let server;
let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
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

test('preview aplica contenido y bloque seguro sobre la página real', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(() => {
    document.body.replaceChildren();
    const frame = document.createElement('iframe');
    frame.id = 'real-preview';
    frame.src = '/index.html?ttVisualPreview=1';
    document.body.appendChild(frame);
  });
  const frame = page.frameLocator('#real-preview');
  await expect(frame.locator('.tt-hero-title')).toBeVisible({ timeout: 30000 });
  await page.locator('#real-preview').evaluate(node => new Promise(resolve => {
    if (node.contentDocument?.readyState === 'complete') resolve();
    else node.addEventListener('load', resolve, { once: true });
  }));
  await expect(frame.locator('html')).toHaveAttribute('data-tt-visual-builder', /ready|fallback/, { timeout: 30000 });
  await page.evaluate(() => {
    const frame = document.getElementById('real-preview');
    frame.contentWindow.postMessage({
      type: 'tintin:visual-preview', pageId: 'index',
      config: {
        sections: { hero: { background: '#fbe4ec', textColor: '#331122', accentColor: '#ad3f67', spacing: 'compact', width: 'contained', align: 'center', radius: 'none', shadow: 'none', animation: 'none' } },
        customBlocks: [
          { id: 'safe-test', type: 'section', afterSection: 'hero', eyebrow: 'TINTÍN', title: 'Día de las madres', text: 'Una sección segura', buttonLabel: 'Ver catálogo', href: 'catalogo.html', style: { background: '#fff8fa', textColor: '#331122', accentColor: '#ad3f67', spacing: 'normal', width: 'contained', align: 'center', radius: 'medium', shadow: 'soft', animation: 'fade' } },
          { id: 'safe-second', type: 'text', afterSection: 'hero', eyebrow: '', title: 'Segundo bloque', text: 'Conserva el orden del editor', style: {} }
        ]
      },
      content: { hero: { visible: true, eyebrow: 'Especial', title: 'CREADO SIN CÓDIGO', subtitle: '', primaryText: 'Comprar ahora', primaryHref: 'catalogo.html', btnText: 'Conocenos', btnHref: 'about.html' } }
    }, location.origin);
  });
  await expect(frame.locator('.tt-hero-title')).toContainText('CREADO SIN CÓDIGO');
  await expect(frame.locator('[data-tt-visual-block="safe-test"]')).toContainText('Día de las madres');
  await expect(frame.locator('[data-tt-visual-block="safe-test"] a')).toHaveAttribute('href', 'catalogo.html');
  await expect(frame.locator('#hero + [data-tt-visual-block]')).toHaveAttribute('data-tt-visual-block', 'safe-test');
  await expect(frame.locator('[data-tt-visual-block="safe-test"] + [data-tt-visual-block]')).toHaveAttribute('data-tt-visual-block', 'safe-second');
  await expect(frame.locator('#hero')).toHaveCSS('background-color', 'rgb(251, 228, 236)');
});

test('preview rechaza mensajes enviados con otro pageId', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?ttVisualPreview=1`);
  await page.evaluate(() => window.postMessage({ type: 'tintin:visual-preview', pageId: 'checkout', config: { customBlocks: [{ id: 'bad', type: 'section' }] } }, location.origin));
  await expect(page.locator('[data-tt-visual-block="bad"]')).toHaveCount(0);
});

test('los bloques nuevos (testimonio, video, FAQ, columnas, separador) se renderizan y el ancla "arriba de todo" funciona', async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(() => {
    document.body.replaceChildren();
    const frame = document.createElement('iframe');
    frame.id = 'real-preview';
    frame.src = '/index.html?ttVisualPreview=1';
    document.body.appendChild(frame);
  });
  const frame = page.frameLocator('#real-preview');
  await expect(frame.locator('.tt-hero-title')).toBeVisible({ timeout: 30000 });
  await page.locator('#real-preview').evaluate(node => new Promise(resolve => {
    if (node.contentDocument?.readyState === 'complete') resolve();
    else node.addEventListener('load', resolve, { once: true });
  }));
  await expect(frame.locator('html')).toHaveAttribute('data-tt-visual-builder', /ready|fallback/, { timeout: 30000 });
  await page.evaluate(() => {
    const frame = document.getElementById('real-preview');
    frame.contentWindow.postMessage({
      type: 'tintin:visual-preview', pageId: 'index',
      config: {
        sections: {},
        customBlocks: [
          { id: 'top-block', type: 'text', afterSection: '__top__', title: 'Arriba de todo', text: '', style: {} },
          { id: 'testimonial-1', type: 'testimonial', afterSection: 'hero', title: 'Ana', eyebrow: 'Clienta feliz', text: 'Me encantó', style: {} },
          { id: 'video-safe', type: 'video', afterSection: 'hero', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', style: {} },
          { id: 'video-unsafe', type: 'video', afterSection: 'hero', videoUrl: 'https://evil.test/embed', style: {} },
          { id: 'faq-1', type: 'faq', afterSection: 'hero', items: [{ q: '¿Envían a todo el país?', a: 'Sí' }], style: {} },
          { id: 'columns-1', type: 'columns', afterSection: 'hero', title: 'Columna', text: 'Texto lateral', imageSide: 'right', style: {} },
          { id: 'divider-1', type: 'divider', afterSection: 'hero', style: {} },
        ],
      },
      content: {},
    }, location.origin);
  });
  await expect(frame.locator('[data-tt-visual-block="top-block"]')).toBeVisible();
  await expect(frame.locator('[data-tt-visual-block="testimonial-1"] .tt-visual-testimonial-quote')).toContainText('Me encantó');
  await expect(frame.locator('[data-tt-visual-block="video-safe"] iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  await expect(frame.locator('[data-tt-visual-block="video-unsafe"] iframe')).toHaveCount(0);
  await expect(frame.locator('[data-tt-visual-block="faq-1"] summary')).toContainText('¿Envían a todo el país?');
  await expect(frame.locator('[data-tt-visual-block="columns-1"] .tt-visual-columns-right')).toHaveCount(1);
  await expect(frame.locator('[data-tt-visual-block="divider-1"] hr.tt-visual-divider-rule')).toHaveCount(1);
  // El bloque anclado a "arriba de todo" debe quedar antes de la primera sección real de la página.
  const order = await frame.locator('body > *').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tt-visual-block') || node.id));
  const topIndex = order.indexOf('top-block');
  const heroIndex = order.indexOf('hero');
  expect(topIndex).toBeGreaterThanOrEqual(0);
  expect(heroIndex).toBeGreaterThan(topIndex);
});
