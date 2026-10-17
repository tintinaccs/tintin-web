const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/quality/vigilancia-version.js'), 'utf8');

async function mount(page, { cookies = false } = {}) {
  let revision = 'a'.repeat(64);
  await page.route('https://version.test/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/site-version.json') return route.fulfill({ json: { revision } });
    if (url.pathname === '/watch.js') return route.fulfill({ contentType: 'text/javascript', body: source });
    return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#tt-tabbar{position:fixed;bottom:16px;right:16px;left:16px;height:72px;background:#eee;z-index:1100}@media(min-width:1100px){#tt-tabbar{display:none}}#tt-privacy-consent{position:fixed;bottom:0;right:0;width:100%;height:85vh;background:#ccc;z-index:2147483600}</style><input aria-label="Borrador"><div id="tt-tabbar">Navegación</div>${cookies ? '<div id="tt-privacy-consent">Cookies</div>' : ''}<script type="module" src="/watch.js?v=initial"></script>` });
  });
  await page.goto('https://version.test/');
  await page.waitForFunction(() => !!window.TintinVersionWatch);
  await page.getByRole('textbox').fill('Conservar edición');
  await page.evaluate(() => localStorage.setItem('cart', 'conservar'));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  return () => { revision = 'b'.repeat(64); };
}

for (const [width, height] of [[320,568],[390,844],[430,932],[568,320],[844,390],[768,1024],[1024,768],[1280,720],[1366,768],[1920,1080]]) {
  test(`publicación sin cambios de CSS/JS avisa y permite actualizar · ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const publish = await mount(page);
    publish();
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
    const notice = page.locator('#tt-version-notice');
    await expect(notice).toBeVisible();
    const box = await notice.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    if (width < 1100) expect(box.y + box.height).toBeLessThanOrEqual(height - 88);
    const button = notice.getByRole('button', { name: 'Actualizar', exact: true });
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('textbox')).toHaveValue('Conservar edición');
    await Promise.all([page.waitForEvent('load'), button.click()]);
    await expect(notice).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cart'))).toBe('conservar');
  });
}

test('horizontal con cookies grandes: el aviso sigue visible y se puede posponer', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const publish = await mount(page, { cookies: true });
  publish();
  await page.evaluate(() => window.TintinVersionWatch.checkNow());
  const notice = page.locator('#tt-version-notice');
  await expect(notice).toBeVisible();
  const button = notice.getByRole('button', { name: 'Más tarde', exact: true });
  await button.click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('Conservar edición');
});

test('al volver a la pestaña detecta una publicación y no espera diez minutos', async ({ page }) => {
  const publish = await mount(page);
  await page.clock.install();
  publish();
  await page.clock.runFor(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('una revisión no disponible no inventa cambios y conserva el fallback HTML', async ({ page }) => {
  await mount(page);
  await page.route('**/site-version.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  await page.route('https://version.test/', route => route.fulfill({ contentType: 'text/html', body: '<script src="/watch.js?v=new"></script>' }));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});
