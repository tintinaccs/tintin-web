const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
});
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');
const source = read('checkout.html');
const confirmation = source.slice(source.indexOf('async function buildConfirmation()'), source.indexOf('// Un único mapa'));
const normalizer = read('js/pages/checkout/checkout-resumen-confirmacion.js').replace(/^export /gm, '');
const secure = read('js/orders/pedido-checkout-seguro.js');
const hardening = read('js/pages/checkout/checkout-hardening.js').replace(/^import[\s\S]*?;\n/gm, '');
const state = read('js/pages/checkout/estado-navegacion-checkout.js');
const payment = read('js/pages/checkout/checkout-metodos-pago.js');
const paymentHandlers = payment.slice(payment.indexOf('function paymentDetailsHtml'), payment.indexOf('function boot()'));
const success = secure.slice(secure.indexOf('  function renderConfirmedOrder('), secure.indexOf('  function message('));
const submit = secure.slice(secure.indexOf('  async function submit('), secure.indexOf("  window.addEventListener('tintin:paypal-payment-completed'"));
const forceCart = hardening.slice(hardening.indexOf('function forceCart('), hardening.indexOf('\nfunction ', hardening.indexOf('function forceCart(') + 1));
const cartListeners = hardening.slice(hardening.indexOf("  window.addEventListener('tt_cart_updated'"), hardening.indexOf('\n}', hardening.indexOf("  window.addEventListener('tt_cart_updated'")));
const quote = secure.slice(secure.indexOf('  function renderQuote('), secure.indexOf('  async function reserveCheckoutGuard'));
const whatsapp = secure.slice(secure.indexOf('  function shippingSummary('), secure.indexOf('  function renderConfirmedOrder('));
const imageUtilities = read('js/components/images/utilidades-imagenes.js').replace(/^export /gm, '');
const css = ['css/core/tema-unificado-tintin.css', 'css/pages/checkout/checkout.css', 'css/pages/checkout/checkout-maintenance.css', 'css/components/payments/payment-methods.css'].map(read).join('\n');

