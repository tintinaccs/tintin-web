const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const checkout = fs.readFileSync('checkout.html', 'utf8');
const render = checkout.slice(checkout.indexOf('let lastCartRenderKey'), checkout.indexOf('function showCkToast'));
const hardening = fs.readFileSync('js/pages/checkout/checkout-hardening.js', 'utf8');
const annotate = hardening.slice(hardening.indexOf('function annotateCartRows()'), hardening.indexOf('\nfunction ', hardening.indexOf('function annotateCartRows()') + 1));

test('elegir no agrega; agregar cada color conserva líneas, fotos y cantidades hasta checkout', async ({ page }) => {
  const gold = 'https://cdn.example.test/gold.jpg', silver = 'https://cdn.example.test/silver.jpg';
  const fixture = { id: 'qa-color-flow', name: 'Aro QA', category: 'aros', active: true, price: 50000, stock: 6, imageUrl: gold,
    variants: { Color: ['Dorado', 'Plateado'] }, variantMedia: [{ Color: 'Dorado', imageUrls: [gold] }, { Color: 'Plateado', imageUrls: [silver] }] };
  await page.route('**/api/public-catalog?**', route => {
    const url = new URL(route.request().url()), resource = url.searchParams.get('resource');
    if (resource === 'collections') return route.fulfill({ json: { ok: true, resource, items: [{ id: 'aros', data: { name: 'Aros', slug: 'aros', active: true } }] } });
    if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id') ? { ok: true, resource, item: { id: fixture.id, data: fixture } } : { ok: true, resource, items: [{ id: fixture.id, data: fixture }] } });
    return route.continue();
  });
  await page.route('https://cdn.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="50" fill="gold"/></svg>' }));
  await page.goto('/product?id=qa-color-flow');
  await page.waitForFunction(() => window._renderProductDetail && window.TintinCartRuntime?.addToCart && window.TintinCatalogPolicy && window.TintinProductMedia && window.TintinProductColors);
  await page.evaluate(async fixture => {
    await window.TintinCartRuntime.clearCart();
    Object.defineProperty(window, 'PRODUCTS', { configurable: true, get: () => [fixture], set: () => {} });
    window._renderProductDetail(fixture);
  }, fixture);

  await page.locator('[data-variant-value="Dorado"]').click({timeout:10000});
  expect(await page.evaluate(() => window.TintinCartRuntime.getCartLocal())).toEqual([]);
  await page.locator('#btn-product-add-cart').click();
  await expect.poll(() => page.evaluate(() => window.TintinCartRuntime.getCartLocal().length)).toBe(1);
  await page.locator('[data-variant-value="Plateado"]').click();
  expect(await page.evaluate(() => window.TintinCartRuntime.getCartLocal().length)).toBe(1);
  await page.locator('#btn-product-add-cart').click();
  await expect.poll(() => page.evaluate(() => window.TintinCartRuntime.getCartLocal().length)).toBe(2);
  const lines = await page.evaluate(() => window.TintinCartRuntime.getCartLocal());
  expect(lines.map(({ variant, qty, imageUrl }) => ({ variant, qty, imageUrl }))).toEqual([
    { variant: 'Dorado', qty: 1, imageUrl: gold }, { variant: 'Plateado', qty: 1, imageUrl: silver }
  ]);
  expect(lines[0].lineId).not.toBe(lines[1].lineId);
  await page.evaluate(async ({ render, annotate }) => {
    const runtime = window.TintinCartRuntime;
    await runtime.updateQty(runtime.getCartLocal()[1].lineId, 1);
    const { productVariantImage } = await import(new URL('/js/components/images/foto-variante.mjs?v=tintin-20261008-variant-image-1', location.origin).href);
    const { composeCheckoutDraft } = await import(new URL('/js/orders/politica-checkout.js', location.origin).href);
    document.body.innerHTML = '<div id="ck-items"></div><div id="ck-subtotal-val"></div><button id="btn-step1-next"></button>';
    window.qaRender = new Function('getCartLocal', 'setCartLocal', 'productVariantImage', `let cartItems=[];const sessionCanMakeCheckoutDecision=()=>true;const escapeSearchHtml=s=>String(s);const sanitizeImageUrl=s=>s;const formatPrice=n=>String(n);const cartTotal=items=>items.reduce((sum,i)=>sum+i.qty*i.price,0);${render};${annotate};return async()=>{await renderCart();annotateCartRows();}`)(runtime.getCartLocal, () => {}, productVariantImage);
    await window.qaRender();
    window.qaDraft = composeCheckoutDraft({ items: runtime.getCartLocal(), subtotal: 150000, shipping: { method: 'retiro', cost: 0, pending: false } });
  }, { render, annotate });
  await expect(page.locator('.ck-item')).toHaveCount(2);
  await expect(page.locator('.ck-item').nth(0).locator('[data-cart-variant]')).toHaveText('Dorado');
  await expect(page.locator('.ck-item').nth(1).locator('[data-cart-variant]')).toHaveText('Plateado');
  await expect(page.locator('.ck-item-img').nth(1)).toHaveAttribute('src', silver);
  await expect(page.locator('.ck-qty-num').nth(1)).toHaveText('2');
  expect(await page.evaluate(() => window.qaDraft.cartLines)).toEqual([{ id: fixture.id, variant: 'Dorado', qty: 1 }, { id: fixture.id, variant: 'Plateado', qty: 2 }]);
  await page.evaluate(async () => { const r=window.TintinCartRuntime;await r.removeFromCart(r.getCartLocal()[0].lineId);await window.qaRender(); });
  await expect(page.locator('.ck-item')).toHaveCount(1);
  await expect(page.locator('[data-cart-variant]')).toHaveText('Plateado');
  await page.evaluate(() => window.TintinCartRuntime.clearCart());
});
