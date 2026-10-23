const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

for (const width of [390, 820, 1440]) test(`edición aislada de Checkout, ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height:900});
  const unsafe = [];
  const errors = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4192' || !['GET', 'HEAD'].includes(request.method())) unsafe.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/checkout');
  await expect(page.locator('#preview-tools')).toBeVisible();
  await expect(page.locator('#panel-0')).toBeVisible();
  for (const step of ['1', '2', '3', '4']) {
    await page.locator('#preview-step').selectOption(step);
    await expect(page.locator(`#panel-${step}`)).toBeVisible();
  }
  await page.reload();
  await expect(page.locator('#panel-4')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
  expect(unsafe).toEqual([]);
});

test('documento y servidor impiden escrituras y exponer código comercial o secretos', async ({page, request}) => {
  const response = await page.goto('/checkout');
  expect(response.headers()['content-security-policy']).toContain("form-action 'none'");
  expect(response.headers()['cache-control']).toBe('no-store');
  for (const resource of ['/api/apps-script-bridge', '/api/public-catalog', '/js/core/firebase/firebase.js', '/.env', '/firebase-messaging-sw.js', '/package.json', '/scripts/vista-previa.mjs']) {
    expect((await request.get(resource)).status()).toBe(404);
  }
  expect((await request.post('/api/apps-script-bridge', {data:{fake:'fixture'}})).status()).toBe(403);
  expect(await page.locator('script').evaluateAll(nodes => nodes.map(node => new URL(node.src).pathname))).toEqual(['/__preview/client.js']);
});

test('guardar CSS se ve en la siguiente petición sin build, merge ni tags nuevos', async ({request}) => {
  const file = `css/preview-test-${randomUUID()}.css`;
  try {
    fs.writeFileSync(file, '.preview-probe { color: red; }');
    expect(await (await request.get(`/${file}`)).text()).toContain('color: red');
    fs.writeFileSync(file, '.preview-probe { color: blue; }');
    const changed = await request.get(`/${file}`);
    expect(await changed.text()).toContain('color: blue');
    expect(changed.headers()['cache-control']).toBe('no-store');
  } finally {fs.rmSync(file, {force:true});}
});