// Execute the original success/submit/cart guards; only external services are
// controlled. No production order, profile write, notification or email occurs.
async function fixture(page) {
  const html = await page.evaluate(({ source, css }) => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.querySelectorAll('script,link:not([rel="stylesheet"]),meta[http-equiv]').forEach(node => node.remove());
    const style = doc.createElement('style');
    style.textContent = css;
    doc.head.append(style);
    doc.documentElement.className = '';
    doc.body.classList.add('tt-checkout-maintenance');
    return doc.documentElement.outerHTML;
  }, { source, css });
  await page.route('**/checkout?receipt-fixture=1', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/checkout?receipt-fixture=1', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: state });
  await page.addScriptTag({ content: `(() => {
    ${imageUtilities}
    const text = value => String(value ?? '');
    const escapeHtml = value => { const el = document.createElement('div'); el.textContent = text(value); return el.innerHTML; };
    const formatPrice = value => 'Gs. ' + Number(value).toLocaleString('es-PY');
    const DEFAULT_STORE_WHATSAPP = '595981299331';
    const SHIPPING_LABELS = {encomienda:'Encomienda',delivery:'Delivery',retiro:'Retiro'};
    const PAYMENT_LABELS = {transferencia:'Transferencia bancaria'};
    const ENCOMIENDA_LABELS = {agencia:'retiro en agencia',puerta:'entrega en puerta'};
    ${whatsapp}
    const scheduleAnnotations = () => {};
    const syncConfirmCartGuard = () => {};
    const showError = (value, step = 4) => { const el = document.getElementById('error-' + step); el.textContent = value; el.classList.add('show'); };
    const hideError = () => document.querySelectorAll('.ck-error').forEach(el => el.classList.remove('show'));
    let cart = [{id:'qa-local', name:'Producto de prueba', qty:1, price:35000}];
    const getCartLocal = () => cart;
    const activeStep = () => [...document.querySelectorAll('.ck-panel')].findIndex(el => el.classList.contains('active'));
    const waitForCheckoutCartReady = () => Promise.resolve();
    let cartReady = true;
    ${forceCart}
    ${cartListeners}
    let submitting = false, orderCompleted = false, availabilityBlocked = false, inMemoryRequestId = 'local', pendingPaypal = null;
    const REQUEST_KEY = 'tt-receipt-fixture-request';
    const buildDraft = async () => ({paymentMethod:'transferencia', shippingMethod:'encomienda'});
    const persistCheckoutDefaults = async () => {};
    const reserveCheckoutGuard = async () => {};
    const createOrderOnServer = async () => { window.fixtureRequests++; if(window.fixtureReject) throw new Error('offline'); return {shortId:'QA-LOCAL-001',items:[{id:'qa-local',name:'Producto de prueba',imageUrl:'/assets-tintin/images/general/logo.png',variant:'Dorado / M',qty:1,price:35000}],subtotal:35000,total:35000,shippingCost:0,shippingMethod:'encomienda',shipping:{city:'San José de los Arroyos'},userName:'Persona de Prueba',userPhone:'+595981000000',userEmail:'persona.qa@example.invalid',paymentMethod:'transferencia'}; };
    const clearCart = async () => { cart = []; window.dispatchEvent(new CustomEvent('tt_cart_updated',{detail:{items:[]}})); await new Promise(resolve => window.fixtureFinishCleanup = resolve); };
    const message = () => 'No pudimos confirmar el pedido.';
    const forceBackToCart = forceCart;
    const setCartLocal = items => cart = items;
    const authoritativeCartFromQuote = quote => quote.items;
    let cartItems = cart;
    const cartTotal = items => items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const orderData = {shippingMethod:'encomienda', shippingCost:0, paymentMethod:'transferencia', name:'Persona de Prueba', phone:'+595981000000', email:'persona.qa@example.invalid', city:'San José de los Arroyos', departamento:'Caaguazú', address:'Dirección extensa de prueba para verificar el resumen en todas las pantallas', notes:'Una referencia de prueba'};
    const encomiendaModeLabel = () => 'Retiro en agencia';
    ${confirmation}
    ${quote}
    ${success}
    window.fixtureReceiptImage = receiptImage;
    ${submit}
    ${paymentHandlers}
    const paymentMethodLabel = method => method.title;
    window.fixtureRequests = 0;
    window.fixtureSubmit = () => submit(document.getElementById('ck-confirm-btn'));
    window.fixtureQuote = () => { buildConfirmation(); renderQuote({items:cart,subtotal:35000,total:35000,shippingCost:0},'encomienda'); };
    window.fixturePayment = () => { document.getElementById('panel-3').querySelector('.ck-panel-body').innerHTML = '<div id="ck-payment-methods-runtime">' + methodHtml({id:'local-bank',kind:'transferencia',title:'Transferencia bancaria',icon:'🏦',description:'Envianos el comprobante por WhatsApp',instructions:'Datos de transferencia de prueba',details:[]}) + '</div>'; const item = document.querySelector('.ck-payment-runtime-item'); item.classList.add('is-selected'); item.querySelector('input').checked = true; };
    window.fixtureEmptyCart = () => { cart = []; window.dispatchEvent(new CustomEvent('tt_cart_updated',{detail:{items:[]}})); };
    window.fixtureReview = () => { document.querySelectorAll('.ck-panel').forEach((el,i)=>el.classList.toggle('active',i===4)); };
  })();` });
  await page.addScriptTag({ content: '(() => {' + normalizer + '})();' });
}

