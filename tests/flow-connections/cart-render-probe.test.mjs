import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);

const source = fs.readFileSync(new URL('../../js/admin/flujo-conexiones/flujo-conexiones-admin.js', import.meta.url), 'utf8');
const probe = source.slice(source.indexOf('async function probeRenderedCart('), source.indexOf('\nfunction withConnectionDeadline'));

async function fixture({ drawer = true, slowImage = false } = {}) {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  const page = await browser.newPage();
  const requests = [];
  let releaseImage;
  const imageGate = new Promise(resolve => { releaseImage = resolve; });
  // Inspeccionar el iframe antes de que el poll de la sonda pueda retirarlo.
  // install() solo sustituye el reloj: sigue avanzando en tiempo real.
  await page.clock.install({ time: new Date('2026-10-30T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-30T12:00:01Z'));
  await page.route('http://cart-flow.test/**', async route => {
    const request = route.request();
    requests.push(request.method());
    const path = new URL(request.url()).pathname;
    if (path === '/slow-image.png') {
      await imageGate;
      await route.abort().catch(() => {});
      return;
    }
    const body = path === '/fixture'
      ? `<!doctype html><body><script>${probe}
        const controller = new AbortController();
        window.abortProbe = () => controller.abort();
        window.startProbe = () => { probeRenderedCart(controller.signal).then(value => { window.probeResult = value; }); };
        </script>`
      : `<!doctype html><body>${drawer ? '<div id="cart-drawer"></div>' : '<p>Panel ausente</p>'}${slowImage ? '<img src="/slow-image.png">' : ''}`;
    await route.fulfill({ contentType: 'text/html', body });
  });
  await page.goto('http://cart-flow.test/fixture');
  await page.evaluate(() => window.startProbe());
  return { page, requests, async close() { releaseImage(); await browser.close(); } };
}

test('el carrito renderizado se confirma aunque una imagen siga reteniendo el load del iframe', { timeout: 30_000 }, async () => {
  const f = await fixture({ slowImage: true });
  try {
    await f.page.frameLocator('iframe').locator('#cart-drawer').waitFor({ state: 'attached' });
    assert.notEqual(await f.page.evaluate(() => document.querySelector('iframe').contentDocument.readyState), 'complete');
    await f.page.clock.runFor(500);
    assert.equal(await f.page.evaluate(() => window.probeResult?.[1]?.hasCartDrawer), true);
    assert.equal(await f.page.locator('iframe').count(), 0);
    assert.ok(f.requests.every(method => method === 'GET'));
  } finally { await f.close(); }
});

test('HTTP 200 sin panel de carrito sigue sin confirmar renderizado', { timeout: 30_000 }, async () => {
  const f = await fixture({ drawer: false });
  try {
    await f.page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.readyState === 'complete');
    await f.page.clock.runFor(10_001);
    await f.page.waitForFunction(() => Boolean(window.probeResult));
    assert.deepEqual(await f.page.evaluate(() => window.probeResult), ['cart', { path: '/', status: 200, ok: true, hasCartDrawer: false }]);
    assert.equal(await f.page.locator('iframe').count(), 0);
  } finally { await f.close(); }
});

test('cancelar la sonda retira el iframe y no publica un éxito tardío', { timeout: 30_000 }, async () => {
  const f = await fixture({ drawer: false, slowImage: true });
  try {
    await f.page.frameLocator('iframe').locator('body').waitFor({ state: 'attached' });
    await f.page.evaluate(() => window.abortProbe());
    await f.page.waitForFunction(() => Boolean(window.probeResult));
    assert.equal(await f.page.locator('iframe').count(), 0);
    await f.page.clock.runFor(20_000);
    assert.equal(await f.page.evaluate(() => window.probeResult[1].hasCartDrawer), false);
    assert.ok(f.requests.every(method => method === 'GET'));
  } finally { await f.close(); }
});
