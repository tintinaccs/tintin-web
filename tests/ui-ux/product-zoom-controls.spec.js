const { test, expect } = require('@playwright/test');

// En dos columnas (>=768px) la galería acompaña el scroll mientras la ficha de
// la derecha sigue a la vista y termina alineada con su borde inferior. En una
// columna (móvil) no cambia el flujo normal.
const product = {
  id: 'qa-sticky', name: 'Reloj de prueba sticky', category: 'relojes', price: 12000, stock: 5,
  imageUrl: '/assets-tintin/images/home/hero-editorial/necklace.webp', active: true,
  description: Array(60).fill('Texto largo de descripción para alargar el panel derecho.').join(' '),
};

async function isolate(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.route('**/js/core/store/tiempo-real-producto.js?*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export function loadProductRealtimeDependencies() {
      return Promise.resolve({ db: {}, appCheckReady: Promise.resolve(true), doc: (_d, _c, id) => ({ id }),
        getDoc: async () => ({ exists: () => false }), onSnapshot: () => () => {} });
    }` }));
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { ok: false } });
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/public-catalog') return route.fulfill({ json: { ok: true } });
    const resource = url.searchParams.get('resource');
    if (resource === 'products') return route.fulfill({ json: url.searchParams.has('id')
      ? { ok: true, resource, item: { id: product.id, data: product } }
      : { ok: true, resource, items: [{ id: product.id, data: product }], count: 1 } });
    if (resource === 'collections') return route.fulfill({ json: { ok: true, resource,
      items: [{ id: 'relojes', data: { name: 'Relojes', slug: 'relojes', active: true } }] } });
    return route.fulfill({ json: { ok: true, resource, data: { storeOpen: true, maintenanceAccess: {} } } });
  });
}

async function open(page) {
  await isolate(page);
  await page.goto('/product?id=qa-sticky', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#product-name')).toHaveText(product.name);
}


for (const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[844,390]]) {
  test(`visor permite explorar y restablecer ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await open(page);
    await page.locator('#gallery-main').click();
    await expect(page.locator('#tt-lightbox')).toHaveClass(/open/);
    const stage = page.locator('.tt-lightbox-stage');
    const rect = await stage.boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y+rect.height).toBeLessThanOrEqual(height);
    await page.locator('#lb-zoom-in').click();
    if(width===390) await page.screenshot({path:'/tmp/tintin-product-zoom.png'});
    await expect(page.locator('#lb-reset')).toHaveText('125%');
    await page.mouse.move(rect.x+rect.width/2, rect.y+rect.height/2);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width/2+40,rect.y+rect.height/2+30);
    await page.mouse.up();
    await expect(page.locator('#lb-img')).not.toHaveCSS('transform','matrix(1.25, 0, 0, 1.25, 0, 0)');
    await page.locator('#lb-reset').click();
    await expect(page.locator('#lb-reset')).toHaveText('100%');
    await expect(page.locator('#lb-zoom-out')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('#tt-lightbox')).not.toHaveClass(/open/);
    await expect(page.locator('#gallery-main')).toBeFocused();
  });
}

test('dos dedos acercan y cancelación no deja arrastre activo', async ({page})=>{
  await page.setViewportSize({width:390,height:844}); await open(page); await page.locator('#gallery-main').click();
  await expect(page.locator('#tt-lightbox')).toHaveClass(/open/);
  const rect=await page.locator('.tt-lightbox-stage').boundingBox();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const y=rect.y+rect.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y,id:1},{x:200,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y,id:1},{x:250,y,id:2}]});
  await expect(page.locator('#lb-reset')).toHaveText('150%');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('#lb-img')).not.toHaveClass(/is-panning/);
});