for (const [width, height] of [[320,568],[390,844],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]) {
  test(`ticket survives cart cleanup; payment and shipping fit ${width}x${height}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await fixture(page);
    await page.evaluate(() => {
      fixturePayment();
      document.querySelectorAll('.ck-panel').forEach((el,i)=>el.classList.toggle('active',i===3));
    });
    const label = page.locator('.ck-payment-runtime-item .ck-pay-label');
    await expect(label).toBeVisible();
    expect(await label.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');
    expect(await label.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    expect(await label.evaluate(el => {
      const card = el.closest('.ck-payment-runtime-item').getBoundingClientRect();
      const selected = el.getBoundingClientRect();
      return selected.left >= card.left - 1 && selected.right <= card.right + 1 && el.scrollWidth <= el.clientWidth;
    })).toBe(true);
    await page.evaluate(() => { fixtureReview(); fixtureQuote(); });
    await expect(page.locator('.ck-summary-shipping-note')).toHaveText('El envío se paga a la transportadora al recibir y no está incluido en el total.');
    const separated = await page.locator('.ck-summary-total').evaluateAll(rows => rows.every(row => {
      const [label,value] = [...row.children].map(el=>el.getBoundingClientRect());
      return label.right <= value.left && value.right <= row.getBoundingClientRect().right + 1;
    }));
    expect(separated).toBe(true);
    await page.evaluate(() => { void fixtureSubmit(); });
    await expect(page.locator('#ck-success-head')).toBeVisible();
    await expect(page.locator('#panel-4')).toHaveClass(/active/);
    await expect(page.locator('#ck-order-num')).toHaveText('N° de pedido: QA-LOCAL-001');
    await page.locator('#panel-4').screenshot({path:`artifacts/receipt-organized-${width}.png`});
    // Cleanup is still pending: the confirmed ticket must already be visible.
    await page.evaluate(() => fixtureFinishCleanup());
    await page.evaluate(() => { fixtureEmptyCart(); TintinCheckoutState.persist(); });
    await page.locator('.ck-step[data-step="0"]').dispatchEvent('click');
    await expect(page.locator('#panel-4')).toHaveClass(/active/);
    await expect(page.locator('#ck-confirm-btn')).toBeHidden();
    await expect(page.getByRole('region',{name:'Productos',exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Entrega',exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Tus datos',exact:true})).toBeVisible();
    await expect(page.locator('.ck-receipt-photo img')).toHaveAttribute('src',/\/assets-tintin\/images\/general\/logo\.png$/);
    await expect(page.locator('#ck-save-receipt')).toBeVisible();
    await expect(page.locator('#ck-share-receipt')).toBeVisible();
    await expect(page.locator('.ck-step[data-step="0"]')).toHaveAttribute('aria-disabled','true');
    expect(await page.evaluate(() => sessionStorage.getItem('tt_checkout_draft_v1'))).toBeNull();
    await page.evaluate(() => { void fixtureSubmit(); });
    expect(await page.evaluate(() => fixtureRequests)).toBe(1);
    expect(await page.locator('#panel-4').evaluate(el => el.scrollWidth > el.clientWidth || el.getBoundingClientRect().right > innerWidth + 1)).toBe(false);
    const statusBottom = await page.locator('#ck-email-status').evaluate(el=>el.getBoundingClientRect().bottom);
    const ordersTop = await page.locator('#ck-view-orders').evaluate(el=>el.getBoundingClientRect().top);
    expect(ordersTop).toBeGreaterThanOrEqual(statusBottom);
    expect(errors).toEqual([]);
  });
}

test('failed order keeps review and cart; an ordinary empty cart still resets checkout', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { fixtureReview(); window.fixtureReject = true; void fixtureSubmit(); });
  await expect(page.locator('#error-4')).toHaveText('No pudimos confirmar el pedido.');
  await expect(page.locator('#ck-success-head')).toBeHidden();
  await expect(page.locator('#ck-confirm-btn')).toBeEnabled();
  await expect(page.locator('#panel-4')).toHaveClass(/active/);
  await page.evaluate(() => fixtureEmptyCart());
  await expect(page.locator('#panel-0')).toHaveClass(/active/);
});

test('confirmed ticket downloads, shares and prints without another order request', async ({ page }, testInfo) => {
  await fixture(page);
  await page.evaluate(() => {
    const draw = CanvasRenderingContext2D.prototype.fillText;
    window.fixtureDrawn = [];
    CanvasRenderingContext2D.prototype.fillText = function(value, ...args) { fixtureDrawn.push(value); return draw.call(this, value, ...args); };
  });
  await page.evaluate(() => { fixtureReview(); fixtureQuote(); void fixtureSubmit(); });
  await expect(page.locator('#ck-success-head')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#ck-save-receipt').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Tintin-pedido-QA-LOCAL-001.png');
  const receipt = fs.readFileSync(await download.path());
  expect([...receipt.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
  expect(receipt.readUInt32BE(16)).toBe(1440);
  expect(receipt.readUInt32BE(20)).toBeGreaterThan(800);
  const rendered = await page.evaluate(() => fixtureDrawn.join(' '));
  expect(rendered).toContain('QA-LOCAL-001');
  expect(rendered).toContain('Producto de prueba');
  expect(rendered).toContain('Dorado / M');
  await expect(page.locator('#ck-email-status')).toContainText('se está procesando');
  expect(rendered).toContain('Persona de Prueba');
  expect(rendered).toContain('35.000');
  expect(rendered).toContain('No acredita el pago');
  await download.saveAs('artifacts/ticket-imagen-' + testInfo.project.name + '.png');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files?.[0]?.type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.fixtureShared = data; } });
    window.print = () => { window.fixturePrinted = true; };
  });
  await page.locator('#ck-share-receipt').click();
  await expect(page.locator('#ck-receipt-status')).toContainText('Elegí WhatsApp y Tintin (0981 299331)');
  const shared = await page.evaluate(async () => ({
    text: fixtureShared.text, name: fixtureShared.files[0].name, type: fixtureShared.files[0].type,
    bytes: [...new Uint8Array(await fixtureShared.files[0].arrayBuffer())],
  }));
  expect(shared.text).toContain('¡Hola, Tintin! 🌸 Hice mi pedido en la web');
  expect(shared.text).toContain('QA-LOCAL-001');
  expect(shared.text).toContain('Producto de prueba');
  expect(shared.text).toContain('Dorado / M');
  expect(shared.text).toContain('35.000');
  expect(shared.text).toContain('¡Muchas gracias! 💗');
  expect(shared.text).toContain('no acredita el pago');
  await expect(page.locator('#ck-share-whatsapp-fallback')).toBeHidden();
  expect(shared.name).toBe(download.suggestedFilename());
  expect(shared.type).toBe('image/png');
  expect(Buffer.from(shared.bytes).equals(receipt)).toBe(true);
  await page.locator('#ck-print-receipt').click();
  expect(await page.evaluate(() => fixturePrinted)).toBe(true);
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled','AbortError'); } }));
  await page.locator('#ck-share-receipt').click();
  await expect(page.locator('#panel-4')).toHaveClass(/active/);
  await expect(page.locator('#ck-share-whatsapp-fallback')).toBeHidden();
  expect(await page.evaluate(() => fixtureRequests)).toBe(1);
  await page.locator('#panel-4').screenshot({ path: 'artifacts/receipt-' + testInfo.project.name + '.png' });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#ck-post-confirm')).toBeHidden();
  await expect(page.locator('#ck-order-num')).toBeVisible();
});

test('without file sharing the fallback downloads a PNG, never copies personal text', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => { throw new Error('Must not share text'); } });
    fixtureReview(); void fixtureSubmit();
  });
  const pending = page.waitForEvent('download');
  await page.locator('#ck-share-receipt').click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(fs.readFileSync(await download.path()).subarray(1,4).toString()).toBe('PNG');
  await expect(page.locator('#ck-receipt-status')).toContainText('Descargamos tu ticket PNG');
  const link = page.locator('#ck-share-whatsapp-fallback');
  await expect(link).toBeVisible();
  const url = new URL(await link.getAttribute('href'));
  expect(url.origin + url.pathname).toBe('https://wa.me/595981299331');
  expect(url.searchParams.get('text')).toContain('Hice mi pedido en la web');
  expect(url.searchParams.get('text')).toContain('QA-LOCAL-001');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => fixtureRequests)).toBe(1);
});

test('a failed PNG encoder can retry without submitting another order', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      HTMLCanvasElement.prototype.toBlob = encode;
      callback(null);
    };
    fixtureReview(); void fixtureSubmit();
  });
  await expect(page.locator('#ck-receipt-status')).toContainText('No pudimos generar');
  await page.locator('#ck-save-receipt').click();
  await expect(page.locator('#ck-receipt-status')).toBeEmpty();
  await expect(page.locator('#ck-save-receipt')).toBeEnabled();
  const pending = page.waitForEvent('download');
  await page.locator('#ck-save-receipt').click();
  expect((await pending).suggestedFilename()).toMatch(/\.png$/);
  expect(await page.evaluate(() => fixtureRequests)).toBe(1);
});

test('share permission failure offers the explicit WhatsApp fallback without claiming delivery', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => true });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async () => { throw new DOMException('Denied','NotAllowedError'); } });
    fixtureReview(); void fixtureSubmit();
  });
  await page.locator('#ck-share-receipt').click();
  await expect(page.locator('#ck-receipt-status')).toContainText('No pudimos abrir');
  await expect(page.locator('#ck-share-whatsapp-fallback')).toBeVisible();
  expect(await page.evaluate(() => fixtureRequests)).toBe(1);
});

test('long tickets include the final item and disclaimer inside the PNG', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const draw = CanvasRenderingContext2D.prototype.fillText;
    const drawn = [];
    CanvasRenderingContext2D.prototype.fillText = function(value, x, y) {
      drawn.push({value, y, height: this.canvas.height / this.getTransform().d});
      return draw.call(this, value, x, y);
    };
    fixtureReview();
    document.querySelector('#ck-confirm-summary').innerHTML = Array.from({length:24}, (_, i) => `<div class="ck-summary-item"><span>${i + 1}x Producto con descripción larga y variante Plateado / Material de prueba / Talle M</span><span>Gs. 35.000</span></div>`).join('') + '<div class="ck-summary-row"><span>Referencia</span><span>' + 'X'.repeat(180) + '</span></div>';
    const image = await window.fixtureReceiptImage({shortId:'QA-LARGO'});
    return { size:image.size, drawn };
  });
  expect(result.size).toBeGreaterThan(10000);
  expect(result.drawn.map(row => row.value).join(' ')).toContain('24x Producto');
  expect(result.drawn.map(row => row.value).join(' ')).toContain('No acredita el pago');
  expect(result.drawn.every(row => row.y + 20 < row.height)).toBe(true);
});


test('payment is selectable by keyboard and optional fields do not receive unrelated errors', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { fixturePayment(); document.querySelectorAll('.ck-panel').forEach((el,i)=>el.classList.toggle('active',i===3)); document.querySelector('input[name="tt-ck-pay"]').checked=false; });
  const radio=page.locator('input[name="tt-ck-pay"]');
  await radio.focus();await expect(radio).toBeFocused();await page.keyboard.press('Space');await expect(radio).toBeChecked();
  const maintenance=read('js/pages/checkout/checkout-mantenimiento.js');
  const watch=maintenance.slice(maintenance.indexOf('  function watchErrors('),maintenance.indexOf('  function ensureReady('));
  await page.addScriptTag({content:'(()=>{'+watch+'watchErrors();})();'});
  await page.evaluate(()=>{ const panel=document.getElementById('panel-2');panel.classList.add('active');const error=document.getElementById('error-2');error.textContent='Ingresá un teléfono válido.';error.classList.add('show'); });
  await expect(page.locator('#ck-notes')).not.toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#ck-coupon')).not.toHaveAttribute('aria-invalid','true');
});

test('retroceso después de confirmar lleva a Inicio sin emitir un segundo pedido', async ({page}) => {
  await fixture(page);
  await page.evaluate(()=>{fixtureReview();void fixtureSubmit();});
  await expect(page.locator('#ck-success-head')).toBeVisible();
  await page.evaluate(()=>{void fixtureSubmit();void fixtureSubmit();fixtureFinishCleanup();});
  expect(await page.evaluate(()=>fixtureRequests)).toBe(1);
  const home = new URL('/', page.url()).href;
  await page.route(home, route=>route.fulfill({contentType:'text/html',body:'<main>Inicio de prueba</main>'}));
  await page.goBack({waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(home);
});
