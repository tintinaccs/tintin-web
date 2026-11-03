const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');
const root = path.resolve(__dirname, '../..');

// Componentes y cascada reales; sin sesión, transporte comercial ni escrituras.
// Los flujos funcionales mantienen sus propios specs de producto/carrito.
async function layoutPage(page, file) {
  await page.route('https://layout.test/**', route => {
    const resource = path.resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!resource.startsWith(root + path.sep) || !fs.existsSync(resource)) return route.abort();
    if (resource.endsWith('.html')) return route.fulfill({ contentType: 'text/html',
      body: removeFixtureScripts(fs.readFileSync(resource, 'utf8'), { removeModulePreloads: true }) });
    return route.fulfill({ path: resource });
  });
  await page.route(/https?:\/\/(?!layout\.test\/)/, route => route.abort());
  await page.goto('https://layout.test/' + file);
}

for (const [width, height] of [[320,568],[390,844],[600,800],[767,700],[768,1024],
  [820,700],[1024,768],[1025,700],[1280,720],[1440,900],[1920,1080],[844,390]]) {
  test(`ficha con texto y precio extensos sin recorte ni hueco interior ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await layoutPage(page, 'product.html');
    await page.addStyleTag({ path: 'css/pages/product/product-maintenance.css' });
    const description = 'Acero inoxidable. Medidas y cuidados completos del accesorio. '.repeat(50);
    await page.evaluate(description => {
      document.body.classList.add('tt-product-maintenance');
      document.getElementById('product-loading').style.display = 'none';
      document.getElementById('product-grid').style.display = '';
      document.getElementById('product-name').textContent = 'Reloj de acero con una descripción de nombre extensa y un acabado especial';
      document.getElementById('product-price').innerHTML = 'Gs. 1.234.567.890.123 <s class="tt-product-price-old">Gs. 2.345.678.901.234</s>';
      document.getElementById('product-desc').textContent = description;
      document.getElementById('gallery-main').innerHTML = '<img src="/assets-tintin/images/collections/col-relojes.webp" alt="Relojes Tintin">';
      document.getElementById('product-variants').innerHTML = '<button type="button" class="tt-variant-option">Dorado</button>';
    }, description);
    await expect(page.locator('#product-desc')).toHaveText(description.trim());
    const geometry = await page.evaluate(() => {
      const gallery = document.querySelector('.tt-product-gallery');
      const panel = document.querySelector('.tt-product-info-panel');
      const r = gallery.getBoundingClientRect();
      const ends = [...gallery.children].map(n => n.getBoundingClientRect()).filter(b => b.height > 0);
      return {
        overflow: ['#product-price', '#product-desc', '.tt-product-gallery', '.tt-product-info-panel'].filter(s => {
          const n = document.querySelector(s); return n.scrollWidth > n.clientWidth + 1;
        }),
        rootOverflow: document.documentElement.scrollWidth > innerWidth,
        slack: r.bottom - Math.max(...ends.map(b => b.bottom)),
        aligned: Math.abs(r.top - panel.getBoundingClientRect().top) <= 1
      };
    });
    expect(geometry.overflow).toEqual([]);
    expect(geometry.rootOverflow).toBe(false);
    expect(geometry.slack).toBeLessThanOrEqual(32);
    if (width >= 768) expect(geometry.aligned).toBe(true);
    await expect(page.locator('#gallery-main img')).toHaveCSS('object-fit', 'contain');
    expect((await page.locator('#btn-product-add-cart').boundingBox()).height).toBeGreaterThanOrEqual(44);
    if ([320,768,1440].includes(width)) await page.screenshot({ path: info.outputPath('product-long-content.png'), fullPage: true });
  });
}

for (const [file, selector] of [['contact.html','#contact-name'],['login.html','#login-email'],
  ['product.html','#btn-product-add-cart'],['checkout.html','#ck-firstname']]) {
  test(`foco perceptible en la superficie pública ${file}`, async ({ page }, info) => {
    await layoutPage(page, file);
    if (file === 'product.html') {
      await page.addStyleTag({ path: 'css/pages/product/product-maintenance.css' });
      await page.evaluate(() => {
        document.body.classList.add('tt-product-maintenance');
        document.getElementById('product-loading').style.display='none';
        document.getElementById('product-grid').style.display='';
      });
    }
    // Elegir los campos reales por su familia; no dependemos del ID de un fixture.
    const control = file === 'product.html' ? page.locator(selector)
      : page.locator('input:not([type="hidden"]),textarea,select,button').filter({ visible: true }).first();
    await page.keyboard.press('Tab');
    await control.focus();
    await page.screenshot({ path: info.outputPath('keyboard-focus.png') });
    const focus = await control.evaluate(n => {
      const s=getComputedStyle(n);return { style:s.outlineStyle,width:parseFloat(s.outlineWidth),color:s.outlineColor,ink:s.getPropertyValue('--color-text-primary').trim() };
    });
    expect(focus.style).toBe('solid');
    expect(focus.width).toBeGreaterThanOrEqual(2);
    // El rosa de marca sobre blanco mide ~1,8:1; la tinta existente es legible.
    expect(focus.color).toBe('rgb(34, 34, 34)');
  });
}

for (const width of [390,1440]) for (const action of ['variant','edit']) {
  test(`load real tardío respeta ${action} y orientación sin salto ${width}px`, async ({ page }) => {
    const loader = fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
    const entry = loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial'));
    let releaseImage;
    await page.route('https://scroll.test/**', route => {
      if (new URL(route.request().url()).pathname === '/slow.svg') {
        releaseImage = () => route.fulfill({ contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
        return;
      }
      return route.fulfill({ contentType:'text/html', body:`<!doctype html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1"><script>${entry}</script>
        <style>body{margin:0;min-height:3500px}main{padding-top:650px}button,input{display:block;min-height:44px;margin:12px}</style>
        </head><body><main><button aria-pressed="false" onclick="this.setAttribute('aria-pressed','true')">Dorado</button>
        <label>Nombre<input aria-label="Nombre"></label><img src="/slow.svg" width="1" height="1" alt=""></main></body></html>` });
    });
    await page.setViewportSize({ width,height:900 });
    await page.goto('https://scroll.test/entry',{waitUntil:'domcontentloaded'});
    await expect.poll(()=>Boolean(releaseImage)).toBe(true);
    await page.evaluate(()=>scrollTo({top:500,behavior:'instant'}));
    if(action==='variant') {
      await page.getByRole('button',{name:'Dorado',exact:true}).click();
      await expect(page.getByRole('button',{name:'Dorado',exact:true})).toHaveAttribute('aria-pressed','true');
    } else {
      await page.getByRole('textbox',{name:'Nombre',exact:true}).pressSequentially('Tintin');
    }
    const position=await page.evaluate(()=>scrollY);
    expect(position).toBeGreaterThan(0);
    await releaseImage();
    await page.waitForLoadState('load');
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(position);
    await page.setViewportSize({width:width===390?844:1280,height:width===390?390:720});
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(position);
    await page.evaluate(()=>window.TintinPageScroll.reset());
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  });
}
