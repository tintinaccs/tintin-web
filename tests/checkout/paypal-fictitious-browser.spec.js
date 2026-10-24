const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const source = removeFixtureScripts(fs.readFileSync('checkout.html', 'utf8'), { removeModulePreloads: true });
const sdk = `window.paypal={Buttons(options){window.qaPaypalCallbacks=options;return {render:async(container)=>{
 if(window.qaRenderRejected)throw Error('No pudimos mostrar el botón de pago ficticio.');
 const button=document.createElement('button');button.type='button';button.textContent='Pagar pedido ficticio';button.style.cssText='min-height:44px;width:100%';
 button.onclick=async()=>{try{const orderID=await options.createOrder();await options.onApprove({orderID});}catch(error){options.onError(error);}};container.append(button);
}}}};`;
async function mount(page, { renderRejected = false, sdkFailure = false, captureFailure = false } = {}) {
  const calls = []; let sdkRequests = 0, captures = 0;
  await page.route('https://**', route => route.abort());
  await page.route('**/js/core/auth/cliente-api-autenticado.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const authenticatedFetch=(...args)=>fetch(...args);' }));
  await page.route('https://www.paypal.com/sdk/js*', route => {
    sdkRequests++;
    return sdkFailure && sdkRequests === 1 ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: sdk });
  });
  await page.route('**/api/paypal-config', route => route.fulfill({ json: { enabled: true, clientId: 'qa-only-client', environment: 'sandbox' } }));
  await page.route('**/api/paypal-create-order', route => { calls.push({ path: 'create', body: route.request().postDataJSON() }); return route.fulfill({ json: { success: true, providerOrderId: 'QA_PROVIDER_ORDER' } }); });
  await page.route('**/api/paypal-capture-order', route => {
    captures++; calls.push({ path: 'capture', body: route.request().postDataJSON() });
    return captureFailure && captures === 1 ? route.fulfill({ status: 503, json: { success: false, error: 'Fallo temporal ficticio.' } }) : route.fulfill({ json: { success: true, paid: true, orderId: 'qa_checkout_order', captureId: 'QA_CAPTURE_ID' } });
  });
  await page.addInitScript(({ renderRejected }) => { window.qaRenderRejected = renderRejected; window.qaPaymentCompletions = []; window.addEventListener('tintin:paypal-payment-completed', event => window.qaPaymentCompletions.push(event.detail)); }, { renderRejected });
  await page.route('**/__paypal-fictitious', route => route.fulfill({ contentType: 'text/html', body: source.replace('</body>', '<script type="module">await import("../../js/pages/checkout/paypal-checkout.js");window.qaPaypalReady=true;</script></body>') }));
  await page.goto('/__paypal-fictitious'); await page.waitForFunction(() => window.qaPaypalReady);
  await page.evaluate(() => { document.querySelectorAll('.ck-panel').forEach((panel, index) => panel.classList.toggle('active', index === 4)); window.dispatchEvent(new CustomEvent('tintin:paypal-order-ready', { detail: { orderId: 'qa_checkout_order' } })); });
  return { calls, sdkRequests: () => sdkRequests };
}
for (const [width,height] of [[320,568],[390,844],[430,932],[844,390],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440]]) {
  test(`pago ficticio: cancelación, fallo y reintento ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const errors=[]; page.on('pageerror', error => errors.push(error.message));
    const fixture = await mount(page, { captureFailure: true });
    const button = page.getByRole('button', { name: 'Pagar pedido ficticio', exact: true }); await expect(button).toBeVisible();
    await page.evaluate(() => window.qaPaypalCallbacks.onCancel());
    await expect(page.locator('#tt-paypal-status')).toContainText('cancelado'); expect(fixture.calls).toEqual([]);
    await button.click(); await expect(page.locator('#tt-paypal-status')).toContainText('intentarlo nuevamente');
    expect(await page.evaluate(() => window.qaPaymentCompletions)).toEqual([]);
    await button.click(); await expect.poll(() => page.evaluate(() => window.qaPaymentCompletions.length)).toBe(1);
    expect(fixture.calls.filter(call => call.path === 'capture')).toHaveLength(2);
    expect(fixture.calls.find(call => call.path === 'create').body).toEqual({ orderId: 'qa_checkout_order' });
    expect(await page.evaluate(() => window.qaPaymentCompletions[0].orderId)).toBe('qa_checkout_order');
    expect(errors).toEqual([]);
    expect(await page.locator('#tt-paypal-checkout').evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1)).toBe(true);
  });
}
test('fallo asíncrono del SDK muestra error y permite volver a mostrar el pago', async ({ page }) => {
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  await mount(page, { renderRejected: true });
  await expect(page.locator('#tt-paypal-status')).toContainText('No pudimos mostrar', { timeout: 3000 });
  await page.evaluate(() => { window.qaRenderRejected=false; window.dispatchEvent(new CustomEvent('tintin:paypal-order-ready', {detail:{orderId:'qa_checkout_order'}})); });
  await expect(page.getByRole('button',{name:'Pagar pedido ficticio',exact:true})).toBeVisible({timeout:3000});
  expect(errors).toEqual([]);
});
test('el SDK puede descargarse de nuevo si el primer intento falla', async ({ page }) => {
  const fixture=await mount(page,{sdkFailure:true});
  await expect(page.locator('#tt-paypal-status')).toContainText('No se pudo cargar');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:paypal-order-ready',{detail:{orderId:'qa_checkout_order'}})));
  await expect(page.getByRole('button',{name:'Pagar pedido ficticio',exact:true})).toBeVisible({timeout:3000});
  expect(fixture.sdkRequests()).toBe(2); expect(fixture.calls).toEqual([]);
});
